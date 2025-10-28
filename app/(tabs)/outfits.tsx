import React, { useState, useEffect } from "react";
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

type OutfitItem = { category: string; uri: string; slotIndex: number };
type SavedOutfit = { id: string; outfit: OutfitItem[]; category: string };
type OutfitCategories = Record<string, SavedOutfit[]>;
type Slot = { category: string | null; index: number };

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
      console.log("Saving outfit with slot positions:", outfit);
      
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
    const currentOutfitItems: OutfitItem[] = [];
    
    slots.forEach((slot, slotIndex) => {
      if (slot.category && closet[slot.category]?.length) {
        currentOutfitItems.push({
          category: slot.category,
          uri: closet[slot.category][slot.index].uri,
          slotIndex: slotIndex,
        });
      }
    });

    if (currentOutfitItems.length === 0) {
      return Alert.alert("Empty Outfit", "Please add items to save an outfit.");
    }

    console.log("Current outfit items with slots:", currentOutfitItems);

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

    const outfitItems: OutfitItem[] = [];
    
    slots.forEach((slot, slotIndex) => {
      if (slot.category && closet[slot.category]?.length) {
        outfitItems.push({
          category: slot.category,
          uri: closet[slot.category][slot.index].uri,
          slotIndex: slotIndex,
        });
      }
    });

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
    console.log("Loading outfit:", outfit.outfit);
    
    // Initialize all slots as empty
    const newSlots: Slot[] = Array(5)
      .fill(null)
      .map(() => ({ category: null, index: 0 }));
    
    // Place each item in its saved slot position
    outfit.outfit.forEach((piece, pieceIndex) => {
      // Use slotIndex if available, otherwise fall back to pieceIndex for old outfits
      const targetSlot = piece.slotIndex !== undefined ? piece.slotIndex : pieceIndex;
      
      console.log(`Placing ${piece.category} in slot ${targetSlot}`);
      
      if (targetSlot >= 0 && targetSlot < 5) {
        const items = closet[piece.category];
        if (items && items.length > 0) {
          const itemIndex = items.findIndex((it) => it.uri === piece.uri);
          newSlots[targetSlot] = { 
            category: piece.category, 
            index: itemIndex >= 0 ? itemIndex : 0 
          };
          console.log(`Successfully placed ${piece.category} at slot ${targetSlot}`);
        } else {
          console.log(`No items found for category ${piece.category}`);
        }
      }
    });
    
    console.log("Final slots:", newSlots);
    setSlots(newSlots);
    setShowLibrary(false);
    Alert.alert("Outfit Loaded", "Your outfit has been loaded to the builder!");
  };

  const clearOutfit = () => {
    Alert.alert("Clear Outfit", "Remove all items from the outfit?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => setSlots(Array(5).fill(null).map(() => ({ category: null, index: 0 }))),
      },
    ]);
  };

  const existingCategories = Object.keys(savedOutfits);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
          <View style={styles.builderHeader}>
            <Text style={styles.builderTitle}>Outfit Builder</Text>
            <TouchableOpacity onPress={clearOutfit}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>

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
          </ScrollView>

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

// ... rest of the styles remain the same
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fafafa" 
  },
  builderWrapper: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  emptyState: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 32 
  },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#666", marginTop: 8 },
  emptySubtext: { fontSize: 14, color: "#999", marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 32 },
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
  categoryTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  categoryCount: { fontSize: 13, color: "#999", marginTop: 2 },
  outfitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  builderHeader: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  builderTitle: { fontSize: 24, fontWeight: "700" },
  clearText: { fontSize: 16, color: "#ff4757", fontWeight: "600" },
  builderContent: { 
    flexGrow: 1, 
    alignItems: "center", 
    paddingVertical: 20,
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
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#eee",
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
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
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
  viewButtonText: { fontWeight: "700", color: "#1a1a1a", fontSize: 16 },
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
  thumbnail: { width: 60, height: 60, borderRadius: 6 },
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
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 12 },
  modalSubtext: { fontSize: 14, color: "#666", marginBottom: 12, fontWeight: "600" },
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
  modalBtnText: { color: "#666", fontWeight: "600", fontSize: 16 },
  modalBtnTextPrimary: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
