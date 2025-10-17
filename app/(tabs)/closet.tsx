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
    uploadImageToStorage,
    addStorage,
    deleteStorage,
    renameStorage,
    addItemToStorage,
    removeItemFromStorage,
  } = useCloset();

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagText, setTagText] = useState("");
  const [target, setTarget] = useState<{ id: string; category: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [storageName, setStorageName] = useState("");
  const [selectedStorage, setSelectedStorage] = useState(storages[0]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItemForStorage, setSelectedItemForStorage] = useState<string | null>(null);
  const [selectedCategoryForStorage, setSelectedCategoryForStorage] = useState("");
  const [storageActionModal, setStorageActionModal] = useState(false);
  const [editStorageName, setEditStorageName] = useState("");
  const [editingStorageId, setEditingStorageId] = useState<string | null>(null);

  // Update selectedStorage when storages change
  useEffect(() => {
    if (storages.length > 0 && !storages.find(s => s.id === selectedStorage?.id)) {
      setSelectedStorage(storages[0]);
    } else if (storages.length > 0 && !selectedStorage) {
      setSelectedStorage(storages[0]);
    }
  }, [storages]);

  const openTagModal = (id: string, category: string) => {
    setTarget({ id, category });
    setTagText("");
    setTagModalOpen(true);
  };

  const submitTag = () => {
    if (target && tagText.trim()) {
      addTag(target.id, target.category, tagText.trim());
    }
    setTagModalOpen(false);
    setTagText("");
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
          allowsEditing: true,
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: true,
          quality: 0.8,
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
        } catch (error) {
          console.error("Error uploading:", error);
          Alert.alert("Error", "Failed to upload image. Please try again.");
        } finally {
          setUploading(false);
        }
      }
    } catch (err) {
      console.error("Error picking image:", err);
      Alert.alert("Error", "Failed to pick image. Please try again.");
      setUploading(false);
    }
  };

  const showImageMenu = (itemId: string, category: string) => {
    Alert.alert("Options", "Choose an action", [
      {
        text: "Add Tag",
        onPress: () => openTagModal(itemId, category),
      },
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
        onPress: () => {
          Alert.alert(
            "Confirm Delete",
            "Are you sure you want to remove this item?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => removeItem(itemId, category),
              },
            ]
          );
        },
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

  const handleAddItemToStorage = (storageId: string, itemId: string, category: string) => {
    addItemToStorage(storageId, itemId, category);
    setItemModalOpen(false);
    setSelectedItemForStorage(null);
    setSelectedCategoryForStorage("");
    Alert.alert("Success", "Item added to storage!");
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
      deleteStorage(editingStorageId);
      setStorageActionModal(false);
      setEditingStorageId(null);
      setEditStorageName("");
    }
  };

  const getItemFromCloset = (itemId: string, category: string) => {
    return closet[category]?.find((item) => item.id === itemId);
  };

  return (
    <View style={styles.container}>
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingCard}>
            <ActivityIndicator size="large" color="#0066ff" />
            <Text style={styles.uploadingText}>Uploading image...</Text>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
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
                  disabled={uploading}
                >
                  <Text style={styles.buttonText}>Take Picture</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.flex1]}
                  onPress={() => pickImage(category, false)}
                  disabled={uploading}
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
                      onPress={() => openTagModal(item.id, category)}
                      onLongPress={() => showImageMenu(item.id, category)}
                      style={styles.imageWrapper}
                    >
                      <Image source={{ uri: item.uri }} style={styles.image} />
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

          {/* Storage List */}
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

          {/* Selected Storage Content */}
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

      {/* Tag Modal */}
      <Modal
        transparent
        visible={tagModalOpen}
        animationType="fade"
        onRequestClose={() => setTagModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add a tag</Text>
            <TextInput
              value={tagText}
              onChangeText={setTagText}
              placeholder="e.g., casual, summer"
              autoFocus
              style={styles.input}
              onSubmitEditing={submitTag}
            />
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setTagModalOpen(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitTag} style={styles.modalSubmitBtn}>
                <Text style={styles.modalBtnTextPrimary}>Add</Text>
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
  },
  image: {
    width: 115,
    height: 115,
    borderRadius: 12,
    backgroundColor: "#e8ecf1",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
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
    marginBottom: 7,
  },
  removeButton: {
    backgroundColor: "#ffe6e6",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 8,
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
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 4,
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
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#f5f7fa",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e8ecf1",
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: "#0066ff",
    paddingVertical: 12,
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
    paddingVertical: 12,
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
