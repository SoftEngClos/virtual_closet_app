import React, { useState, useEffect, useRef } from "react";
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
  Dimensions,
  Image as RNImage,
  GestureResponderEvent,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useCloset } from "../ClosetProvider";
import { Image } from "expo-image";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Svg, Path, ClipPath, Defs, G, Image as SvgImage } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { removeBgFromImage } from "../../src/services/removeBg";
import * as FileSystem from "expo-file-system";
import { useSimpleTheme } from "src/hooks/useSimpleTheme";

const { width, height } = Dimensions.get("window");
const CATEGORIES = ["Tops", "Bottoms", "Shoes", "Accessories"];

function TagChips({ tags, onRemove }: { tags: string[]; onRemove?: (t: string) => void }) {
  return (
    <View style={styles.tagsRow}>
      {tags.map((t) => (
        <Pressable key={t} onLongPress={() => onRemove?.(t)} style={styles.chip}>
          <Text style={styles.chipText}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Catmull-Rom spline for ultra-smooth curves
const getCatmullRomPath = (points: { x: number; y: number }[]): string => {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return path + " Z";
};

// Calculate bounding box for cropping
const getBoundingBox = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return null;
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  const padding = 40;
  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
};

// Image Editor with Manual Trace + API Background Removal
interface ImageEditorProps {
  imageUri: string;
  category: string;
  onSave: (processedUri: string, category: string) => void;
  onCancel: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ imageUri, category, onSave, onCancel }) => {
  const { colors } = useSimpleTheme();
  const [processing, setProcessing] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [completePath, setCompletePath] = useState<string>("");
  const [traced, setTraced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mode, setMode] = useState<"choose" | "manual" | "api">("choose");
  const [apiResult, setApiResult] = useState<string | null>(null);
  const viewShotRef = useRef<View>(null);
  const lastPointTime = useRef<number>(0);

  useEffect(() => {
    RNImage.getSize(
      imageUri,
      (w, h) => {
        setImageSize({ width: w, height: h });
      },
      (error) => {
        console.error("Failed to get image size", error);
        setImageSize({ width: 1000, height: 1000 });
      }
    );
  }, [imageUri]);

  const handleChooseManual = () => {
    setMode("manual");
  };

  const handleChooseAPI = async () => {
    setMode("api");
    setProcessing(true);
    try {
      const result = await removeBgFromImage(imageUri);
      setApiResult(result);
      setShowPreview(true);
    } catch (e: any) {
      Alert.alert("Background Removal Failed", e?.message || "Please try manual tracing instead.");
      setMode("choose");
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = () => {
    onSave(imageUri, category);
  };

  const onTouchMove = (event: GestureResponderEvent) => {
    const now = Date.now();
    if (now - lastPointTime.current < 30) return;
    lastPointTime.current = now;

    const locationX = event.nativeEvent.locationX;
    const locationY = event.nativeEvent.locationY;
    setPoints((prev) => [...prev, { x: locationX, y: locationY }]);
  };

  const onTouchEnd = () => {
    if (points.length < 5) return;
    const smoothPath = getCatmullRomPath(points);
    setCompletePath(smoothPath);
    setTraced(true);
  };

  const handleReset = () => {
    setPoints([]);
    setCompletePath("");
    setTraced(false);
    setShowPreview(false);
    setApiResult(null);
    setMode("choose");
  };

  const handlePreview = () => {
    if (!traced) {
      Alert.alert("Trace Required", "Please trace around your item first");
      return;
    }
    setShowPreview(true);
  };

  const handleSaveManual = async () => {
    if (!traced || !viewShotRef.current) {
      Alert.alert("Error", "Please trace your item first");
      return;
    }
    setProcessing(true);
    try {
      const uri = await captureRef(viewShotRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const { width: capturedWidth, height: capturedHeight } = await new Promise<{
        width: number;
        height: number;
      }>((resolve, reject) => {
        RNImage.getSize(
          uri,
          (w, h) => {
            resolve({ width: w, height: h });
          },
          (error) => reject(error)
        );
      });

      const bbox = getBoundingBox(points);
      if (bbox && bbox.width > 20 && bbox.height > 20) {
        const scaleX = capturedWidth / width;
        const scaleY = capturedHeight / (height * 0.7);

        const cropX = Math.max(0, Math.round(bbox.x * scaleX));
        const cropY = Math.max(0, Math.round(bbox.y * scaleY));
        const cropWidth = Math.min(Math.round(bbox.width * scaleX), capturedWidth - cropX);
        const cropHeight = Math.min(Math.round(bbox.height * scaleY), capturedHeight - cropY);

        if (
          cropX >= 0 &&
          cropY >= 0 &&
          cropWidth > 0 &&
          cropHeight > 0 &&
          cropX + cropWidth <= capturedWidth &&
          cropY + cropHeight <= capturedHeight
        ) {
          const cropResult = await ImageManipulator.manipulateAsync(
            uri,
            [
              {
                crop: {
                  originX: cropX,
                  originY: cropY,
                  width: cropWidth,
                  height: cropHeight,
                },
              },
            ],
            { compress: 1, format: ImageManipulator.SaveFormat.PNG }
          );
          onSave(cropResult.uri, category);
        } else {
          onSave(uri, category);
        }
      } else {
        onSave(uri, category);
      }
    } catch (error) {
      console.error("Save error", error);
      Alert.alert("Error", "Failed to save masked image");
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveAPI = () => {
    if (apiResult) {
      onSave(apiResult, category);
    }
  };

  const currentPath = points.length > 5 ? getCatmullRomPath(points) : "";

  return (
    <GestureHandlerRootView style={[styles.editorContainer, { backgroundColor: colors.card }]}>
      <View style={[styles.editorHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onCancel} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={[styles.editorTitle, { color: colors.text }]}>Edit Photo</Text>
          <Text style={[styles.editorSubtitle, { color: colors.textSecondary }]}>
            {mode === "choose"
              ? "Choose how to proceed"
              : mode === "api"
              ? "AI Background Removal"
              : showPreview
              ? "Preview"
              : "Trace around item"}
          </Text>
        </View>
      </View>

      <View style={styles.editorContent}>
        {processing && (
          <View style={[styles.processingOverlay, { backgroundColor: colors.overlay }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.processingText, { color: colors.text }]}>
              {mode === "api" ? "Removing background..." : "Processing..."}
            </Text>
          </View>
        )}

        {mode === "choose" && (
          <View style={styles.chooseContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="contain" />

            <View style={styles.optionsContainer}>
              <TouchableOpacity style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleChooseAPI}>
                <View style={[styles.optionIconContainer, { backgroundColor: colors.card }]}>
                  <Text style={styles.optionIcon}>✨</Text>
                </View>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Auto Remove</Text>
                <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>AI-powered</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleChooseManual}>
                <View style={[styles.optionIconContainer, { backgroundColor: colors.card }]}>
                  <Text style={styles.optionIcon}>✏️</Text>
                </View>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Manual Trace</Text>
                <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>Draw yourself</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.skipButton, { backgroundColor: colors.surface }]} onPress={handleSkip}>
              <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>Continue without editing</Text>
              <Text style={[styles.skipButtonArrow, { color: colors.primary }]}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === "manual" && !showPreview && (
          <View style={styles.drawingContainer} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <Image source={{ uri: imageUri }} style={styles.fullImage} contentFit="contain" />
            <Svg height={height * 0.7} width={width} style={styles.svgOverlay}>
              {currentPath && (
                <>
                  <Path
                    d={currentPath}
                    stroke="#00d4ff"
                    strokeWidth={6}
                    fill="rgba(0, 212, 255, 0.08)"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <Path d={currentPath} stroke="#ffffff" strokeWidth={2} fill="transparent" strokeLinejoin="round" strokeLinecap="round" />
                </>
              )}

              {traced && completePath && (
                <>
                  <Path
                    d={completePath}
                    stroke="#00ff88"
                    strokeWidth={6}
                    fill="rgba(0, 255, 136, 0.12)"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <Path d={completePath} stroke="#ffffff" strokeWidth={2} fill="transparent" strokeLinejoin="round" strokeLinecap="round" />
                </>
              )}
            </Svg>

            {points.length > 0 && (
              <View style={styles.traceIndicator}>
                <Text style={styles.traceIndicatorText}>{traced ? "Done! ✓" : "Keep tracing..."}</Text>
              </View>
            )}
          </View>
        )}

        {mode === "manual" && showPreview && (
          <View style={[styles.previewContainer, { backgroundColor: colors.surface }]}>
            <View ref={viewShotRef} collapsable={false} style={styles.captureView}>
              <Svg height={height * 0.7} width={width} style={{ backgroundColor: "transparent" }}>
                <Defs>
                  <ClipPath id="mask">
                    <Path d={completePath} />
                  </ClipPath>
                </Defs>
                <G clipPath="url(#mask)">
                  <SvgImage href={imageUri} width={width} height={height * 0.7} preserveAspectRatio="xMidYMid slice" />
                </G>
              </Svg>
            </View>
          </View>
        )}

        {mode === "api" && showPreview && apiResult && (
          <View style={[styles.previewContainer, { backgroundColor: colors.surface }]}>
            <Image source={{ uri: apiResult }} style={styles.fullImage} contentFit="contain" />
          </View>
        )}

        {mode !== "choose" && (
          <View style={[styles.editorActionBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            {!showPreview ? (
              <>
                <TouchableOpacity
                  style={[styles.editorButton, styles.resetButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={handleReset}
                  disabled={processing}
                >
                  <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>← Back</Text>
                </TouchableOpacity>
                {mode === "manual" && (
                  <TouchableOpacity
                    style={[styles.editorButton, styles.previewButton, { backgroundColor: colors.primary }, !traced && styles.buttonDisabled]}
                    onPress={handlePreview}
                    disabled={processing || !traced}
                  >
                    <Text style={styles.editorButtonText}>Preview</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.editorButton, styles.resetButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={handleReset}
                  disabled={processing}
                >
                  <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editorButton, styles.saveButton, { backgroundColor: colors.success }]}
                  onPress={mode === "api" ? handleSaveAPI : handleSaveManual}
                  disabled={processing}
                >
                  <Text style={styles.saveButtonText}>Done ✓</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};

const ClosetScreen = () => {
  const { colors, isDark } = useSimpleTheme();
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
    globalTags,
    addGlobalTag,
  } = useCloset();

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

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

  // Multi-delete state
  const [multiDeleteMode, setMultiDeleteMode] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [multiDeleteCategory, setMultiDeleteCategory] = useState<string>("");

  useEffect(() => {
    if (storages.length > 0) {
      if (selectedStorage) {
        const updatedSelectedStorage = storages.find((s) => s.id === selectedStorage.id);
        if (updatedSelectedStorage) {
          setSelectedStorage(updatedSelectedStorage);
        } else {
          setSelectedStorage(storages[0]);
        }
      } else {
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

  const addTagToList = (tag: string) => {
    if (tag.trim() && !currentTags.includes(tag.trim())) {
      setCurrentTags([...currentTags, tag.trim()]);
      if (!globalTags.includes(tag.trim())) {
        addGlobalTag(tag.trim());
      }
    }
  };

  const createNewTag = () => {
    if (tagText.trim()) {
      addTagToList(tagText.trim());
      setTagText("");
    }
  };

  const removeTagFromList = (tag: string) => {
    setCurrentTags(currentTags.filter((t) => t !== tag));
  };

  const submitDetails = async () => {
    if (!detailsTarget) return;
    try {
      const price = priceText.trim() ? parseFloat(priceText) : undefined;
      const brand = brandText.trim() || undefined;

      await updateItemDetails(detailsTarget.id, detailsTarget.category, brand, price);

      const item = closet[detailsTarget.category]?.find((i) => i.id === detailsTarget.id);
      const oldTags = item?.tags || [];

      const tagsToAdd = currentTags.filter((t) => !oldTags.includes(t));
      for (const tag of tagsToAdd) {
        await addTag(detailsTarget.id, detailsTarget.category, tag);
      }

      const tagsToRemove = oldTags.filter((t) => !currentTags.includes(t));
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
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.9,
          exif: false,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.9,
          exif: false,
        });
      }

      if (!result.canceled && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
        setSelectedCategory(category);
        setEditorVisible(true);
      }
    } catch (err: any) {
      console.error("Error picking image:", err);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleEditorSave = async (processedUri: string, category: string) => {
    setEditorVisible(false);
    setUploading(true);
    try {
      const downloadURL = await uploadImageToStorage(processedUri, category);
      await addItem({ uri: downloadURL, category, tags: [] });
      Alert.alert("Success", "Item added to your closet!");
    } catch (error: any) {
      console.error("Error uploading:", error);
      Alert.alert("Error", error.message || "Failed to upload image.");
    } finally {
      setUploading(false);
      setSelectedImageUri(null);
      setSelectedCategory("");
    }
  };

  const handleEditorCancel = () => {
    setEditorVisible(false);
    setSelectedImageUri(null);
    setSelectedCategory("");
  };

  const handleRemoveItem = async (itemId: string, category: string) => {
    Alert.alert("Confirm Delete", "Are you sure you want to remove this item?", [
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
    ]);
  };

  const toggleMultiDeleteMode = (category: string) => {
    setMultiDeleteMode(!multiDeleteMode);
    setMultiDeleteCategory(category);
    setSelectedForDeletion(new Set());
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedForDeletion);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedForDeletion(newSelection);
  };

  const handleMultiDelete = async () => {
    if (selectedForDeletion.size === 0) {
      Alert.alert("No Items Selected", "Please select items to delete.");
      return;
    }

    Alert.alert("Confirm Delete", `Delete ${selectedForDeletion.size} selected items?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const deletePromises = Array.from(selectedForDeletion).map((itemId) => removeItem(itemId, multiDeleteCategory));
            await Promise.all(deletePromises);
            Alert.alert("Success", `${selectedForDeletion.size} items deleted.`);
            setMultiDeleteMode(false);
            setSelectedForDeletion(new Set());
          } catch (error) {
            Alert.alert("Error", "Failed to delete some items.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
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
      {
        text: "Remove Multiple Items",
        onPress: () => toggleMultiDeleteMode(category),
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
      const storageToDelete = storages.find((s) => s.id === editingStorageId);
      const itemCount = storageToDelete?.items.length || 0;

      Alert.alert(
        "Confirm Delete",
        itemCount > 0 ? `Delete this storage and all ${itemCount} items inside?` : "Delete this storage?",
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {(uploading || deleting) && (
        <View style={styles.uploadingOverlay}>
          <View style={[styles.uploadingCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.uploadingText, { color: colors.text }]}>{uploading ? "Uploading..." : "Deleting..."}</Text>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>My Items</Text>

          {CATEGORIES.map((category) => (
            <View key={category} style={[styles.categoryContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.categoryHeader}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>{category}</Text>
                <Text style={[styles.itemCount, { backgroundColor: colors.surface, color: colors.textSecondary }]}>
                  {closet[category]?.length || 0}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.flex1, { backgroundColor: colors.primary }]}
                  onPress={() => pickImage(category, true)}
                  disabled={uploading || deleting || multiDeleteMode}
                >
                  <Text style={styles.buttonText}>📷 Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.flex1, { backgroundColor: colors.primary }]}
                  onPress={() => pickImage(category, false)}
                  disabled={uploading || deleting || multiDeleteMode}
                >
                  <Text style={styles.buttonText}>🖼️ Gallery</Text>
                </TouchableOpacity>
              </View>

              {multiDeleteMode && multiDeleteCategory === category && (
                <View style={styles.multiDeleteBar}>
                  <Text style={styles.multiDeleteText}>{selectedForDeletion.size} selected</Text>
                  <View style={styles.multiDeleteButtons}>
                    <TouchableOpacity
                      style={styles.cancelMultiBtn}
                      onPress={() => {
                        setMultiDeleteMode(false);
                        setSelectedForDeletion(new Set());
                      }}
                    >
                      <Text style={styles.cancelMultiText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteMultiBtn} onPress={handleMultiDelete}>
                      <Text style={styles.deleteMultiText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <FlatList
                data={closet[category]}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = selectedForDeletion.has(item.id);

                  return (
                    <View style={styles.itemCard}>
                      <TouchableOpacity
                        onPress={() => {
                          if (multiDeleteMode && multiDeleteCategory === category) {
                            toggleItemSelection(item.id);
                          } else {
                            openDetailsModal(item.id, category);
                          }
                        }}
                        onLongPress={() => {
                          if (!multiDeleteMode) {
                            showImageMenu(item.id, category);
                          }
                        }}
                        style={[styles.imageWrapper, isSelected && styles.imageWrapperSelected]}
                      >
                        <View style={[styles.transparentImageContainer, { backgroundColor: colors.surface }]}>
                          <Image source={{ uri: item.uri }} style={styles.image} contentFit="contain" cachePolicy="disk" />
                        </View>
                        {isSelected && (
                          <View style={[styles.selectionCheckmark, { backgroundColor: colors.primary }]}>
                            <Text style={styles.checkmarkText}>✓</Text>
                          </View>
                        )}
                        {(item.brand || item.price) && !isSelected && (
                          <View style={styles.itemBadge}>
                            {item.brand && <Text style={styles.badgeText}>{item.brand}</Text>}
                            {item.price && <Text style={styles.badgePrice}>${item.price}</Text>}
                          </View>
                        )}
                      </TouchableOpacity>
                      {!multiDeleteMode && <TagChips tags={item.tags} onRemove={(t) => removeTag(item.id, category, t)} />}
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No items yet</Text>
                  </View>
                }
              />
            </View>
          ))}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.section}>
          <View style={styles.storageHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Storage</Text>
            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.success }]} onPress={() => setStorageModalOpen(true)}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {storages.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storageScrollView}>
              {storages.map((storage) => (
                <Pressable
                  key={storage.id}
                  onPress={() => setSelectedStorage(storage)}
                  onLongPress={() => handleStorageLongPress(storage)}
                  style={[
                    styles.storageCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedStorage?.id === storage.id && [styles.storageCardActive, { borderColor: colors.primary, backgroundColor: colors.primaryLight }],
                  ]}
                >
                  <Text style={[styles.storageCardName, { color: colors.text }]}>{storage.name}</Text>
                  <Text style={[styles.storageCardCount, { color: colors.textSecondary }]}>{storage.items.length} items</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {selectedStorage && (
            <View style={[styles.storageContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.storageContentHeader, { borderBottomColor: colors.surface }]}>
                <View>
                  <Text style={[styles.storageContentTitle, { color: colors.text }]}>{selectedStorage.name}</Text>
                  <Text style={[styles.storageContentSubtitle, { color: colors.textSecondary }]}>{selectedStorage.items.length} items stored</Text>
                </View>
              </View>

              {selectedStorage.items.length > 0 ? (
                <View style={styles.storedItemsGrid}>
                  {selectedStorage.items.map((storedItem, index) => {
                    const item = getItemFromCloset(storedItem.itemId, storedItem.category);
                    if (!item) return null;

                    return (
                      <View key={index} style={[styles.storedItemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.transparentStoredImage, { backgroundColor: colors.surface }]}>
                          <Image source={{ uri: item.uri }} style={styles.storedImage} contentFit="contain" cachePolicy="disk" />
                        </View>
                        <View style={styles.storedItemInfo}>
                          <Text style={[styles.storedItemCategory, { color: colors.primary }]}>{storedItem.category}</Text>
                          {item.brand && <Text style={[styles.storedItemBrand, { color: colors.textSecondary }]}>{item.brand}</Text>}
                          {item.price && <Text style={[styles.storedItemPrice, { color: colors.success }]}>${item.price}</Text>}
                          <TouchableOpacity
                            onPress={() => removeItemFromStorage(selectedStorage.id, storedItem.itemId)}
                            style={[styles.removeButton, { backgroundColor: colors.error + "20" }]}
                          >
                            <Text style={[styles.removeButtonText, { color: colors.error }]}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyStorageState}>
                  <Text style={[styles.emptyStorageText, { color: colors.textSecondary }]}>Empty storage</Text>
                  <Text style={[styles.emptyStorageSubtext, { color: colors.textSecondary }]}>Add items from above to organize them here</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={editorVisible} animationType="slide" presentationStyle="fullScreen">
        {selectedImageUri && (
          <ImageEditor imageUri={selectedImageUri} category={selectedCategory} onSave={handleEditorSave} onCancel={handleEditorCancel} />
        )}
      </Modal>

      {/* Details Modal with Better Tags */}
      <Modal transparent visible={detailsModalOpen} animationType="fade" onRequestClose={() => setDetailsModalOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.detailsModalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Item Details</Text>

            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>TAGS</Text>

              {/* Existing global tags */}
              {globalTags.length > 0 && (
                <View style={styles.existingTagsContainer}>
                  <Text style={[styles.existingTagsLabel, { color: colors.textSecondary }]}>Select existing tags:</Text>
                  <View style={styles.existingTagsGrid}>
                    {globalTags.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => addTagToList(tag)}
                        style={[
                          styles.existingTagChip,
                          { backgroundColor: colors.surface, borderColor: colors.border },
                          currentTags.includes(tag) && [styles.existingTagChipSelected, { backgroundColor: colors.primaryLight, borderColor: colors.primary }],
                        ]}
                        disabled={currentTags.includes(tag)}
                      >
                        <Text style={[styles.existingTagText, { color: colors.textSecondary }, currentTags.includes(tag) && [styles.existingTagTextSelected, { color: colors.primary }]]}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Create new tag */}
              <View style={styles.tagInputRow}>
                <TextInput
                  value={tagText}
                  onChangeText={setTagText}
                  placeholder="Create new tag"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.tagInput, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? colors.surface : colors.card }]}
                  onSubmitEditing={createNewTag}
                />
                <TouchableOpacity style={[styles.addTagButton, { backgroundColor: colors.primary }]} onPress={createNewTag}>
                  <Text style={styles.addTagButtonText}>Add</Text>
                </TouchableOpacity>
              </View>

              {/* Current tags on this item */}
              <View style={styles.tagsRow}>
                {currentTags.map((tag) => (
                  <Pressable key={tag} onPress={() => removeTagFromList(tag)} style={[styles.modalChip, { backgroundColor: colors.primary }]}>
                    <Text style={styles.modalChipText}>{tag}</Text>
                    <Text style={styles.removeChipIcon}>✕</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.detailsDivider, { backgroundColor: colors.border }]} />

            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>BRAND</Text>
              <TextInput
                value={brandText}
                onChangeText={setBrandText}
                placeholder="e.g., Nike, Zara, H&M"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? colors.surface : colors.card }]}
              />
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>PRICE</Text>
              <TextInput
                value={priceText}
                onChangeText={setPriceText}
                placeholder="e.g., 49.99"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? colors.surface : colors.card }]}
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
                style={[styles.modalCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitDetails} style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.modalBtnTextPrimary}>Save All</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Storage Modals... (continue with same pattern for remaining modals) */}
      <Modal transparent visible={storageModalOpen} animationType="fade" onRequestClose={() => setStorageModalOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Storage</Text>
            <TextInput
              value={storageName}
              onChangeText={setStorageName}
              placeholder="e.g., My grey bin, Drawer 2"
              placeholderTextColor={colors.textSecondary}
              autoFocus
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? colors.surface : colors.card }]}
              onSubmitEditing={handleAddStorage}
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={() => setStorageModalOpen(false)} style={[styles.modalCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleAddStorage} style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.modalBtnTextPrimary}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={itemModalOpen} animationType="fade" onRequestClose={() => setItemModalOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Storage</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Choose where to store this item</Text>
            <View style={styles.storageOptions}>
              {storages.map((storage) => (
                <TouchableOpacity
                  key={storage.id}
                  style={[styles.storageOption, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleAddItemToStorage(storage.id, selectedItemForStorage!, selectedCategoryForStorage)}
                >
                  <Text style={[styles.storageOptionName, { color: colors.text }]}>{storage.name}</Text>
                  <Text style={[styles.storageOptionCount, { color: colors.textSecondary }]}>{storage.items.length} items</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Pressable onPress={() => setItemModalOpen(false)} style={[styles.modalCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={storageActionModal} animationType="fade" onRequestClose={() => setStorageActionModal(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Storage Options</Text>
            <TextInput
              value={editStorageName}
              onChangeText={setEditStorageName}
              placeholder="Storage name"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? colors.surface : colors.card }]}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={handleRenameStorage} style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.modalBtnTextPrimary}>Rename</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDeleteStorage} style={[styles.modalDeleteBtn, { backgroundColor: colors.error }]}>
                <Text style={styles.modalBtnTextDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
            <Pressable onPress={() => setStorageActionModal(false)} style={[styles.modalCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  uploadingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", zIndex: 9999 },
  uploadingCard: { borderRadius: 16, padding: 30, alignItems: "center", gap: 15 },
  uploadingText: { fontSize: 16, fontWeight: "600" },
  section: { paddingHorizontal: 16, paddingVertical: 12 },
  sectionTitle: { fontSize: 24, fontWeight: "800", marginBottom: 14, letterSpacing: 0.5 },
  categoryContainer: { marginBottom: 16, borderRadius: 16, padding: 12, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  categoryTitle: { fontSize: 19, fontWeight: "700" },
  itemCount: { fontSize: 12, fontWeight: "600", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  buttonRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  flex1: { flex: 1 },
  actionButton: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, alignItems: "center", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  multiDeleteBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fff3cd", padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: "#ffc107" },
  multiDeleteText: { fontSize: 14, fontWeight: "700", color: "#856404" },
  multiDeleteButtons: { flexDirection: "row", gap: 8 },
  cancelMultiBtn: { backgroundColor: "#6c757d", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  cancelMultiText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  deleteMultiBtn: { backgroundColor: "#dc3545", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  deleteMultiText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  itemCard: { width: 180, marginRight: 10, marginBottom: 8 },
  imageWrapper: { marginBottom: 8, position: "relative", borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  imageWrapperSelected: { borderColor: "#0066ff", backgroundColor: "#e3f2fd" },
  transparentImageContainer: { width: 176, height: 176, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  image: { width: "90%", height: "90%" },
  selectionCheckmark: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  checkmarkText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  itemBadge: { position: "absolute", bottom: 4, left: 4, right: 4, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 6, padding: 4 },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff", textAlign: "center" },
  badgePrice: { fontSize: 10, fontWeight: "600", color: "#4ade80", textAlign: "center" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  chip: { backgroundColor: "#f0f2f5", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 14, marginBottom: 2 },
  chipText: { fontSize: 11, color: "#666", fontWeight: "600" },
  emptyState: { paddingVertical: 24, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 14, fontWeight: "500" },
  divider: { height: 1, marginVertical: 8 },
  storageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  addButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  addButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  storageScrollView: { marginBottom: 14 },
  storageCard: { borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15, marginRight: 10, borderWidth: 1.5, minWidth: 125, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  storageCardActive: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  storageCardName: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  storageCardCount: { fontSize: 12, fontWeight: "500" },
  storageContent: { borderRadius: 16, padding: 16, borderWidth: 1, marginTop: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  storageContentHeader: { marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1 },
  storageContentTitle: { fontSize: 17, fontWeight: "800" },
  storageContentSubtitle: { fontSize: 13, marginTop: 3, fontWeight: "500" },
  storedItemsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  storedItemCard: { width: "31%", borderRadius: 12, overflow: "hidden", borderWidth: 1 },
  transparentStoredImage: { width: "100%", height: 90, justifyContent: "center", alignItems: "center" },
  storedImage: { width: "90%", height: "90%" },
  storedItemInfo: { padding: 8 },
  storedItemCategory: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  storedItemBrand: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  storedItemPrice: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  removeButton: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: "center", marginTop: 4 },
  removeButtonText: { fontSize: 12, fontWeight: "700" },
  emptyStorageState: { paddingVertical: 32, justifyContent: "center", alignItems: "center" },
  emptyStorageText: { fontSize: 16, fontWeight: "700", marginBottom: 5 },
  emptyStorageSubtext: { fontSize: 13, fontWeight: "500" },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalCard: { width: "85%", borderRadius: 16, padding: 20, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10 },
  detailsModalCard: { width: "90%", maxHeight: "85%", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 16 },
  detailSection: { marginBottom: 12 },
  detailLabel: { fontSize: 14, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  existingTagsContainer: { marginBottom: 12 },
  existingTagsLabel: { fontSize: 12, marginBottom: 8, fontWeight: "600" },
  existingTagsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  existingTagChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  existingTagChipSelected: {},
  existingTagText: { fontSize: 12, fontWeight: "600" },
  existingTagTextSelected: {},
  tagInputRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  tagInput: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontWeight: "500" },
  addTagButton: { paddingHorizontal: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  addTagButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  modalChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, marginBottom: 2, flexDirection: "row", alignItems: "center" },
  modalChipText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  removeChipIcon: { fontSize: 14, color: "#fff", fontWeight: "700", marginLeft: 4 },
  detailsDivider: { height: 1, marginVertical: 12 },
  modalSubtitle: { fontSize: 14, marginBottom: 10, fontWeight: "500" },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: "500" },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  modalSubmitBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  modalDeleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  modalBtnText: { fontSize: 15, fontWeight: "700" },
  modalBtnTextPrimary: { fontSize: 15, fontWeight: "800", color: "#fff" },
  modalBtnTextDelete: { fontSize: 15, fontWeight: "800", color: "#fff" },
  storageOptions: { marginVertical: 14, gap: 10 },
  storageOption: { paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  storageOptionName: { fontSize: 15, fontWeight: "700", marginBottom: 3 },
  storageOptionCount: { fontSize: 12, fontWeight: "500" },
  // Editor Styles
  editorContainer: { flex: 1 },
  editorHeader: { flexDirection: "row", alignItems: "center", paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginRight: 12 },
  backButtonText: { fontSize: 20 },
  editorTitle: { fontSize: 20, fontWeight: "800" },
  editorSubtitle: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  editorContent: { flex: 1 },
  chooseContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  previewImage: { width: "100%", height: height * 0.4, marginBottom: 24, borderRadius: 12 },
  optionsContainer: { flexDirection: "row", gap: 12, marginBottom: 20 },
  optionCard: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center", borderWidth: 2 },
  optionIconContainer: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  optionIcon: { fontSize: 32 },
  optionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  optionSubtitle: { fontSize: 11, fontWeight: "500" },
  skipButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, gap: 8 },
  skipButtonText: { fontSize: 14, fontWeight: "600" },
  skipButtonArrow: { fontSize: 16, fontWeight: "700" },
  drawingContainer: { flex: 1, position: "relative", backgroundColor: "#000" },
  fullImage: { width: "100%", height: height * 0.7 },
  svgOverlay: { position: "absolute", top: 0, left: 0 },
  traceIndicator: { position: "absolute", top: 20, alignSelf: "center" },
  traceIndicatorText: { backgroundColor: "rgba(0,0,0,0.8)", color: "#00ff88", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, fontSize: 13, fontWeight: "700" },
  previewContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  captureView: { backgroundColor: "transparent" },
  processingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 10 },
  processingText: { marginTop: 16, fontSize: 15, fontWeight: "600" },
  editorActionBar: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 16, gap: 10, borderTopWidth: 1 },
  editorButton: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  resetButton: { borderWidth: 1 },
  resetButtonText: { fontSize: 14, fontWeight: "700" },
  previewButton: {},
  saveButton: {},
  editorButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  saveButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  buttonDisabled: { opacity: 0.5 },
});

export default ClosetScreen;
