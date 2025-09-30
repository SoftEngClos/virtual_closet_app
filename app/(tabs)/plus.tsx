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
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraCapturedPicture } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCloset } from "../ClosetProvider"; // Import useCloset

export default function PlusTab() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  
  // NEW: State to hold the captured photo for preview
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  
  // NEW: Get closet context to add items and list categories
  const { closet, addItem } = useCloset();
  const categories = Object.keys(closet);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission?.granted, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Checking camera permission…</Text>
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

  // MODIFIED: This function now sets the photo for preview instead of navigating
  const takePicture = async () => {
    try {
      if (!cameraRef.current || isCapturing) return;
      setIsCapturing(true);

      const photo: CameraCapturedPicture = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      
      setCapturedPhoto(photo); // Show the preview screen
    } catch (e) {
      Alert.alert("Capture failed", String(e));
    } finally {
      setIsCapturing(false);
    }
  };
  
  // NEW: Function to handle saving the item and navigating
  const handleSaveItem = (category: string) => {
    if (!capturedPhoto) return;
    
    const newItem = {
      id: Date.now().toString(),
      uri: capturedPhoto.uri,
      category,
    };

    addItem(newItem); // Add item to the closet
    Alert.alert("Success!", "Your item has been added to the closet.");
    setCapturedPhoto(null); // Reset the preview state
    router.replace('/closet'); // Navigate to the closet tab
  };
  
  // NEW: Conditional rendering for the preview screen
  if (capturedPhoto) {
    return (
      <ImageBackground source={{ uri: capturedPhoto.uri }} style={styles.previewContainer}>
        <View style={styles.previewOverlay}>
          {/* Back button to retake photo */}
          <TouchableOpacity style={styles.backButton} onPress={() => setCapturedPhoto(null)}>
            <Ionicons name="arrow-back" size={28} color="white" />
            <Text style={styles.previewHeaderText}>Retake</Text>
          </TouchableOpacity>
          
          <Text style={styles.previewTitle}>Add to Category</Text>
          <ScrollView contentContainerStyle={styles.categoryList}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={styles.categoryButton}
                onPress={() => handleSaveItem(cat)}
              >
                <Text style={styles.categoryButtonText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ImageBackground>
    );
  }

  // This is the original camera view
  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        ratio="16:9"
      />
      <View style={styles.controls}>
        <TouchableOpacity onPress={takePicture} style={styles.shutter} disabled={isCapturing}>
          <View style={[styles.innerShutter, isCapturing && { opacity: 0.5 }]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// MODIFIED: Added new styles for the preview screen
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },
  camera: { flex: 1 },
  controls: {
    position: "absolute",
    bottom: 32,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 4, borderColor: "white",
    alignItems: "center", justifyContent: "center",
  },
  innerShutter: { width: 60, height: 60, borderRadius: 30, backgroundColor: "white" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  text: { color: "white", fontSize: 16, marginBottom: 12, textAlign: "center" },
  permBtn: { backgroundColor: "white", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  permText: { fontWeight: "600" },
  // Styles for the preview screen
  previewContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  previewOverlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingBottom: 40,
    paddingTop: 60,
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  categoryList: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  categoryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 12,
    width: '90%',
    alignItems: 'center',
  },
  categoryButtonText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  previewHeaderText: {
    color: 'white',
    fontSize: 18,
    marginLeft: 8,
    fontWeight: '600',
  },
});