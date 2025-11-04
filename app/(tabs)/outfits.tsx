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
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type OutfitItem = { category: string; uri: string; slotIndex: number };
type SavedOutfit = { id: string; outfit: OutfitItem[]; category: string };
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

// Draggable Item Component
const DraggableItem = ({ item, onUpdate, onRemove }: any) => {
  const position = useRef(new Animated.ValueXY({ x: item.x, y: item.y })).current;
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        position.setOffset({
          x: position.x._value,
          y: position.y._value,
        });
        position.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: position.x, dy: position.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        setIsDragging(false);
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
      <TouchableOpacity
        onLongPress={() => onRemove(item.id)}
        style={styles.draggableImageContainer}
      >
        <Image source={{ uri: item.uri }} style={styles.draggableImage} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function OutfitsScreen() {
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
        const { category, outfit } = data;
        if (!outfits[category]) outfits[category] = [];
        outfits[category].push({ id: docSnap.id, category, outfit });
      });

      setSavedOutfits(outfits);
    } catch (err) {
      console.error("Error loading outfits:", err);
    }
  };

  const addOutfitToCategory = async (outfit: OutfitItem[], category: string) => {
    if (!user) {
      Alert.alert("Error", "Please sign in to save outfits.");
      return;
    }
    
    try {
      await addDoc(collection(db, "outfits"), {
        uid: user.uid,
        category,
        outfit,
        createdAt: new Date().toISOString(),
      });
      
      await loadOutfits(user.uid);
      Alert.alert("Success", `Outfit saved to "${category}"!`);
    } catch (err: any) {
      console.error("Error saving outfit:", err);
      Alert.alert("Error", "Failed to save outfit. Please try again.");
    }
  };

  const deleteOutfit = async (outfitId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "outfits", outfitId));
      await loadOutfits(user.uid);
      Alert.alert("Success", "Outfit deleted!");
    } catch (err) {
      console.error("Error deleting outfit:", err);
      Alert.alert("Error", "Failed to delete outfit.");
    }
  };

  const handleOutfitLongPress = (outfit: SavedOutfit) => {
    Alert.alert("Outfit Options", "What would you like to do?", [
      {
        text: "Load Outfit",
        onPress: () => loadOutfitToModel(outfit),
      },
      {
        text: "Delete Outfit",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Confirm Delete",
            "Are you sure you want to delete this outfit?",
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
      // Save collage items
      currentOutfitItems = collageItems.map((item, index) => ({
        category: item.category,
        uri: item.uri,
        slotIndex: index,
      }));
    } else {
      // Save model items
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
      return Alert.alert("Empty Outfit", "Please add items to save an outfit.");
    }

    setSelectedExistingCategory(null);
    setCustomCategoryName("");
    setSaveModalOpen(true);
  };

  const confirmSaveOutfit = async () => {
    const category = selectedExistingCategory || customCategoryName.trim() || "Saved Outfits";
    
    if (!category) {
      Alert.alert("Error", "Please select or enter a category name.");
      return;
    }

    let outfitItems: OutfitItem[] = [];
    
    if (isCollageMode) {
      outfitItems = collageItems.map((item, index) => ({
        category: item.category,
        uri: item.uri,
        slotIndex: index,
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

    await addOutfitToCategory(outfitItems, category);
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
    const newSlots: Slot[] = Array(5)
      .fill(null)
      .map(() => ({ category: null, index: 0 }));
    
    outfit.outfit.forEach((piece, pieceIndex) => {
      const targetSlot = piece.slotIndex !== undefined ? piece.slotIndex : pieceIndex;
      
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
    setShowLibrary(false);
    setIsCollageMode(false);
    Alert.alert("Outfit Loaded", "Your outfit has been loaded to the builder!");
  };

  const clearOutfit = () => {
    Alert.alert("Clear Outfit", "Remove all items from the outfit?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          if (isCollageMode) {
            setCollageItems([]);
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
      // Randomize collage items
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
      // Randomize model slots
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
        Alert.alert("No Categories", "Please add categories to slots first, then randomize!");
        return;
      }

      setSlots(newSlots);
    }
  };

  const toggleMode = () => {
    setIsCollageMode(!isCollageMode);
    setSelectedCategory(null);
  };

  // Collage mode functions
  const addCollageItem = (item: any) => {
    const newItem: CollageItem = {
      id: `${Date.now()}_${Math.random()}`,
      uri: item.uri,
      category: selectedCategory || "Unknown",
      x: Math.random() * (SCREEN_WIDTH - 200) + 50,
      y: Math.random() * 400 + 100,
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {showLibrary ? (
        <>
          <View style={styles.headerRow}>
            <Pressable onPress={() => setShowLibrary(false)}>
              <Ionicons name="chevron-back" size={28} color="#1a1a1a" />
            </Pressable>
            <Text style={styles.headerTitle}>Saved Outfits</Text>
            <View style={{ width: 28 }} />
          </View>

          {Object.keys(savedOutfits).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No saved outfits yet</Text>
              <Text style={styles.emptySubtext}>Create and save your first outfit</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent}>
              {Object.keys(savedOutfits).map((category) => (
                <View key={category} style={styles.categoryContainer}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() =>
                      setExpandedCategory(
                        expandedCategory === category ? null : category
                      )
                    }
                  >
                    <View>
                      <Text style={styles.categoryTitle}>{category}</Text>
                      <Text style={styles.categoryCount}>
                        {savedOutfits[category].length} outfits
                      </Text>
                    </View>
                    <Ionicons
                      name={
                        expandedCategory === category
                          ? "chevron-down"
                          : "chevron-forward"
                      }
                      size={20}
                      color="#999"
                    />
                  </TouchableOpacity>

                  {expandedCategory === category && (
                    <View style={styles.outfitGrid}>
                      {savedOutfits[category].map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.outfitCard}
                          onPress={() => loadOutfitToModel(item)}
                          onLongPress={() => handleOutfitLongPress(item)}
                        >
                          <View style={styles.outfitContent}>
                            {item.outfit.slice(0, 4).map((p, idx) => (
                              <Image
                                key={`${item.id}-${idx}`}
                                source={{ uri: p.uri }}
                                style={styles.thumbnail}
                              />
                            ))}
                          </View>
                          <Text style={styles.cardLabel}>
                            {item.outfit.length} items
                          </Text>
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
          {/* Header with toggle */}
          <View style={styles.simpleHeader}>
            <Text style={styles.simpleHeaderTitle}>Outfit Builder</Text>
            <TouchableOpacity onPress={toggleMode} style={styles.toggleButton}>
              <Ionicons 
                name={isCollageMode ? "grid-outline" : "images-outline"} 
                size={24} 
                color="#1a1a1a" 
              />
              <Text style={styles.toggleText}>
                {isCollageMode ? "Model" : "Collage"}
              </Text>
            </TouchableOpacity>
          </View>

          {isCollageMode ? (
            // COLLAGE MODE
            <View style={styles.collageWrapper}>
              <View style={styles.collageCanvas}>
                {collageItems.map((item) => (
                  <DraggableItem
                    key={item.id}
                    item={item}
                    onUpdate={updateCollageItem}
                    onRemove={removeCollageItem}
                  />
                ))}
                {collageItems.length === 0 && (
                  <View style={styles.collageEmptyState}>
                    <Ionicons name="images-outline" size={48} color="#ccc" />
                    <Text style={styles.collageEmptyText}>
                      Select a category below to add items
                    </Text>
                  </View>
                )}
              </View>

              {/* Category Selector */}
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

              {/* Items Grid */}
              {selectedCategory && closet[selectedCategory]?.length > 0 && (
                <ScrollView 
                  style={styles.itemsScroll}
                  contentContainerStyle={styles.itemsGrid}
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
              )}
            </View>
          ) : (
            // MODEL MODE
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
                        <Ionicons name="chevron-back-circle" size={40} color="#1a1a1a" />
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
                          color="#1a1a1a"
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>

              {/* Clear and Randomize buttons under the builder */}
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

          <View style={styles.actionContainer}>
            <Pressable style={styles.saveButton} onPress={saveOutfit}>
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Outfit</Text>
            </Pressable>

            <Pressable style={styles.viewButton} onPress={() => setShowLibrary(true)}>
              <Ionicons name="albums-outline" size={20} color="#1a1a1a" />
              <Text style={styles.viewButtonText}>My Outfits</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Save Outfit Modal */}
      <Modal transparent visible={saveModalOpen} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save Outfit</Text>
            
            {existingCategories.length > 0 && (
              <>
                <Text style={styles.modalSubtext}>
                  Select an existing category
                </Text>
                <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
                  {existingCategories.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[
                        styles.categoryOption,
                        selectedExistingCategory === cat && styles.categoryOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedExistingCategory(cat);
                        setCustomCategoryName("");
                      }}
                    >
                      <Text style={[
                        styles.categoryOptionText,
                        selectedExistingCategory === cat && styles.categoryOptionTextSelected
                      ]}>
                        {cat}
                      </Text>
                      <Text style={styles.categoryOptionCount}>
                        {savedOutfits[cat].length} outfits
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                
                <Text style={styles.orText}>OR</Text>
              </>
            )}
            
            <Text style={styles.modalSubtext}>
              Create a new category
            </Text>
            <TextInput
              placeholder="e.g., Casual, Work, Party"
              value={customCategoryName}
              onChangeText={(text) => {
                setCustomCategoryName(text);
                if (text.trim()) {
                  setSelectedExistingCategory(null);
                }
              }}
              style={styles.newCategoryInput}
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setSaveModalOpen(false);
                  setCustomCategoryName("");
                  setSelectedExistingCategory(null);
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={confirmSaveOutfit} style={styles.modalSubmitBtn}>
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
    backgroundColor: "#fafafa" 
  },
  builderWrapper: {
    flex: 1,
  },
  simpleHeader: {
    padding: 16,
    backgroundColor: "#fafafa",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  simpleHeaderTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  // Collage Mode Styles
  collageWrapper: {
    flex: 1,
  },
  collageCanvas: {
    height: 400,
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    position: "relative",
    overflow: "hidden",
  },
  collageEmptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  collageEmptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#999",
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
  itemsScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 150,
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
  // Model Mode Styles
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
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
    color: "#666", 
    marginTop: 8 
  },
  emptySubtext: { 
    fontSize: 14, 
    color: "#999", 
    marginTop: 4 
  },
  listContent: { 
    padding: 16, 
    paddingBottom: 150 
  },
  categoryContainer: {
    backgroundColor: "#fff",
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
    color: "#1a1a1a" 
  },
  categoryCount: { 
    fontSize: 13, 
    color: "#999", 
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
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderColor: "transparent",
    gap: 12,
  },
  saveButton: {
    backgroundColor: "#1a1a1a",
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
    color: "#fff", 
    fontWeight: "700", 
    fontSize: 16 
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
    flex: 1,
    justifyContent: "center",
  },
  viewButtonText: { 
    fontWeight: "700", 
    color: "#1a1a1a", 
    fontSize: 16 
  },
  outfitCard: {
    width: "48%",
    margin: "1%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eee",
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
  cardLabel: {
    fontSize: 12,
    color: "#777",
    marginBottom: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#fff",
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
    color: "#666", 
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
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  categoryOptionSelected: {
    backgroundColor: "#e6f2ff",
    borderColor: "#1a1a1a",
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  categoryOptionTextSelected: {
    color: "#1a1a1a",
    fontWeight: "700",
  },
  categoryOptionCount: {
    fontSize: 12,
    color: "#999",
  },
  orText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#999",
    marginVertical: 12,
  },
  newCategoryInput: {
    borderWidth: 1.5,
    borderColor: "#ddd",
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
    backgroundColor: "#f0f0f0",
    flex: 1,
    alignItems: "center",
  },
  modalSubmitBtn: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#1a1a1a",
    flex: 1,
    alignItems: "center",
  },
  modalBtnText: { 
    color: "#666", 
    fontWeight: "600", 
    fontSize: 16 
  },
  modalBtnTextPrimary: { 
    color: "#fff", 
    fontWeight: "700", 
    fontSize: 16 
  },
});
