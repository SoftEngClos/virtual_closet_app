import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useCloset } from "../ClosetProvider";

const CATEGORIES = ["Tops", "Bottoms", "Shoes", "Accessories"];

function TagChips({
  tags,
  onRemove,
}: {
  tags: string[] | undefined;
  onRemove: (t: string) => void;
}) {
  return (
    <View style={styles.tagsRow}>
      {(tags || []).map((t) => (
        <Pressable key={t} onLongPress={() => onRemove(t)} style={styles.chip}>
          <Text style={styles.chipText}>#{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const ClosetScreen = () => {
  const {
    closet,
    storages,
    addItem,
    removeItem,
    addTag,
    removeTag,
    updateItemDetails,
    uploadImageToStorage,
    addStorage,
    deleteStorage,
    renameStorage,
    addItemToStorage,
    removeItemFromStorage,
  } = useCloset();

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Combined details modal states
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<{ id: string; category: string } | null>(null);
  const [tagText, setTagText] = useState("");
  const [brandText, setBrandText] = useState("");
  const [priceText, setPriceText] = useState("");
  const [currentTags, setCurrentTags] = useState<string[]>([]);

  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [storageName, setStorageName] = useState("");
  const [selectedStorage, setSelectedStorage] = useState(storages[0]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItemForStorage, setSelectedItemForStorage] = useState<string | null>(null);
  const [selectedCategoryForStorage, setSelectedCategoryForStorage] = useState("");
  const [storageActionModal, setStorageActionModal] = useState(false);
  const [editStorageName, setEditStorageName] = useState("");
  const [editingStorageId, setEditingStorageId] = useState<string | null>(null);

  // Update selectedStorage when storages change - FIXED
  useEffect(() => {
    if (storages.length > 0) {
      if (selectedStorage) {
        // Find and update the currently selected storage
        const updatedSelectedStorage = storages.find(s => s.id === selectedStorage.id);
        if (updatedSelectedStorage) {
          setSelectedStorage(updatedSelectedStorage);
        } else {
          // If selected storage was deleted, select first one
          setSelectedStorage(storages[0]);
        }
      } else {
        // No storage selected, select first one
        setSelectedStorage(storages[0]);
      }
    }
  }, [storages]);

  const openDetailsModal = (id: string, category: string) => {
    const item = closet[category]?.find((i) => i.id === id);
    setDetailsTarget({ id, category });
    setBrandText(item?.brand || "");
    setPriceText(item?.price?.toString() || "");
    setCurrentTags(item?.tags || []);
    setTagText("");
    setDetailsModalOpen(true);
  };

  const addTagToList = () => {
    if (tagText.trim() && !currentTags.includes(tagText.trim())) {
      setCurrentTags([...currentTags, tagText.trim()]);
      setTagText("");
    }
  };

  const removeTagFromList = (tag: string) => {
    setCurrentTags(currentTags.filter(t => t !== tag));
  };

  const submitDetails = async () => {
    if (!detailsTarget) return;

    try {
      const price = priceText.trim() ? parseFloat(priceText) : undefined;
      const brand = brandText.trim() || undefined;

      // Update brand and price
      await updateItemDetails(detailsTarget.id, detailsTarget.category, {
        brand,
        price,
      });

      // Get current item tags
      const item = closet[detailsTarget.category]?.find((i) => i.id === detailsTarget.id);
      const oldTags = item?.tags || [];

      // Add new tags
      const tagsToAdd = currentTags.filter(t => !oldTags.includes(t));
      for (const tag of tagsToAdd) {
        await addTag(detailsTarget.id, detailsTarget.category, tag);
      }

      // Remove deleted tags
      const tagsToRemove = oldTags.filter(t => !currentTags.includes(t));
      for (const tag of tagsToRemove) {
        await removeTag(detailsTarget.id, detailsTarget.category, tag);
      }

      setDetailsModalOpen(false);
      setBrandText("");
      setPriceText("");
      setTagText("");
      setCurrentTags([]);
      setDetailsTarget(null);
    } catch (error) {
      console.error("Error updating details:", error);
      Alert.alert("Error", "Failed to update item details.");
    }
  };

  const pickImage = async (category: string, fromCamera: boolean) => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Please grant media library permissions");
          return;
        }
      }

      let result;
      if (fromCamera) {
        if (Platform.OS !== "web") {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission Required", "Please grant camera permissions");
            return;
          }
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: true,
          quality: 0.8,
          exif: false,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: true,
          quality: 0.8,
          exif: false,
        });
      }

      if (!result.canceled && result.assets.length > 0) {
        setUploading(true);
        
        try {
          console.log("Selected image URI:", result.assets[0].uri);
          
          const downloadURL = await uploadImageToStorage(
            result.assets[0].uri,
            category
          );

          console.log("Got download URL:", downloadURL);

          await addItem({
            uri: downloadURL,
            category,
            tags: [],
          });

          Alert.alert("Success", "Item added to your closet!");
        } catch (error: any) {
          console.error("Error uploading:", error);
          Alert.alert("Error", error.message || "Failed to upload image. Please try again.");
        } finally {
          setUploading(false);
        }
      }
    } catch (err: any) {
      console.error("Error picking image:", err);
      Alert.alert("Error", "Failed to pick image. Please try again.");
      setUploading(false);
    }
  };

  const handleRemoveItem = async (itemId: string, category: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to remove this item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await removeItem(itemId, category);
              Alert.alert("Success", "Item deleted.");
            } catch (error: any) {
              console.error("Error deleting item:", error);
              Alert.alert("Error", "Failed to delete item. Please try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const showImageMenu = (itemId: string, category: string) => {
    Alert.alert("Options", "Choose an action", [
      {
        text: "Add to Storage",
        onPress: () => {
          setSelectedItemForStorage(itemId);
          setSelectedCategoryForStorage(category);
          setItemModalOpen(true);
        },
      },
      {
        text: "Remove Item",
        onPress: () => handleRemoveItem(itemId, category),
        style: "destructive",
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleAddStorage = () => {
    if (storageName.trim()) {
      addStorage(storageName.trim());
      setStorageName("");
      setStorageModalOpen(false);
    }
  };

  const handleAddItemToStorage = async (storageId: string, itemId: string, category: string) => {
    try {
      await addItemToStorage(storageId, itemId, category);
      
      // The storages state will update via the useEffect
      setItemModalOpen(false);
      setSelectedItemForStorage(null);
      setSelectedCategoryForStorage("");
      Alert.alert("Success", "Item added to storage!");
    } catch (error) {
      console.error("Error adding item to storage:", error);
      Alert.alert("Error", "Failed to add item to storage.");
    }
  };

  const handleStorageLongPress = (storage: any) => {
    setEditingStorageId(storage.id);
    setEditStorageName(storage.name);
    setStorageActionModal(true);
  };

  const handleRenameStorage = () => {
    if (editStorageName.trim() && editingStorageId) {
      renameStorage(editingStorageId, editStorageName.trim());
      setStorageActionModal(false);
      setEditingStorageId(null);
      setEditStorageName("");
    }
  };

  const handleDeleteStorage = () => {
    if (storages.length === 1) {
      Alert.alert("Cannot Delete", "You must have at least one storage.");
      return;
    }
    
    if (editingStorageId) {
      const storageToDelete = storages.find(s => s.id === editingStorageId);
      const itemCount = storageToDelete?.items.length || 0;
      
      Alert.alert(
        "Confirm Delete",
        itemCount > 0 
          ? `Delete this storage and all ${itemCount} items inside?`
          : "Delete this storage?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setDeleting(true);
              setStorageActionModal(false);
              try {
                await deleteStorage(editingStorageId);
                Alert.alert("Success", "Storage deleted.");
              } catch (error) {
                console.error("Error deleting storage:", error);
                Alert.alert("Error", "Failed to delete storage. Please try again.");
              } finally {
                setDeleting(false);
                setEditingStorageId(null);
                setEditStorageName("");
              }
            },
          },
        ]
      );
    }
  };

  const getItemFromCloset = (itemId: string, category: string) => {
    return closet[category]?.find((item) => item.id === itemId);
  };

  return (
    <View style={styles.container}>
      {(uploading || deleting) && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingCard}>
            <ActivityIndicator size="large" color="#0066ff" />
            <Text style={styles.uploadingText}>
              {uploading ? "Uploading..." : "Deleting..."}
            </Text>
          </View>
        </View>
      )}

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* TOP HALF - ITEMS BY CATEGORY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Items</Text>

          {CATEGORIES.map((category) => (
            <View key={category} style={styles.categoryContainer}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>{category}</Text>
                <Text style={styles.itemCount}>
                  {closet[category]?.length || 0}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.flex1]}
                  onPress={() => pickImage(category, true)}
                  disabled={uploading || deleting}
                >
                  <Text style={styles.buttonText}>Take Picture</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.flex1]}
                  onPress={() => pickImage(category, false)}
                  disabled={uploading || deleting}
                >
                  <Text style={styles.buttonText}>Add from Gallery</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={closet[category] || []}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.itemCard}>
                    <TouchableOpacity
                      onPress={() => openDetailsModal(item.id, category)}
                      onLongPress={() => showImageMenu(item.id, category)}
                      style={styles.imageWrapper}
                    >
                      <Image 
                        source={{ uri: item.uri }} 
                        style={styles.image}
                      />
                      {(item.brand || item.price) && (
                        <View style={styles.itemBadge}>
                          {item.brand && (
                            <Text style={styles.badgeText}>{item.brand}</Text>
                          )}
                          {item.price && (
                            <Text style={styles.badgePrice}>${item.price}</Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                    <TagChips
                      tags={item.tags}
                      onRemove={(t) => removeTag(item.id, category, t)}
                    />
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No items yet</Text>
                  </View>
                }
              />
            </View>
          ))}
        </View>

        {/* BOTTOM HALF - STORAGE MANAGEMENT */}
        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.storageHeader}>
            <Text style={styles.sectionTitle}>Storage</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setStorageModalOpen(true)}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {storages.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.storageScrollView}
            >
              {storages.map((storage) => (
                <Pressable
                  key={storage.id}
                  onPress={() => setSelectedStorage(storage)}
                  onLongPress={() => handleStorageLongPress(storage)}
                  style={[
                    styles.storageCard,
                    selectedStorage?.id === storage.id && styles.storageCardActive,
                  ]}
                >
                  <Text style={styles.storageCardName}>{storage.name}</Text>
                  <Text style={styles.storageCardCount}>{storage.items.length} items</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {selectedStorage && (
            <View style={styles.storageContent}>
              <View style={styles.storageContentHeader}>
                <View>
                  <Text style={styles.storageContentTitle}>
                    {selectedStorage.name}
                  </Text>
                  <Text style={styles.storageContentSubtitle}>
                    {selectedStorage.items.length} items stored
                  </Text>
                </View>
              </View>

              {selectedStorage.items.length > 0 ? (
                <View style={styles.storedItemsGrid}>
                  {selectedStorage.items.map((storedItem, index) => {
                    const item = getItemFromCloset(
                      storedItem.itemId,
                      storedItem.category
                    );
                    if (!item) return null;

                    return (
                      <View key={index} style={styles.storedItemCard}>
                        <Image source={{ uri: item.uri }} style={styles.storedImage} />
                        <View style={styles.storedItemInfo}>
                          <Text style={styles.storedItemCategory}>
                            {storedItem.category}
                          </Text>
                          {item.brand && (
                            <Text style={styles.storedItemBrand}>{item.brand}</Text>
                          )}
                          {item.price && (
                            <Text style={styles.storedItemPrice}>${item.price}</Text>
                          )}
                          <TouchableOpacity
                            onPress={() =>
                              removeItemFromStorage(selectedStorage.id, storedItem.itemId)
                            }
                            style={styles.removeButton}
                          >
                            <Text style={styles.removeButtonText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyStorageState}>
                  <Text style={styles.emptyStorageText}>Empty storage</Text>
                  <Text style={styles.emptyStorageSubtext}>
                    Add items from above to organize them here
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Combined Details Modal (Tags, Brand, Price) */}
      <Modal
        transparent
        visible={detailsModalOpen}
        animationType="fade"
        onRequestClose={() => setDetailsModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailsModalCard}>
            <Text style={styles.modalTitle}>Item Details</Text>
            
            {/* Tags Section */}
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Tags</Text>
              <View style={styles.tagInputRow}>
                <TextInput
                  value={tagText}
                  onChangeText={setTagText}
                  placeholder="Add tag (e.g., casual, summer)"
                  style={styles.tagInput}
                  onSubmitEditing={addTagToList}
                />
                <TouchableOpacity 
                  style={styles.addTagButton}
                  onPress={addTagToList}
                >
                  <Text style={styles.addTagButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tagsRow}>
                {currentTags.map((tag) => (
                  <Pressable 
                    key={tag} 
                    onPress={() => removeTagFromList(tag)}
                    style={styles.modalChip}
                  >
                    <Text style={styles.modalChipText}>#{tag}</Text>
                    <Text style={styles.removeChipIcon}> ✕</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.detailsDivider} />

            {/* Brand Section */}
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Brand</Text>
              <TextInput
                value={brandText}
                onChangeText={setBrandText}
                placeholder="e.g., Nike, Zara, H&M"
                style={styles.input}
              />
            </View>

            {/* Price Section */}
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Price</Text>
              <TextInput
                value={priceText}
                onChangeText={setPriceText}
                placeholder="e.g., 49.99"
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => {
                  setDetailsModalOpen(false);
                  setBrandText("");
                  setPriceText("");
                  setTagText("");
                  setCurrentTags([]);
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitDetails} style={styles.modalSubmitBtn}>
                <Text style={styles.modalBtnTextPrimary}>Save All</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Storage Modal */}
      <Modal
        transparent
        visible={storageModalOpen}
        animationType="fade"
        onRequestClose={() => setStorageModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Storage</Text>
            <TextInput
              value={storageName}
              onChangeText={setStorageName}
              placeholder="e.g., My grey bin, Drawer 2"
              autoFocus
              style={styles.input}
              onSubmitEditing={handleAddStorage}
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setStorageModalOpen(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleAddStorage} style={styles.modalSubmitBtn}>
                <Text style={styles.modalBtnTextPrimary}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Item to Storage Modal */}
      <Modal
        transparent
        visible={itemModalOpen}
        animationType="fade"
        onRequestClose={() => setItemModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Storage</Text>
            <Text style={styles.modalSubtitle}>
              Choose where to store this item
            </Text>
            <View style={styles.storageOptions}>
              {storages.map((storage) => (
                <TouchableOpacity
                  key={storage.id}
                  style={styles.storageOption}
                  onPress={() =>
                    handleAddItemToStorage(
                      storage.id,
                      selectedItemForStorage!,
                      selectedCategoryForStorage
                    )
                  }
                >
                  <Text style={styles.storageOptionName}>{storage.name}</Text>
                  <Text style={styles.storageOptionCount}>
                    {storage.items.length} items
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Pressable
              onPress={() => setItemModalOpen(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Storage Action Modal */}
      <Modal
        transparent
        visible={storageActionModal}
        animationType="fade"
        onRequestClose={() => setStorageActionModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Storage Options</Text>
            <TextInput
              value={editStorageName}
              onChangeText={setEditStorageName}
              placeholder="Storage name"
              style={styles.input}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={handleRenameStorage}
                style={styles.modalSubmitBtn}
              >
                <Text style={styles.modalBtnTextPrimary}>Rename</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteStorage}
                style={styles.modalDeleteBtn}
              >
                <Text style={styles.modalBtnTextDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
            <Pressable
              onPress={() => setStorageActionModal(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  scrollContent: {
    paddingBottom: 100,
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  uploadingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
    gap: 15,
  },
  uploadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  categoryContainer: {
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  itemCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    backgroundColor: "#f0f2f5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  flex1: {
    flex: 1,
  },
  actionButton: {
    backgroundColor: "#0066ff",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#0066ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  itemCard: {
    width: 115,
    marginRight: 10,
    marginBottom: 8,
  },
  imageWrapper: {
    marginBottom: 8,
    position: "relative",
  },
  image: {
    width: 115,
    height: 115,
    borderRadius: 12,
    backgroundColor: "#e8ecf1",
  },
  itemBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 6,
    padding: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  badgePrice: {
    fontSize: 10,
    fontWeight: "600",
    color: "#4ade80",
    textAlign: "center",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },
  chip: {
    backgroundColor: "#f0f2f5",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    marginBottom: 2,
  },
  chipText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#e8ecf1",
    marginVertical: 8,
  },
  storageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  addButton: {
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  storageScrollView: {
    marginBottom: 14,
  },
  storageCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: "#f0f0f0",
    minWidth: 125,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  storageCardActive: {
    borderColor: "#0066ff",
    backgroundColor: "#f0f7ff",
    shadowColor: "#0066ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  storageCardName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  storageCardCount: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  storageContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  storageContentHeader: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f7fa",
  },
  storageContentTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1a1a1a",
  },
  storageContentSubtitle: {
    fontSize: 13,
    color: "#999",
    marginTop: 3,
    fontWeight: "500",
  },
  storedItemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  storedItemCard: {
    width: "31%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  storedImage: {
    width: "100%",
    height: 90,
    backgroundColor: "#e8ecf1",
  },
  storedItemInfo: {
    padding: 8,
  },
  storedItemCategory: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0066ff",
    marginBottom: 4,
  },
  storedItemBrand: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
    marginBottom: 2,
  },
  storedItemPrice: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10b981",
    marginBottom: 4,
  },
  removeButton: {
    backgroundColor: "#ffe6e6",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 4,
  },
  removeButtonText: {
    fontSize: 12,
    color: "#d32f2f",
    fontWeight: "700",
  },
  emptyStorageState: {
    paddingVertical: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyStorageText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#999",
    marginBottom: 5,
  },
  emptyStorageSubtext: {
    fontSize: 13,
    color: "#bbb",
    fontWeight: "500",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  detailsModalCard: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tagInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1a1a1a",
    fontWeight: "500",
  },
  addTagButton: {
    backgroundColor: "#0066ff",
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  addTagButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  modalChip: {
    backgroundColor: "#0066ff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  modalChipText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  removeChipIcon: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
    marginLeft: 4,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: "#e8ecf1",
    marginVertical: 12,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1a1a1a",
    fontWeight: "500",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#f5f7fa",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e8ecf1",
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: "#0066ff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#0066ff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  modalDeleteBtn: {
    flex: 1,
    backgroundColor: "#ff4757",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#ff4757",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#666",
  },
  modalBtnTextPrimary: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
  modalBtnTextDelete: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
  storageOptions: {
    marginVertical: 14,
    gap: 10,
  },
  storageOption: {
    backgroundColor: "#f8fafc",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e8ecf1",
  },
  storageOptionName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 3,
  },
  storageOptionCount: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
});

export default ClosetScreen;
