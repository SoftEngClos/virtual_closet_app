import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
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
import { Image } from "expo-image";

const CATEGORIES = ["Tops", "Bottoms", "Shoes", "Accessories"];

// -------------------------
// Tag Chips Component
// -------------------------
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

// -------------------------
// MAIN CLOSET SCREEN
// -------------------------
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
    availableTags,
  } = useCloset();

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<{ id: string; category: string } | null>(null);
  const [tagText, setTagText] = useState("");
  const [brandText, setBrandText] = useState("");
  const [priceText, setPriceText] = useState("");
  const [currentTags, setCurrentTags] = useState<string[]>([]);

  const tagSuggestions = useMemo(() => {
    const needle = tagText.trim().toLowerCase();
    return availableTags.filter(
      (t) => !currentTags.includes(t) && (!needle || t.toLowerCase().includes(needle))
    );
  }, [availableTags, currentTags, tagText]);

  // Storage modal logic
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [storageName, setStorageName] = useState("");
  const [selectedStorage, setSelectedStorage] = useState(storages[0]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItemForStorage, setSelectedItemForStorage] = useState<string | null>(null);
  const [selectedCategoryForStorage, setSelectedCategoryForStorage] = useState("");
  const [storageActionModal, setStorageActionModal] = useState(false);
  const [editStorageName, setEditStorageName] = useState("");
  const [editingStorageId, setEditingStorageId] = useState<string | null>(null);

  // Sync storage selection
  useEffect(() => {
    if (storages.length === 0) return;

    const updated = storages.find((s) => s.id === selectedStorage?.id);
    setSelectedStorage(updated || storages[0]);
  }, [storages]);

  // -------------------------
  // OPEN DETAILS MODAL
  // -------------------------
  const openDetailsModal = (id: string, category: string) => {
    const item = closet[category]?.find((i) => i.id === id);
    setDetailsTarget({ id, category });
    setBrandText(item?.brand || "");
    setPriceText(item?.price?.toString() || "");
    setCurrentTags(item?.tags || []);
    setTagText("");
    setDetailsModalOpen(true);
  };

  const handleQuickAddTag = (t: string) => {
    if (!currentTags.includes(t)) {
      setCurrentTags([...currentTags, t]);
    }
  };

  const addTagToList = () => {
    const cleaned = tagText.trim();
    if (cleaned && !currentTags.includes(cleaned)) {
      setCurrentTags([...currentTags, cleaned]);
      setTagText("");
    }
  };

  const removeTagFromList = (t: string) => {
    setCurrentTags(currentTags.filter((x) => x !== t));
  };

  const submitDetails = async () => {
    if (!detailsTarget) return;

    try {
      const price = priceText.trim() ? parseFloat(priceText) : undefined;
      const brand = brandText.trim() || undefined;

      await updateItemDetails(detailsTarget.id, detailsTarget.category, { brand, price });

      const item = closet[detailsTarget.category]?.find((i) => i.id === detailsTarget.id);
      const oldTags = item?.tags || [];

      // Add new
      for (const t of currentTags.filter((x) => !oldTags.includes(x))) {
        await addTag(detailsTarget.id, detailsTarget.category, t);
      }

      // Remove deleted
      for (const t of oldTags.filter((x) => !currentTags.includes(x))) {
        await removeTag(detailsTarget.id, detailsTarget.category, t);
      }

      setDetailsModalOpen(false);
      setCurrentTags([]);
      setBrandText("");
      setPriceText("");
      setTagText("");
      setDetailsTarget(null);
    } catch (e) {
      Alert.alert("Error", "Failed to update item details.");
    }
  };

  // -------------------------
  // PICK IMAGE
  // -------------------------
  const pickImage = async (category: string, fromCamera: boolean) => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Need media library permissions.");
          return;
        }
      }

      let result;
      if (fromCamera) {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (camPerm.status !== "granted") return;

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
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

        const downloadURL = await uploadImageToStorage(result.assets[0].uri, category);

        await addItem({
          uri: downloadURL,
          category,
          tags: [],
        });

        Alert.alert("Success", "Item added!");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  // -------------------------
  // DELETE ITEM
  // -------------------------
  const handleRemoveItem = (itemId: string, category: string) => {
    Alert.alert("Confirm", "Delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          await removeItem(itemId, category);
          setDeleting(false);
        },
      },
    ]);
  };

  // -------------------------
  // STORAGE LOGIC
  // -------------------------
  const showImageMenu = (id: string, cat: string) => {
    Alert.alert("Options", "Choose an action", [
      {
        text: "Add to Storage",
        onPress: () => {
          setSelectedItemForStorage(id);
          setSelectedCategoryForStorage(cat);
          setItemModalOpen(true);
        },
      },
      {
        text: "Remove Item",
        style: "destructive",
        onPress: () => handleRemoveItem(id, cat),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const getItemFromCloset = (id: string, cat: string) =>
    closet[cat]?.find((i) => i.id === id);

  // -------------------------
  // RENDER UI
  // -------------------------
  return (
    <View style={styles.container}>
      {(uploading || deleting) && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingCard}>
            <ActivityIndicator size="large" color="#0066ff" />
            <Text style={styles.uploadingText}>{uploading ? "Uploading..." : "Deleting..."}</Text>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ITEMS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Items</Text>

          {CATEGORIES.map((category) => (
            <View key={category} style={styles.categoryContainer}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>{category}</Text>
                <Text style={styles.itemCount}>{closet[category]?.length || 0}</Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={() => pickImage(category, true)} style={[styles.actionButton, styles.flex1]}>
                  <Text style={styles.buttonText}>Take Picture</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => pickImage(category, false)} style={[styles.actionButton, styles.flex1]}>
                  <Text style={styles.buttonText}>From Gallery</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={closet[category]}
                horizontal
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.itemCard}>
                    <TouchableOpacity
                      onPress={() => openDetailsModal(item.id, category)}
                      onLongPress={() => showImageMenu(item.id, category)}
                      style={styles.imageWrapper}
                    >
                      <Image source={{ uri: item.uri }} style={styles.image} contentFit="contain" />

                      {(item.brand || item.price) && (
                        <View style={styles.itemBadge}>
                          {item.brand && <Text style={styles.badgeText}>{item.brand}</Text>}
                          {item.price && <Text style={styles.badgePrice}>${item.price}</Text>}
                        </View>
                      )}
                    </TouchableOpacity>

                    <TagChips tags={item.tags} onRemove={(t) => removeTag(item.id, category, t)} />
                  </View>
                )}
              />
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* STORAGE */}
        <View style={styles.section}>
          <View style={styles.storageHeader}>
            <Text style={styles.sectionTitle}>Storage</Text>

            <TouchableOpacity style={styles.addButton} onPress={() => setStorageModalOpen(true)}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storageScrollView}>
            {storages.map((storage) => (
              <Pressable
                key={storage.id}
                onPress={() => setSelectedStorage(storage)}
                onLongPress={() => {
                  setEditingStorageId(storage.id);
                  setEditStorageName(storage.name);
                  setStorageActionModal(true);
                }}
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

          {/* Storage grid */}
          {selectedStorage && (
            <View style={styles.storageContent}>
              <View style={styles.storageContentHeader}>
                <Text style={styles.storageContentTitle}>{selectedStorage.name}</Text>
                <Text style={styles.storageContentSubtitle}>
                  {selectedStorage.items.length} items stored
                </Text>
              </View>

              {selectedStorage.items.length > 0 ? (
                <View style={styles.storedItemsGrid}>
                  {selectedStorage.items.map((entry, i) => {
                    const item = getItemFromCloset(entry.itemId, entry.category);
                    if (!item) return null;

                    return (
                      <View key={i} style={styles.storedItemCard}>
                        <Image source={{ uri: item.uri }} style={styles.storedImage} contentFit="cover" />

                        <View style={styles.storedItemInfo}>
                          <Text style={styles.storedItemCategory}>{entry.category}</Text>
                          {item.brand && <Text style={styles.storedItemBrand}>{item.brand}</Text>}
                          {item.price && <Text style={styles.storedItemPrice}>${item.price}</Text>}

                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeItemFromStorage(selectedStorage.id, entry.itemId)}
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
                  <Text style={styles.emptyStorageSubtext}>Add items above</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ---------------- MODALS ---------------- */}

      {/* DETAILS MODAL */}
      <Modal transparent visible={detailsModalOpen} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.detailsModalCard}>
            <Text style={styles.modalTitle}>Item Details</Text>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Tags</Text>

              <View style={styles.tagInputRow}>
                <TextInput
                  value={tagText}
                  onChangeText={setTagText}
                  placeholder="New tag"
                  style={styles.tagInput}
                  onSubmitEditing={addTagToList}
                />
                <TouchableOpacity style={styles.addTagButton} onPress={addTagToList}>
                  <Text style={styles.addTagButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              {tagSuggestions.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestRow}>
                  {tagSuggestions.map((t) => (
                    <Pressable key={t} style={styles.suggestChip} onPress={() => handleQuickAddTag(t)}>
                      <Text style={styles.suggestChipText}>{t}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={styles.tagsRow}>
                {currentTags.map((t) => (
                  <Pressable key={t} onPress={() => removeTagFromList(t)} style={styles.modalChip}>
                    <Text style={styles.modalChipText}>#{t}</Text>
                    <Text style={styles.removeChipIcon}>✕</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.detailsDivider} />

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Brand</Text>
              <TextInput
                value={brandText}
                onChangeText={setBrandText}
                placeholder="Nike, Zara..."
                style={styles.input}
              />
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Price</Text>
              <TextInput
                value={priceText}
                onChangeText={setPriceText}
                placeholder="e.g., 45.99"
                style={styles.input}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setDetailsModalOpen(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>

              <Pressable style={styles.modalSubmitBtn} onPress={submitDetails}>
                <Text style={styles.modalBtnTextPrimary}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* STORAGE CREATE MODAL */}
      <Modal transparent visible={storageModalOpen} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Storage</Text>

            <TextInput
              value={storageName}
              onChangeText={setStorageName}
              placeholder="My Drawer"
              style={styles.input}
            />

            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setStorageModalOpen(false)}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.modalSubmitBtn}
                onPress={() => {
                  if (storageName.trim()) {
                    addStorage(storageName.trim());
                    setStorageName("");
                    setStorageModalOpen(false);
                  }
                }}
              >
                <Text style={styles.modalBtnTextPrimary}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ITEM → STORAGE MODAL */}
      <Modal transparent visible={itemModalOpen} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Storage</Text>

            <View style={styles.storageOptions}>
              {storages.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.storageOption}
                  onPress={() => {
                    addItemToStorage(s.id, selectedItemForStorage!, selectedCategoryForStorage);
                    setItemModalOpen(false);
                  }}
                >
                  <Text style={styles.storageOptionName}>{s.name}</Text>
                  <Text style={styles.storageOptionCount}>{s.items.length} items</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Pressable style={styles.modalCancelBtn} onPress={() => setItemModalOpen(false)}>
              <Text style={styles.modalBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* STORAGE EDIT / DELETE MODAL */}
      <Modal transparent visible={storageActionModal} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Storage Options</Text>

            <TextInput
              value={editStorageName}
              onChangeText={setEditStorageName}
              style={styles.input}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => {
                  renameStorage(editingStorageId!, editStorageName.trim());
                  setStorageActionModal(false);
                }}
              >
                <Text style={styles.modalBtnTextPrimary}>Rename</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={() => {
                  deleteStorage(editingStorageId!);
                  setStorageActionModal(false);
                }}
              >
                <Text style={styles.modalBtnTextDelete}>Delete</Text>
              </TouchableOpacity>
            </View>

            <Pressable style={styles.modalCancelBtn} onPress={() => setStorageActionModal(false)}>
              <Text style={styles.modalBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// -------------------------
// STYLES
// -------------------------
const styles = StyleSheet.create({
  quickTagLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quickTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  quickTagChip: {
    backgroundColor: "#f0f2ff",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  quickTagChipText: {
    fontSize: 11,
    color: "#1a4fff",
    fontWeight: "600",
  },
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
  },
  categoryContainer: {
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
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
    color: "#4ade80",
    textAlign: "center",
    fontWeight: "600",
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
  },
  chipText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
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
  },
  addButton: {
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
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
  },
  storageCardActive: {
    borderColor: "#0066ff",
    backgroundColor: "#f0f7ff",
  },
  storageCardName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  storageCardCount: {
    fontSize: 12,
    color: "#999",
  },
  storageContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  storageContentHeader: {
    marginBottom: 14,
  },
  storageContentTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  storageContentSubtitle: {
    fontSize: 13,
    color: "#999",
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
  },
  storedItemBrand: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
  },
  storedItemPrice: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10b981",
  },
  removeButton: {
    backgroundColor: "#ffe6e6",
    padding: 6,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 4,
  },
  removeButtonText: {
    fontSize: 12,
    color: "#d32f2f",
  },
  emptyStorageState: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyStorageText: {
    fontSize: 16,
    color: "#999",
  },
  emptyStorageSubtext: {
    fontSize: 13,
    color: "#bbb",
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
  },
  detailsModalCard: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
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
  },
  addTagButton: {
    backgroundColor: "#0066ff",
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: "center",
  },
  addTagButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  suggestRow: {
    marginTop: 6,
    marginBottom: 4,
  },
   storageOptions: {
    marginVertical: 14,
    gap: 10,
  },
  suggestChip: {
    backgroundColor: "#f0f7ff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0066ff",
    marginRight: 6,
  },
  suggestChipText: {
    fontSize: 12,
    color: "#0066ff",
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
  },
  removeChipIcon: {
    fontSize: 14,
    color: "#fff",
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
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: "#0066ff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalDeleteBtn: {
    flex: 1,
    backgroundColor: "#ff4757",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "700",
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
  storageOption: {
    backgroundColor: "#f8fafc",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  storageOptionName: {
    fontSize: 15,
    fontWeight: "700",
  },
  storageOptionCount: {
    fontSize: 12,
    color: "#999",
  },
});

export default ClosetScreen;
