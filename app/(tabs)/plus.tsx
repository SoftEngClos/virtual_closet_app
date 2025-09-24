// app/(tabs)/plus.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraCapturedPicture } from "expo-camera";
import { router } from "expo-router"; // okay to use singleton, or useRouter()
import {type Href} from "expo-router";

export default function PlusTab() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);

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

  const takePicture = async () => {
    try {
      if (!cameraRef.current || isCapturing) return;
      setIsCapturing(true);

      const photo: CameraCapturedPicture = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });

      // TS-friendly push: cast pathname to the literal '/add-item'
       const href: Href = {pathname: "/add-item", params: {uri: photo.uri}}
       router.push(href);
      // alternative (also works): router.push(`/add-item?uri=${encodeURIComponent(photo.uri)}`);
    } catch (e) {
      Alert.alert("Capture failed", String(e));
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"     // "front" | "back"
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
});
