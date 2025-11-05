import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ImageBackground,
  ScrollView,
  StatusBar,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraCapturedPicture } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCloset } from "../ClosetProvider";

import * as ImageManipulator from "expo-image-manipulator";
import FreeformCropper from "components/FreeformCropper";

type Aspect = "SQUARE" | "PORTRAIT" | "LANDSCAPE";

function getCenterCrop(
  width: number,
  height: number,
  aspect: Aspect
): {originX: number; originY:number; width:number; height: number }{
  const ratio = 
    aspect === "SQUARE" ? 1 / 1:
    aspect === "PORTRAIT" ? 4 / 5:
    16 / 9;

  const imgRatio = width / height;
  let cropW = width, cropH = height;

  if (imgRatio > ratio){
    // image too wide -> limit by height
    cropH = height;
    cropW = Math.round(height * ratio);
  } else {
    // image too tall or equal -> limit by width
    cropW = width;
    cropH = Math.round(width / ratio);
  }

  const originX = Math.max(0, Math.round((width - cropW) / 2));
  const originY = Math.max(0, Math.round((height - cropH) / 2));

  return {originX, originY, width: cropW, height: cropH };
}

export default function PlusTab() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Store a working uri that may be cropped
  const [workingUri, setWorkingUri] = useState<string | null>(null);

  const [photoDims, setPhotoDims] = useState<{width: number; height: number } | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const [freeformOpen, setFreeformOpen] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  

  const { addItem, uploadImageToStorage } = useCloset();

  const mainCategories = ["Tops", "Bottoms", "Shoes", "Accessories"];

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission?.granted, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission is required.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.permText}>Grant permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    try {
      if (!cameraRef.current || isCapturing) return;
      setIsCapturing(true);

      const photo: CameraCapturedPicture = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });

      console.log("Photo captured:", photo.uri);
      setCapturedPhoto(photo);
      setWorkingUri(photo.uri); // start with original
      setPhotoDims({width: photo.width, height: photo.height});
    } catch (e) {
      Alert.alert("Capture failed", String(e));
    } finally {
      setIsCapturing(false);
    }
  };

  const doCenterCrop = async (aspect: Aspect) => {
    if(!workingUri || !photoDims) return;

    setIsCropping(true);
    try {
      const crop = getCenterCrop(photoDims.width, photoDims.height, aspect);
      const result = await ImageManipulator.manipulateAsync(
        workingUri,
        [{ crop }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    setWorkingUri(result.uri);
    // update dims to the cropped size so subsequent crops stack correctly
    setPhotoDims({ width: crop.width, height: crop.height });
  } catch (e) {
    Alert.alert("Crop failed", String(e));
  } finally {
    setIsCropping(false);
  }
  };

  const rotate90 = async () => {
  if (!workingUri || !photoDims) return;
  setIsCropping(true);
  try {
    const result = await ImageManipulator.manipulateAsync(
      workingUri,
      [{ rotate: 90 }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    // swap dimensions after rotation
    setWorkingUri(result.uri);
    setPhotoDims({ width: photoDims.height, height: photoDims.width });
  } catch (e) {
    Alert.alert("Rotate failed", String(e));
  } finally {
    setIsCropping(false);
  }
};

  const handleSaveItem = async (category: string) => {
    if (!workingUri || isUploading) return;

    setIsUploading(true);

    try {
      

      // Upload to Firebase Storage first
      const downloadURL = await uploadImageToStorage(
        workingUri,
        category
      );


      // Now save with the Firebase URL instead of local URI
      await addItem({
        uri: downloadURL,
        category,
        tags: [],
      });

      Alert.alert("Success!", `Item added to ${category}.`);
      setCapturedPhoto(null);
      setWorkingUri(null);
      router.replace("/closet");
    } catch (error: any) {
      console.error("Error saving item:", error);
      Alert.alert(
        "Upload Failed",
        error.message || "Failed to upload image. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setCapturedPhoto(null);
    setWorkingUri(null);
    router.back();
  };



  if (capturedPhoto) {
    return (
      <View style={styles.fullscreenContainer}>
        <StatusBar hidden />
        <ImageBackground 
        source={{ uri: workingUri ?? capturedPhoto.uri }} 
        style={styles.previewContainer}>
          <View style={styles.previewOverlay}>
            {!isUploading && (
              <TouchableOpacity 
                style={styles.backButton} 
                onPress={() => {setCapturedPhoto(null)
                  setWorkingUri(null);
                }}
              >
                <Ionicons name="arrow-back" size={28} color="white" />
                <Text style={styles.previewHeaderText}>Retake</Text>
              </TouchableOpacity>
            )}

            {!isUploading && (
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={handleClose}
              >
                <Ionicons name="close" size={32} color="white" />
              </TouchableOpacity>
            )}

            {isUploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color="white" />
                <Text style={styles.uploadingText}>Uploading to cloud...</Text>
                <Text style={styles.uploadingSubtext}>Please wait</Text>
              </View>
            ) : (
              <>

              <View style={{ alignItems: "center", marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setFreeformOpen(true)} style={styles.cropButton}>
                  <Text style={styles.cropButtonText}>Free-form crop</Text>
                </TouchableOpacity>
              </View>

                <Text style={styles.previewTitle}>Select Category</Text>
                <ScrollView contentContainerStyle={styles.categoryList}>
                  {mainCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.categoryButton}
                      onPress={() => handleSaveItem(cat)}
                    >
                      <Text style={styles.categoryButtonText}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </View>

            {freeformOpen && workingUri && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "black" }}>
                <FreeformCropper
                  uri={workingUri}
                  onCancel={() => setFreeformOpen(false)}
                  onDone={(outUri) => {
                    setWorkingUri(outUri);   // PNG with transparency
                    setFreeformOpen(false);
                    setPhotoDims(null);
                    setShowCategoryPicker(true);
                  }}
                />
              </View>
            )}

            {showCategoryPicker && (
              <View style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                backgroundColor: "rgba(0,0,0,0.7)", paddingTop: 16, paddingBottom: 24
              }}>
                <Text style={{ color: "white", fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 12 }}>
                  Save to…
                </Text>
                <View style={{ paddingHorizontal: 20 }}>
                  {mainCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.95)",
                        paddingVertical: 14, borderRadius: 12, marginBottom: 10, alignItems: "center"
                      }}
                      onPress={async () => {
                        setShowCategoryPicker(false);
                        await handleSaveItem(cat);
                      }}
                    >
                      <Text style={{ color: "#1a1a1a", fontWeight: "700", fontSize: 16 }}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => setShowCategoryPicker(false)}
                    style={{ paddingVertical: 12, alignItems: "center" }}
                  >
                    <Text style={{ color: "white", fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

              {freeformOpen && workingUri && (
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    { zIndex: 10000, elevation: 100, backgroundColor: "black" }
                  ]}
                  pointerEvents="auto"
                >
                  <FreeformCropper
                    uri={workingUri}
                    onCancel={() => setFreeformOpen(false)}
                    onDone={(outUri) => {
                      setWorkingUri(outUri);
                      setFreeformOpen(false);
                      setPhotoDims(null);
                      setShowCategoryPicker(true); // optional: open your “Save to…” picker immediately
                    }}
                  />
                </View>
              )}

        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar hidden />
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      
      {/* Close button on camera view */}
      <TouchableOpacity style={styles.cameraCloseButton} onPress={handleClose}>
        <Ionicons name="close" size={32} color="white" />
      </TouchableOpacity>

      <View style={styles.controls}>
        <TouchableOpacity onPress={takePicture} style={styles.shutter} disabled={isCapturing}>
          <View style={[styles.innerShutter, isCapturing && { opacity: 0.5 }]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "black",
    zIndex: 9999,
  },
  container: { 
    flex: 1, 
    backgroundColor: "black" 
  },
  camera: { 
    flex: 1,
    width: "100%",
    height: "100%",
  },
  controls: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  innerShutter: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: "white" 
  },
  center: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center", 
    padding: 24,
    backgroundColor: "black",
  },
  text: { 
    color: "white", 
    fontSize: 16, 
    marginBottom: 12, 
    textAlign: "center" 
  },
  loadingText: {
    color: "white",
    fontSize: 16,
    marginTop: 12,
  },
  permBtn: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permText: { 
    fontWeight: "600" 
  },
  previewContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  previewOverlay: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingBottom: 50,
    paddingTop: 80,
    minHeight: 400,
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 24,
  },
  categoryList: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  categoryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    width: "90%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  categoryButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  cameraCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  previewHeaderText: {
    color: "white",
    fontSize: 18,
    marginLeft: 8,
    fontWeight: "600",
  },
  uploadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  uploadingText: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 24,
  },
  uploadingSubtext: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    marginTop: 8,
  },

  cropButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 8,
  },
  cropButtonText: {fontSize: 16, fontWeight: "600", color: "#1a1a1a"},
});
