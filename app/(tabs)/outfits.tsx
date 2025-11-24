import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { useCloset } from "../ClosetProvider";
import { useSimpleTheme } from "src/hooks/useSimpleTheme";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { captureRef } from "react-native-view-shot";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type OutfitItem = { 
  category: string; 
  uri: string; 
  slotIndex: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
};

type SavedOutfit = { 
  id: string; 
  outfit: OutfitItem[]; 
  category: string; 
  isCollage?: boolean;
  backgroundColor?: string;
  backgroundImage?: string;
  previewUri?: string;
};

type OutfitCategories = Record<string, SavedOutfit[]>;
type Slot = { category: string | null; index: number };

type CollageItem = {
  id: string;
  uri: string;
  category: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

const BACKGROUND_COLORS = [
  "#FFFFFF", "#F5F5F5", "#E8E8E8", "#000000", 
  "#FFE5E5", "#E5F5FF", "#FFF9E5", "#E5FFE5",
  "#FFE5F5", "#F5E5FF", "#E5FFFF", "#FFEFE5"
];

// Draggable Item Component - FIXED
const DraggableItem = ({ item, onUpdate, onRemove, scrollEnabled }: any) => {
  const position = useRef(new Animated.ValueXY({ x: item.x, y: item.y })).current;
  const [isDragging, setIsDragging] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        scrollEnabled(false);
        position.setOffset({
          x: position.x._value,
          y: position.y._value,
        });
        position.setValue({ x: 0, y: 0 });

        longPressTimer.current = setTimeout(() => {
          onRemove(item.id);
        }, 800);
      },
      onPanResponderMove: (_, gestureState) => {
        if (longPressTimer.current && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5)) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        
        Animated.event(
          [null, { dx: position.x, dy: position.y }],
          { useNativeDriver: false }
        )(_, gestureState);
      },
      onPanResponderRelease: () => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }

        setIsDragging(false);
        scrollEnabled(true);
        position.flattenOffset();
        onUpdate(item.id, {
          x: position.x._value,
          y: position.y._value,
        });
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.draggableItem,
        {
          transform: [
            ...position.getTranslateTransform(),
            { scale: item.scale },
            { rotate: `${item.rotation}deg` },
          ],
          opacity: isDragging ? 0.8 : 1,
          zIndex: isDragging ? 1000 : 1,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.draggableImageContainer}>
        <Image source={{ uri: item.uri }} style={styles.draggableImage} />
      </View>
    </Animated.View>
  );
};

export default function OutfitsScreen() {
  const { colors, isDark } = useSimpleTheme();
  const { closet } = useCloset();
  const allClosetCategories = Object.keys(closet).filter(
    (cat) => closet[cat]?.length > 0
  );

  const [user, setUser] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>(
    Array(5).fill(null).map(() => ({ category: null, index: 0 }))
  );
  const [savedOutfits, setSavedOutfits] = useState<OutfitCategories>({});
  const [showLibrary, setShowLibrary] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [selectedExistingCategory, setSelectedExistingCategory] = useState<string | null>(null);

  // Collage mode states
  const [isCollageMode, setIsCollageMode] = useState(false);
  const [collageItems, setCollageItems] = useState<CollageItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [collageBackground, setCollageBackground] = useState("#FFFFFF");
  const [customBackgroundUri, setCustomBackgroundUri] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const collageCanvasRef = useRef<View>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        loadOutfits(firebaseUser.uid);
      } else {
        setUser(null);
        setSavedOutfits({});
      }
    });
    return () => unsub();
  }, []);

  const loadOutfits = async (uid: string) => {
    try {
      const q = query(collection(db, "outfits"), where("uid", "==", uid));
      const snapshot = await getDocs(q);
      const outfits: OutfitCategories = {};

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const { category, outfit, isCollage, backgroundColor, backgroundImage, previewUri } = data;
        if (!outfits[category]) outfits[category] = [];
        outfits[category].push({ 
          id: docSnap.id, 
          category, 
          outfit, 
          isCollage: isCollage || false,
          backgroundColor,
          backgroundImage,
          previewUri,
        });
      });

      setSavedOutfits(outfits);
    } catch (err) {
      console.error("Error loading outfits:", err);
    }
  };

  const deleteImageFromStorage = async (imageUrl: string) => {
    if (!imageUrl || !imageUrl.includes('firebase')) return;
    
    try {
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
      console.log("✅ Image deleted from Firebase Storage:", imageUrl);
    } catch (error: any) {
      if (error.code !== 'storage/object-not-found') {
        console.error("Error deleting image from storage:", error);
      }
    }
  };

  const captureCollagePreview = async (): Promise<string | null> => {
  if (!collageCanvasRef.current || !user) return null;
  
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const uri = await captureRef(collageCanvasRef, {
      format: "jpg",
      quality: 0.7,
      result: "tmpfile",
    });

    console.log("📸 Captured preview:", uri);

    const response = await fetch(uri);
    const blob = await response.blob();
    
    console.log("📦 Blob size:", blob.size);
    
    const filename = `collage_preview_${Date.now()}.jpg`;
    const storagePath = `users/${user.uid}/collages/${filename}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob, {
      contentType: "image/jpeg",
      customMetadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    const downloadURL = await getDownloadURL(storageRef);
    console.log("✅ Preview uploaded to:", downloadURL);
    return downloadURL;
  } catch (error) {
    console.error("❌ Error capturing collage preview:", error);
    return null;
  }
};

  const addOutfitToCategory = async (outfit: OutfitItem[], category: string, isCollage: boolean = false) => {
    if (!user) {
      Alert.alert("Error", "Please sign in to save outfits.");
      return;
    }
    
    try {
      let outfitData: any = {
        uid: user.uid,
        category,
        outfit,
        isCollage,
        createdAt: new Date().toISOString(),
      };

      if (isCollage) {
        outfitData.backgroundColor = collageBackground;
        outfitData.backgroundImage = customBackgroundUri;
        
        const previewUri = await captureCollagePreview();
        if (previewUri) {
          outfitData.previewUri = previewUri;
        }
      }

      await addDoc(collection(db, "outfits"), outfitData);
      
      await loadOutfits(user.uid);
      Alert.alert("Success", `${isCollage ? 'Collage' : 'Outfit'} saved to "${category}"!`);
    } catch (err: any) {
      console.error("Error saving outfit:", err);
      Alert.alert("Error", "Failed to save. Please try again.");
    }
  };

  const deleteOutfit = async (outfitId: string) => {
    if (!user) return;
    
    try {
      const outfitDoc = await getDoc(doc(db, "outfits", outfitId));
      
      if (outfitDoc.exists()) {
        const data = outfitDoc.data();
        
        if (data.previewUri) {
          await deleteImageFromStorage(data.previewUri);
        }
        
        if (data.backgroundImage) {
          await deleteImageFromStorage(data.backgroundImage);
        }
      }
      
      await deleteDoc(doc(db, "outfits", outfitId));
      
      await loadOutfits(user.uid);
      Alert.alert("Success", "Deleted!");
    } catch (err) {
      console.error("Error deleting outfit:", err);
      Alert.alert("Error", "Failed to delete.");
    }
  };

  const handleOutfitLongPress = (outfit: SavedOutfit) => {
    Alert.alert("Options", "What would you like to do?", [
      {
        text: outfit.isCollage ? "Load Collage" : "Load Outfit",
        onPress: () => loadOutfitToModel(outfit),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Confirm Delete",
            "Are you sure?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => deleteOutfit(outfit.id),
              },
            ]
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const saveOutfit = () => {
    let currentOutfitItems: OutfitItem[] = [];
    
    if (isCollageMode) {
      currentOutfitItems = collageItems.map((item) => ({
        category: item.category,
        uri: item.uri,
        slotIndex: 0,
        x: item.x,
        y: item.y,
        scale: item.scale,
        rotation: item.rotation,
      }));
    } else {
      slots.forEach((slot, slotIndex) => {
        if (slot.category && closet[slot.category]?.length) {
          currentOutfitItems.push({
            category: slot.category,
            uri: closet[slot.category][slot.index].uri,
            slotIndex: slotIndex,
          });
        }
      });
    }

    if (currentOutfitItems.length === 0) {
      return Alert.alert("Empty", `Please add items to save ${isCollageMode ? 'a collage' : 'an outfit'}.`);
    }

    setSelectedExistingCategory(null);
    setCustomCategoryName("");
    setSaveModalOpen(true);
  };

  const confirmSaveOutfit = async () => {
    const category = selectedExistingCategory || customCategoryName.trim() || (isCollageMode ? "My Collages" : "Saved Outfits");
    
    if (!category) {
      Alert.alert("Error", "Please select or enter a category name.");
      return;
    }

    let outfitItems: OutfitItem[] = [];
    
    if (isCollageMode) {
      outfitItems = collageItems.map((item) => ({
        category: item.category,
        uri: item.uri,
        slotIndex: 0,
        x: item.x,
        y: item.y,
        scale: item.scale,
        rotation: item.rotation,
      }));
    } else {
      slots.forEach((slot, slotIndex) => {
        if (slot.category && closet[slot.category]?.length) {
          outfitItems.push({
            category: slot.category,
            uri: closet[slot.category][slot.index].uri,
            slotIndex: slotIndex,
          });
        }
      });
    }

    await addOutfitToCategory(outfitItems, category, isCollageMode);
    setSaveModalOpen(false);
    setCustomCategoryName("");
    setSelectedExistingCategory(null);
  };

  const pickCategory = (slotIndex: number) => {
    const categoryOrder = ["Tops", "Bottoms", "Shoes", "Accessories"];
    const availableCategories = categoryOrder.filter((cat) =>
      allClosetCategories.includes(cat)
    );

    if (availableCategories.length === 0) {
      Alert.alert("No Items", "Add items to your closet first!");
      return;
    }

    Alert.alert(
      "Choose Category",
      "",
      [
        ...availableCategories.map((cat) => ({
          text: cat,
          onPress: () => {
            const newSlots = [...slots];
            newSlots[slotIndex] = { category: cat, index: 0 };
            setSlots(newSlots);
          },
        })),
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const pickFaceImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 1,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets.length > 0) {
      const newSlots = [...slots];
      newSlots[0] = { category: "Face", index: 0 };
      setSlots(newSlots);

      if (!closet["Face"]) closet["Face"] = [];
      closet["Face"][0] = {
        id: "face-item",
        uri: result.assets[0].uri,
        category: "Face",
        tags: [],
      };
    }
  };

  const pickCustomBackground = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setCustomBackgroundUri(result.assets[0].uri);
      setCollageBackground("transparent");
    }
  };

  const nextItem = (i: number) => {
    const slot = slots[i];
    if (!slot.category) return;
    const items = closet[slot.category];
    if (!items?.length) return;
    const newSlots = [...slots];
    newSlots[i].index = (slot.index + 1) % items.length;
    setSlots(newSlots);
  };

  const prevItem = (i: number) => {
    const slot = slots[i];
    if (!slot.category) return;
    const items = closet[slot.category];
    if (!items?.length) return;
    const newSlots = [...slots];
    newSlots[i].index = (slot.index - 1 + items.length) % items.length;
    setSlots(newSlots);
  };

  const removeSlotCategory = (i: number) => {
    const newSlots = [...slots];
    newSlots[i] = { category: null, index: 0 };
    setSlots(newSlots);
  };

  const handleSlotLongPress = (i: number) => {
    if (slots[i].category) {
      Alert.alert("Remove", "Remove this item from the outfit?", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeSlotCategory(i) },
      ]);
    }
  };

  const loadOutfitToModel = (outfit: SavedOutfit) => {
    if (outfit.isCollage) {
      setIsCollageMode(true);
      
      if (outfit.backgroundColor) {
        setCollageBackground(outfit.backgroundColor);
      }
      if (outfit.backgroundImage) {
        setCustomBackgroundUri(outfit.backgroundImage);
      }
      
      const loadedItems: CollageItem[] = outfit.outfit.map((piece, index) => ({
        id: `${Date.now()}_${index}`,
        uri: piece.uri,
        category: piece.category,
        x: piece.x || Math.random() * (SCREEN_WIDTH - 200) + 50,
        y: piece.y || Math.random() * 300 + 100,
        scale: piece.scale || 1,
        rotation: piece.rotation || 0,
      }));
      setCollageItems(loadedItems);
    } else {
      setIsCollageMode(false);
      const newSlots: Slot[] = Array(5)
        .fill(null)
        .map(() => ({ category: null, index: 0 }));
      
      outfit.outfit.forEach((piece) => {
        const targetSlot = piece.slotIndex !== undefined ? piece.slotIndex : 0;
        
        if (targetSlot >= 0 && targetSlot < 5) {
          const items = closet[piece.category];
          if (items && items.length > 0) {
            const itemIndex = items.findIndex((it) => it.uri === piece.uri);
            newSlots[targetSlot] = { 
              category: piece.category, 
              index: itemIndex >= 0 ? itemIndex : 0 
            };
          }
        }
      });
      
      setSlots(newSlots);
    }
    
    setShowLibrary(false);
    Alert.alert("Loaded", `Your ${outfit.isCollage ? 'collage' : 'outfit'} has been loaded!`);
  };

  const clearOutfit = () => {
    Alert.alert("Clear", `Remove all items from the ${isCollageMode ? 'collage' : 'outfit'}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          if (isCollageMode) {
            setCollageItems([]);
            setCollageBackground("#FFFFFF");
            setCustomBackgroundUri(null);
          } else {
            setSlots(Array(5).fill(null).map(() => ({ category: null, index: 0 })));
          }
        },
      },
    ]);
  };

  const randomizeOutfit = () => {
    if (allClosetCategories.length === 0) {
      Alert.alert("No Items", "Add items to your closet first!");
      return;
    }

    if (isCollageMode) {
      const newItems = collageItems.map(item => {
        const items = closet[item.category];
        if (items && items.length > 0) {
          const randomItem = items[Math.floor(Math.random() * items.length)];
          return {
            ...item,
            uri: randomItem.uri,
          };
        }
        return item;
      });
      setCollageItems(newItems);
    } else {
      const newSlots: Slot[] = Array(5).fill(null).map(() => ({ category: null, index: 0 }));

      slots.forEach((slot, i) => {
        if (slot.category && closet[slot.category]?.length > 0) {
          const items = closet[slot.category];
          const randomIndex = Math.floor(Math.random() * items.length);
          newSlots[i] = { category: slot.category, index: randomIndex };
        }
      });

      const hasCategories = newSlots.some(slot => slot.category !== null);
      
      if (!hasCategories) {
        Alert.alert("No Categories", "Please add categories to slots first!");
        return;
      }

      setSlots(newSlots);
    }
  };

  const toggleMode = () => {
    setIsCollageMode(!isCollageMode);
    setSelectedCategory(null);
    setCollageBackground("#FFFFFF");
    setCustomBackgroundUri(null);
  };

  const addCollageItem = (item: any) => {
    const newItem: CollageItem = {
      id: `${Date.now()}_${Math.random()}`,
      uri: item.uri,
      category: selectedCategory || "Unknown",
      x: Math.random() * (SCREEN_WIDTH - 200) + 50,
      y: Math.random() * 250 + 50,
      scale: 1,
      rotation: 0,
    };
    setCollageItems([...collageItems, newItem]);
  };

  const updateCollageItem = (id: string, updates: any) => {
    setCollageItems(items =>
      items.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeCollageItem = (id: string) => {
    Alert.alert("Remove Item", "Remove this item from the collage?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setCollageItems(items => items.filter(item => item.id !== id));
        },
      },
    ]);
  };

  const existingCategories = Object.keys(savedOutfits);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {showLibrary ? (
        <>
          <View style={[styles.headerRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable onPress={() => setShowLibrary(false)}>
              <Ionicons name="chevron-back" size={28} color={colors.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.text }]}>My Library</Text>
            <View style={{ width: 28 }} />
          </View>

          {Object.keys(savedOutfits).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No saved items yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Create and save your first outfit or collage</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent}>
              {Object.keys(savedOutfits).map((category) => (
                <View key={category} style={[styles.categoryContainer, { backgroundColor: colors.card }]}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() =>
                      setExpandedCategory(
                        expandedCategory === category ? null : category
                      )
                    }
                  >
                    <View>
                      <Text style={[styles.categoryTitle, { color: colors.text }]}>{category}</Text>
                      <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
                        {savedOutfits[category].length} items
                      </Text>
                    </View>
                    <Ionicons
                      name={
                        expandedCategory === category
                          ? "chevron-down"
                          : "chevron-forward"
                      }
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {expandedCategory === category && (
                    <View style={styles.outfitGrid}>
                      {savedOutfits[category].map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.outfitCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => loadOutfitToModel(item)}
                          onLongPress={() => handleOutfitLongPress(item)}
                        >
                          {item.isCollage && item.previewUri ? (
                            <View style={styles.collagePreviewContainer}>
                              <Image
                                source={{ uri: item.previewUri }}
                                style={styles.collagePreview}
                                resizeMode="cover"
                              />
                            </View>
                          ) : (
                            <View style={styles.outfitContent}>
                              {item.outfit.slice(0, 4).map((p, idx) => (
                                <Image
                                  key={`${item.id}-${idx}`}
                                  source={{ uri: p.uri }}
                                  style={styles.thumbnail}
                                />
                              ))}
                            </View>
                          )}
                          <View style={styles.cardFooter}>
                            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                              {item.outfit.length} items
                            </Text>
                            {item.isCollage && (
                              <View style={styles.collageBadge}>
                                <Text style={styles.collageBadgeText}>Collage</Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        <View style={styles.builderWrapper}>
          <View style={[styles.simpleHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.simpleHeaderTitle, { color: colors.text }]}>
              {isCollageMode ? "Collage Builder" : "Outfit Builder"}
            </Text>
            <TouchableOpacity onPress={toggleMode} style={[styles.toggleButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons 
                name={isCollageMode ? "grid-outline" : "images-outline"} 
                size={24} 
                color={colors.text}
              />
              <Text style={[styles.toggleText, { color: colors.text }]}>
                {isCollageMode ? "Model" : "Collage"}
              </Text>
            </TouchableOpacity>
          </View>

          {isCollageMode ? (
            <ScrollView 
              style={styles.collageScrollWrapper}
              contentContainerStyle={styles.collageScrollContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={scrollEnabled}
            >
              <View style={styles.collageWrapper}>
                <Text style={[styles.helpText, { color: colors.textSecondary }]}>Hold item to delete</Text>
                <View 
                  ref={collageCanvasRef}
                  collapsable={false}
                  style={[
                    styles.collageCanvas,
                    { 
                      backgroundColor: customBackgroundUri ? 'transparent' : collageBackground,
                      borderColor: colors.border
                    }
                  ]}
                >
                  {customBackgroundUri && (
                    <Image 
                      source={{ uri: customBackgroundUri }} 
                      style={styles.customBackground}
                    />
                  )}
                  {collageItems.map((item) => (
                    <DraggableItem
                      key={item.id}
                      item={item}
                      onUpdate={updateCollageItem}
                      onRemove={removeCollageItem}
                      scrollEnabled={setScrollEnabled}
                    />
                  ))}
                  {collageItems.length === 0 && (
                    <View style={styles.collageEmptyState}>
                      <Ionicons name="images-outline" size={48} color={colors.textSecondary} />
                      <Text style={[styles.collageEmptyText, { color: colors.textSecondary }]}>
                        Select a category below to add items
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.backgroundSection}>
                  <Text style={[styles.backgroundLabel, { color: colors.text }]}>Background</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.backgroundOptions}
                  >
                    {BACKGROUND_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => {
                          setCollageBackground(color);
                          setCustomBackgroundUri(null);
                        }}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          collageBackground === color && !customBackgroundUri && styles.colorOptionSelected,
                        ]}
                      >
                        {collageBackground === color && !customBackgroundUri && (
                          <Ionicons name="checkmark" size={20} color={color === "#FFFFFF" || color === "#F5F5F5" ? "#000" : "#fff"} />
                        )}
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      onPress={pickCustomBackground}
                      style={[
                        styles.colorOption,
                        styles.customBgButton,
                        customBackgroundUri && styles.colorOptionSelected,
                      ]}
                    >
                      <Ionicons name="image-outline" size={20} color="#666" />
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                <View style={styles.categorySelector}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categorySelectorContent}
                  >
                    {["Tops", "Bottoms", "Shoes", "Accessories"].map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                        style={[
                          styles.categoryButton,
                          selectedCategory === cat && styles.categoryButtonActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryButtonText,
                            selectedCategory === cat && styles.categoryButtonTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {selectedCategory && closet[selectedCategory]?.length > 0 && (
                  <View style={styles.itemsGridWrapper}>
                    <ScrollView 
                      contentContainerStyle={styles.itemsGrid}
                      showsVerticalScrollIndicator={false}
                    >
                      {closet[selectedCategory].map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          onPress={() => addCollageItem(item)}
                          style={styles.gridItem}
                        >
                          <Image source={{ uri: item.uri }} style={styles.gridItemImage} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </ScrollView>
          ) : (
            <ScrollView 
              contentContainerStyle={styles.builderContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modelContainer}>
                <View style={styles.modelBody} />
                {slots.map((slot, i) => {
                  if (!slot.category) {
                    return (
                      <Pressable
                        key={i}
                        style={[
                          i === 0 ? styles.facePlusButton : styles.plusButton, 
                          { top: 140 * i + 40 }
                        ]}
                        onPress={() =>
                          i === 0 ? pickFaceImage() : pickCategory(i)
                        }
                      >
                        <Ionicons name="add" size={i === 0 ? 40 : 32} color="#fff" />
                      </Pressable>
                    );
                  }
                  const items = closet[slot.category];
                  if (!items?.length) return null;
                  const currentItem = items[slot.index];
                  if (!currentItem) return null;
                  
                  return (
                    <View
                      key={i}
                      style={[styles.slotContainer, { top: 140 * i + 40 }]}
                    >
                      <Pressable onPress={() => prevItem(i)}>
                        <Ionicons name="chevron-back-circle" size={40} color={colors.text} />
                      </Pressable>
                      <Pressable onLongPress={() => handleSlotLongPress(i)}>
                        <Image
                          source={{ uri: currentItem.uri }}
                          style={i === 0 ? styles.faceImage : styles.overlayItem}
                          resizeMode="cover"
                        />
                      </Pressable>
                      <Pressable onPress={() => nextItem(i)}>
                        <Ionicons
                          name="chevron-forward-circle"
                          size={40}
                          color={colors.text}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              <View style={styles.builderActions}>
                <Pressable style={styles.randomizeButton} onPress={randomizeOutfit}>
                  <Ionicons name="shuffle-outline" size={22} color="#fff" />
                  <Text style={styles.builderActionText}>Randomize</Text>
                </Pressable>
                
                <Pressable style={styles.clearButtonBuilder} onPress={clearOutfit}>
                  <Ionicons name="refresh-outline" size={22} color="#fff" />
                  <Text style={styles.builderActionText}>Clear</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          <View style={[styles.actionContainer, { backgroundColor: colors.background }]}>
            <Pressable style={[styles.saveButton, { backgroundColor: colors.text }]} onPress={saveOutfit}>
              <Ionicons name="save-outline" size={20} color={colors.background} />
              <Text style={[styles.saveButtonText, { color: colors.background }]}>
                Save {isCollageMode ? "Collage" : "Outfit"}
              </Text>
            </Pressable>

            <Pressable style={[styles.viewButton, { backgroundColor: colors.surface }]} onPress={() => setShowLibrary(true)}>
              <Ionicons name="albums-outline" size={20} color={colors.text} />
              <Text style={[styles.viewButtonText, { color: colors.text }]}>My Library</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal transparent visible={saveModalOpen} animationType="fade">
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Save {isCollageMode ? "Collage" : "Outfit"}
            </Text>
            
            {existingCategories.length > 0 && (
              <>
                <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
                  Select an existing category
                </Text>
                <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
                  {existingCategories.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[
                        styles.categoryOption,
                        { backgroundColor: colors.surface },
                        selectedExistingCategory === cat && [styles.categoryOptionSelected, { borderColor: colors.primary }]
                      ]}
                      onPress={() => {
                        setSelectedExistingCategory(cat);
                        setCustomCategoryName("");
                      }}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        { color: colors.textSecondary },
                        selectedExistingCategory === cat && [styles.categoryOptionTextSelected, { color: colors.text }]
                      ]}>
                        {cat}
                      </Text>
                      <Text style={[styles.categoryOptionCount, { color: colors.textSecondary }]}>
                        {savedOutfits[cat].length} items
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                
                <Text style={[styles.orText, { color: colors.textSecondary }]}>OR</Text>
              </>
            )}
            
            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>
              Create a new category
            </Text>
            <TextInput
              placeholder={isCollageMode ? "e.g., Summer Collages, Mood Boards" : "e.g., Casual, Work, Party"}
              placeholderTextColor={colors.textSecondary}
              value={customCategoryName}
              onChangeText={(text) => {
                setCustomCategoryName(text);
                if (text.trim()) {
                  setSelectedExistingCategory(null);
                }
              }}
              style={[styles.newCategoryInput, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? colors.surface : colors.card }]}
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setSaveModalOpen(false);
                  setCustomCategoryName("");
                  setSelectedExistingCategory(null);
                }}
                style={[styles.modalCancelBtn, { backgroundColor: colors.surface }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmSaveOutfit} style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.modalBtnTextPrimary}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  builderWrapper: {
    flex: 1,
  },
  simpleHeader: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  simpleHeaderTitle: {
    fontSize: 24,
    fontWeight: "700",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  collageScrollWrapper: {
    flex: 1,
  },
  collageScrollContent: {
    paddingBottom: 180,
  },
  collageWrapper: {
    flex: 1,
  },
  helpText: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: "600",
  },
  collageCanvas: {
    height: 380,
    margin: 16,
    marginTop: 4,
    borderRadius: 16,
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
  },
  customBackground: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 1,
  },
  collageEmptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  collageEmptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  draggableItem: {
    position: "absolute",
    width: 120,
    height: 120,
  },
  draggableImageContainer: {
    width: "100%",
    height: "100%",
  },
  draggableImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  backgroundSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backgroundLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  backgroundOptions: {
    gap: 8,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorOptionSelected: {
    borderColor: "#0066ff",
    borderWidth: 3,
  },
  customBgButton: {
    backgroundColor: "#f0f0f0",
  },
  categorySelector: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categorySelectorContent: {
    gap: 8,
  },
  categoryButton: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  categoryButtonActive: {
    backgroundColor: "#0066ff",
    borderColor: "#0066ff",
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  categoryButtonTextActive: {
    color: "#fff",
  },
  itemsGridWrapper: {
    paddingHorizontal: 16,
    maxHeight: 250,
  },
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 48) / 3,
    height: (SCREEN_WIDTH - 48) / 3,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  gridItemImage: {
    width: "100%",
    height: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { 
    fontSize: 22, 
    fontWeight: "700" 
  },
  emptyState: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 32 
  },
  emptyText: { 
    fontSize: 18, 
    fontWeight: "600",
    marginTop: 8 
  },
  emptySubtext: { 
    fontSize: 14,
    marginTop: 4 
  },
  listContent: { 
    padding: 16, 
    paddingBottom: 150 
  },
  categoryContainer: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  categoryTitle: { 
    fontSize: 18, 
    fontWeight: "700",
  },
  categoryCount: { 
    fontSize: 13,
    marginTop: 2 
  },
  outfitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  builderContent: { 
    flexGrow: 1, 
    alignItems: "center", 
    paddingVertical: 20,
    paddingBottom: 150,
    minHeight: 750,
  },
  modelContainer: {
    width: 380,
    height: 750,
    position: "relative",
    alignItems: "center",
  },
  modelBody: {
    width: 180,
    height: 500,
    backgroundColor: "#e8e8e8",
    borderRadius: 90,
    marginTop: 120,
  },
  builderActions: {
    flexDirection: "row",
    gap: 18,
    marginTop: 0,
    paddingHorizontal: 20,
  },
  randomizeButton: {
    backgroundColor: "#5f27cd",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 4,
  },
  clearButtonBuilder: {
    backgroundColor: "#ff4757",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 4,
  },
  builderActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  slotContainer: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
  },
  overlayItem: { 
    width: 140, 
    height: 140,
    borderRadius: 8,
  },
  faceImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: "#fff",
  },
  plusButton: {
    position: "absolute",
    backgroundColor: "#1a1a1a",
    borderRadius: 50,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  facePlusButton: {
    position: "absolute",
    backgroundColor: "#1a1a1a",
    borderRadius: 70,
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  actionContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    paddingBottom: 85,
    gap: 12,
  },
  saveButton: {
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  saveButtonText: { 
    fontWeight: "700", 
    fontSize: 16 
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flex: 1,
    justifyContent: "center",
  },
  viewButtonText: { 
    fontWeight: "700",
    fontSize: 16 
  },
  outfitCard: {
    width: "48%",
    margin: "1%",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  outfitContent: {
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
  },
  thumbnail: { 
    width: 60, 
    height: 60, 
    borderRadius: 6 
  },
  collagePreviewContainer: {
    width: "100%",
    height: 140,
    backgroundColor: "#f0f0f0",
  },
  collagePreview: {
    width: "100%",
    height: "100%",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  collageBadge: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  collageBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    padding: 24,
    borderRadius: 16,
    width: "85%",
    maxHeight: "80%",
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: "800", 
    marginBottom: 12 
  },
  modalSubtext: { 
    fontSize: 14,
    marginBottom: 12, 
    fontWeight: "600" 
  },
  categoryList: {
    maxHeight: 200,
    marginBottom: 12,
  },
  categoryOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  categoryOptionSelected: {
    borderWidth: 2,
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  categoryOptionTextSelected: {
    fontWeight: "700",
  },
  categoryOptionCount: {
    fontSize: 12,
  },
  orText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    marginVertical: 12,
  },
  newCategoryInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    padding: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  modalSubmitBtn: {
    padding: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: "center",
  },
  modalBtnText: { 
    fontWeight: "600", 
    fontSize: 16 
  },
  modalBtnTextPrimary: { 
    color: "#fff", 
    fontWeight: "700", 
    fontSize: 16 
  },
});
