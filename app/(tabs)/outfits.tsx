import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  FlatList, // Changed from SectionList back to FlatList for the accordion
  Alert,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCloset } from "../ClosetProvider";

// Types remain the same
type OutfitItem = { category: string; uri: string };
type SavedOutfit = { id: string; outfit: OutfitItem[] };
type OutfitCategories = Record<string, SavedOutfit[]>;
type Slot = { category: string | null; index: number };

const DEFAULT_CATEGORY = "Uncategorized"; // NEW: Default category constant

export default function OutfitsScreen() {
  const { closet } = useCloset();
  const allClosetCategories = Object.keys(closet);

  const [slots, setSlots] = useState<Slot[]>(
    Array(4).fill({ category: null, index: 0 })
  );
  const [savedOutfits, setSavedOutfits] = useState<OutfitCategories>({});
  const [showLibrary, setShowLibrary] = useState(false);
  // NEW: State to track which category is expanded
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadOutfits();
  }, []);

  // This function remains the same
  const persistOutfits = async (newOutfits: OutfitCategories) => {
    try {
      await AsyncStorage.setItem("savedOutfits", JSON.stringify(newOutfits));
      setSavedOutfits(newOutfits);
    } catch (err) {
      console.error("Failed to save outfits", err);
    }
  };
  
  // This function remains the same
  const addOutfitToCategory = (outfit: SavedOutfit, category: string) => {
    const newOutfits = { ...savedOutfits };
    if (!newOutfits[category]) {
        newOutfits[category] = [];
    }
    newOutfits[category].push(outfit);
    persistOutfits(newOutfits);
    Alert.alert("Success", `Outfit saved to "${category}"!`);
  };

  // MODIFIED: saveOutfit is now much simpler
  const saveOutfit = async () => {
    const currentOutfitItems = slots
      .filter((s) => s.category && closet[s.category]?.length)
      .map((slot) => {
        const item = closet[slot.category!][slot.index];
        return { category: slot.category!, uri: item.uri };
      });

    if (currentOutfitItems.length === 0) {
      return Alert.alert("Empty Outfit", "Please add items to save an outfit.");
    }
    
    const newSavedOutfit: SavedOutfit = {
        id: Date.now().toString(),
        outfit: currentOutfitItems
    };
    
    // Automatically add to the default category without asking the user
    addOutfitToCategory(newSavedOutfit, DEFAULT_CATEGORY);
  };
  
  // All other helper functions (pickCategory, nextItem, prevItem, loadOutfits,
  // loadOutfitToModel, handleOutfitLongPress, etc.) remain the same as before.
  // ... (keeping them hidden here for brevity, but they are in the full code below)
    const pickCategory = (slotIndex: number) => {
        Alert.alert(
        "Choose Category",
        null,
        allClosetCategories.map((cat) => ({
            text: cat,
            onPress: () => {
            const newSlots = [...slots];
            newSlots[slotIndex] = { category: cat, index: 0 };
            setSlots(newSlots);
            },
        }))
        );
    };

    const nextItem = (slotIndex: number) => {
        const slot = slots[slotIndex];
        if (!slot.category) return;
        const items = closet[slot.category];
        if (!items || !items.length) return;
        const newIndex = (slot.index + 1) % items.length;
        const newSlots = [...slots];
        newSlots[slotIndex].index = newIndex;
        setSlots(newSlots);
    };

    const prevItem = (slotIndex: number) => {
        const slot = slots[slotIndex];
        if (!slot.category) return;
        const items = closet[slot.category];
        if (!items || !items.length) return;
        const newIndex = (slot.index - 1 + items.length) % items.length;
        const newSlots = [...slots];
        newSlots[slotIndex].index = newIndex;
        setSlots(newSlots);
    };
    
    const createNewCategoryAndAdd = (outfit: SavedOutfit) => {
        Alert.prompt("New Category", "Enter a name for your new category:", (newCategoryName) => {
            if (newCategoryName) {
                addOutfitToCategory(outfit, newCategoryName);
            }
        });
    };

    const loadOutfits = async () => {
        try {
        const existing = await AsyncStorage.getItem("savedOutfits");
        if (existing) setSavedOutfits(JSON.parse(existing));
        } catch (err) {
        console.error(err);
        }
    };

    const loadOutfitToModel = (outfit: SavedOutfit) => {
        const newSlots: Slot[] = Array(4).fill({ category: null, index: 0 });
        outfit.outfit.forEach((piece, i) => {
        const items = closet[piece.category];
        const index = items.findIndex((it) => it.uri === piece.uri);
        if (i < newSlots.length) {
            newSlots[i] = {
            category: piece.category,
            index: index >= 0 ? index : 0,
            };
        }
        });
        setSlots(newSlots);
        setShowLibrary(false);
    };
    
    const handleOutfitLongPress = (outfit: SavedOutfit, category: string) => {
        Alert.alert(
            "Outfit Options",
            "How would you like to organize this outfit?",
            [
                { text: "Favorite (Move to Top)", onPress: () => favoriteOutfit(outfit, category) },
                { text: "Move to Category", onPress: () => moveOutfit(outfit, category) },
                { text: "Create New Category...", onPress: () => createNewCategoryAndMove(outfit, category) },
                { text: "Remove Outfit", style: "destructive", onPress: () => removeOutfit(outfit, category) },
                { text: "Cancel", style: "cancel" },
            ]
        )
    };

    const favoriteOutfit = (outfit: SavedOutfit, category: string) => {
        const newOutfits = { ...savedOutfits };
        const categoryOutfits = newOutfits[category].filter(o => o.id !== outfit.id);
        categoryOutfits.unshift(outfit);
        newOutfits[category] = categoryOutfits;
        persistOutfits(newOutfits);
    };
    
    const removeOutfit = (outfit: SavedOutfit, category: string) => {
        const newOutfits = { ...savedOutfits };
        newOutfits[category] = newOutfits[category].filter(o => o.id !== outfit.id);
        if (newOutfits[category].length === 0) {
            delete newOutfits[category];
        }
        persistOutfits(newOutfits);
    };

    const moveOutfit = (outfit: SavedOutfit, oldCategory: string) => {
        const otherCategories = Object.keys(savedOutfits).filter(c => c !== oldCategory);
        if(otherCategories.length === 0) {
            return Alert.alert("No other categories", "Create a new category to move this outfit.");
        }
        const buttons = otherCategories.map(cat => ({
            text: cat,
            onPress: () => {
                const newOutfits = { ...savedOutfits };
                newOutfits[oldCategory] = newOutfits[oldCategory].filter(o => o.id !== outfit.id);
                if (newOutfits[oldCategory].length === 0) delete newOutfits[oldCategory];
                if (!newOutfits[cat]) newOutfits[cat] = [];
                newOutfits[cat].push(outfit);
                persistOutfits(newOutfits);
            }
        }));
        buttons.push({text: "Cancel", style: "cancel"});
        Alert.alert("Move to...", "Select a new category for this outfit.", buttons);
    };

    const createNewCategoryAndMove = (outfit: SavedOutfit, oldCategory: string) => {
        Alert.prompt("New Category", "Enter a name for the new category:", (newCategoryName) => {
            if (newCategoryName) {
                const newOutfits = { ...savedOutfits };
                newOutfits[oldCategory] = newOutfits[oldCategory].filter(o => o.id !== outfit.id);
                if (newOutfits[oldCategory].length === 0) delete newOutfits[oldCategory];

                if (!newOutfits[newCategoryName]) newOutfits[newCategoryName] = [];
                newOutfits[newCategoryName].push(outfit);
                persistOutfits(newOutfits);
            }
        });
    };
  // END of hidden functions

  return (
    <View style={styles.container}>
      {showLibrary ? (
        <>
          <View style={styles.headerRow}>
            <Pressable onPress={() => setShowLibrary(false)}>
              <Ionicons name="arrow-back" size={28} color="#111" />
            </Pressable>
            <Text style={styles.title}>My Saved Outfits</Text>
          </View>

          {Object.keys(savedOutfits).length === 0 ? (
            <Text style={{ marginTop: 20 }}>No saved outfits yet.</Text>
          ) : (
            // MODIFIED: Replaced SectionList with a FlatList to create the accordion
            <FlatList
              data={Object.keys(savedOutfits)}
              keyExtractor={(category) => category}
              renderItem={({ item: category }) => (
                <View style={styles.categoryContainer}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => {
                      // Toggle the expanded category
                      setExpandedCategory(expandedCategory === category ? null : category);
                    }}
                  >
                    <Text style={styles.categoryTitle}>{category}</Text>
                    <Ionicons
                      name={expandedCategory === category ? "chevron-down" : "chevron-forward"}
                      size={22}
                      color="#333"
                    />
                  </TouchableOpacity>

                  {/* Conditionally render the outfits if the category is expanded */}
                  {expandedCategory === category && (
                    <FlatList
                      data={savedOutfits[category]}
                      keyExtractor={(outfit) => outfit.id}
                      numColumns={2}
                      renderItem={({ item: outfit }) => (
                         <TouchableOpacity
                            style={styles.outfitCard}
                            onPress={() => loadOutfitToModel(outfit)}
                            onLongPress={() => handleOutfitLongPress(outfit, category)}
                          >
                          {Array.isArray(outfit.outfit) && outfit.outfit.map((piece, idx) =>
                              piece.uri && (
                              <Image
                                  key={`${outfit.id}-${idx}`}
                                  source={{ uri: piece.uri }}
                                  style={styles.thumbnail}
                                  resizeMode="contain"
                              />
                              )
                          )}
                          </TouchableOpacity>
                      )}
                    />
                  )}
                </View>
              )}
            />
          )}
        </>
      ) : (
        // The Outfit Builder part of the screen remains exactly the same
        <>
          <Text style={styles.title}>Outfit Builder</Text>
           <View style={styles.modelContainer}>
            <View style={styles.modelBody} />
            {slots.map((slot, i) => {
              if (!slot.category) {
                return (
                  <Pressable
                    key={i}
                    style={[styles.plusButton, { top: i * 110 + 40 }]}
                    onPress={() => pickCategory(i)}
                  >
                    <Ionicons name="add" size={28} color="#fff" />
                  </Pressable>
                );
              }
              const items = closet[slot.category];
              if (!items || !items.length) return null;
              const currentItem = items[slot.index];
              return (
                <View key={i} style={[styles.slotContainer, { top: i * 110 + 40 }]}>
                    <Pressable onPress={() => prevItem(i)} style={[styles.arrowButton, styles.leftArrow]}>
                        <Ionicons name="arrow-back-circle" size={32} color="#111" />
                    </Pressable>
                    <Image
                        source={{ uri: currentItem.uri }}
                        style={styles.overlayItem}
                        resizeMode="contain"
                    />
                    <Pressable onPress={() => nextItem(i)} style={[styles.arrowButton, styles.rightArrow]}>
                        <Ionicons name="arrow-forward-circle" size={32} color="#111" />
                    </Pressable>
                </View>
              );
            })}
          </View>
          <Pressable style={styles.saveButton} onPress={saveOutfit}>
            <Text style={styles.saveButtonText}>Save Outfit</Text>
          </Pressable>
          <Pressable style={styles.toggleButton} onPress={() => setShowLibrary(true)}>
            <Text style={styles.toggleText}>My Outfits</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// STYLES HAVE BEEN UPDATED
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, backgroundColor: "#fff" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  title: { fontSize: 22, fontWeight: "bold", marginLeft: 10 },
  modelContainer: {
    width: 260,
    height: 520,
    marginBottom: 20,
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  modelBody: {
    width: 120,
    height: 360,
    backgroundColor: "#ddd",
    borderRadius: 60,
    marginTop: 80,
  },
  slotContainer: {
    position: 'absolute',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayItem: { width: 140, height: 100 },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    zIndex: 10,
  },
  leftArrow: { left: 20 },
  rightArrow: { right: 20 },
  plusButton: {
    position: "absolute",
    alignSelf: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4B7BEC",
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#4B7BEC",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  toggleButton: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#111",
    borderRadius: 8,
  },
  toggleText: { color: "#fff", fontSize: 16 },
  
  // NEW STYLES for the accordion view
  categoryContainer: {
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 5,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  // Styles for outfit cards are slightly adjusted
  outfitCard: {
    flex: 1/2, // Allows for two columns
    backgroundColor: "#f9f9f9",
    margin: 8,
    padding: 5,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: '#eee',
    aspectRatio: 1, // Make them square
  },
  thumbnail: { width: 60, height: 60 },
});