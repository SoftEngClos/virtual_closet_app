import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraCapturedPicture } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCloset } from "../ClosetProvider";
import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "expo-image";
import { Svg, Path, ClipPath, Defs, G, Image as SvgImage } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { removeBgFromImage } from "../../src/services/removeBg";

const { width, height } = Dimensions.get("window");

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

export default function PlusTab() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [workingUri, setWorkingUri] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [completePath, setCompletePath] = useState<string>("");
  const [traced, setTraced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mode, setMode] = useState<"choose" | "manual" | "api">("choose");
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const viewShotRef = useRef<View>(null);
  const lastPointTime = useRef<number>(0);

  const { addItem, uploadImageToStorage } = useCloset();
  const mainCategories = ["Tops", "Bottoms", "Shoes", "Accessories"];

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission?.granted, requestPermission]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.5)" />
        <Text style={styles.text}>Camera permission is required</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.permText}>Grant Permission</Text>
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

      setCapturedPhoto(photo);
      setWorkingUri(photo.uri);
      setImageSize({ width: photo.width, height: photo.height });
    } catch (e) {
      Alert.alert("Capture failed", String(e));
    } finally {
      setIsCapturing(false);
    }
  };

  const handleChooseManual = () => {
    setMode("manual");
  };

  const handleChooseAPI = async () => {
    setMode("api");
    setProcessing(true);
    try {
      const result = await removeBgFromImage(workingUri!);
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
    setMode("choose");
    setShowPreview(true);
  };

  const onTouchMove = (event: any) => {
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

  const handleSaveManual = async (category: string) => {
    if (!traced || !viewShotRef.current) {
      Alert.alert("Error", "Please trace your item first");
      return;
    }
    setProcessing(true);
    setIsUploading(true);
    try {
      const uri = await captureRef(viewShotRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const bbox = getBoundingBox(points);
      let finalUri = uri;

      if (bbox && bbox.width > 20 && bbox.height > 20) {
        const cropResult = await ImageManipulator.manipulateAsync(
          uri,
          [
            {
              crop: {
                originX: Math.max(0, bbox.x),
                originY: Math.max(0, bbox.y),
                width: bbox.width,
                height: bbox.height,
              },
            },
          ],
          { compress: 1, format: ImageManipulator.SaveFormat.PNG }
        );
        finalUri = cropResult.uri;
      }

      const downloadURL = await uploadImageToStorage(finalUri, category);
      await addItem({ uri: downloadURL, category, tags: [] });
      
      Alert.alert("Success!", `Item added to ${category}.`);
      resetAll();
      router.replace("/closet");
    } catch (error: any) {
      console.error("Save error", error);
      Alert.alert("Error", "Failed to save item");
    } finally {
      setProcessing(false);
      setIsUploading(false);
    }
  };

  const handleSaveAPI = async (category: string) => {
    if (!apiResult) return;
    setIsUploading(true);
    try {
      const downloadURL = await uploadImageToStorage(apiResult, category);
      await addItem({ uri: downloadURL, category, tags: [] });
      
      Alert.alert("Success!", `Item added to ${category}.`);
      resetAll();
      router.replace("/closet");
    } catch (error: any) {
      Alert.alert("Error", "Failed to save item");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveSkipped = async (category: string) => {
    if (!workingUri) return;
    setIsUploading(true);
    try {
      const downloadURL = await uploadImageToStorage(workingUri, category);
      await addItem({ uri: downloadURL, category, tags: [] });
      
      Alert.alert("Success!", `Item added to ${category}.`);
      resetAll();
      router.replace("/closet");
    } catch (error: any) {
      Alert.alert("Error", "Failed to save item");
    } finally {
      setIsUploading(false);
    }
  };

  const resetAll = () => {
    setCapturedPhoto(null);
    setWorkingUri(null);
    setPoints([]);
    setCompletePath("");
    setTraced(false);
    setShowPreview(false);
    setMode("choose");
    setApiResult(null);
  };

  const handleClose = () => {
    resetAll();
    router.back();
  };

  const currentPath = points.length > 5 ? getCatmullRomPath(points) : "";

  if (capturedPhoto && workingUri) {
    return (
      <View style={styles.fullscreenContainer}>
        <StatusBar hidden />
        
        {/* CHOOSE MODE */}
        {mode === "choose" && (
          <View style={styles.editorContainer}>
            <View style={styles.editorHeader}>
              <TouchableOpacity onPress={resetAll} style={styles.headerBackButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.editorTitle}>Edit Photo</Text>
                <Text style={styles.editorSubtitle}>Choose how to proceed</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.chooseContent}>
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: workingUri }} style={styles.previewImage} contentFit="contain" />
              </View>

              <View style={styles.optionsContainer}>
                <TouchableOpacity 
                  style={styles.optionCard} 
                  onPress={handleChooseAPI}
                  disabled={processing}
                >
                  <View style={styles.optionIconContainer}>
                    <Text style={styles.optionIcon}>✨</Text>
                  </View>
                  <Text style={styles.optionTitle}>Auto Remove</Text>
                  <Text style={styles.optionSubtitle}>AI-powered</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionCard} onPress={handleChooseManual}>
                  <View style={styles.optionIconContainer}>
                    <Text style={styles.optionIcon}>✏️</Text>
                  </View>
                  <Text style={styles.optionTitle}>Manual Trace</Text>
                  <Text style={styles.optionSubtitle}>Draw yourself</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Continue without editing</Text>
                <Ionicons name="arrow-forward" size={20} color="#0066ff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MANUAL TRACING MODE */}
        {mode === "manual" && !showPreview && (
          <View style={styles.editorContainer}>
            <View style={styles.editorHeader}>
              <TouchableOpacity onPress={handleReset} style={styles.headerBackButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.editorTitle}>Trace Item</Text>
                <Text style={styles.editorSubtitle}>Draw around the edges</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.drawingContainer} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
              <Image source={{ uri: workingUri }} style={styles.drawingImage} contentFit="contain" />
              <Svg height={height * 0.65} width={width} style={styles.svgOverlay}>
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
                  <Text style={styles.traceIndicatorText}>{traced ? "✓ Trace Complete" : "Keep tracing..."}</Text>
                </View>
              )}
            </View>

            <View style={styles.bottomActionBar}>
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={handleReset} 
                disabled={processing}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.secondaryButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, !traced && styles.buttonDisabled]}
                onPress={handlePreview}
                disabled={processing || !traced}
              >
                <Text style={styles.primaryButtonText}>Preview</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MANUAL PREVIEW & SAVE */}
        {mode === "manual" && showPreview && (
          <View style={styles.editorContainer}>
            <View style={styles.editorHeader}>
              <TouchableOpacity onPress={handleReset} style={styles.headerBackButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.editorTitle}>Preview</Text>
                <Text style={styles.editorSubtitle}>Select category to save</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.previewImageContainer}>
              <View ref={viewShotRef} collapsable={false} style={styles.captureView}>
                <Svg height={height * 0.5} width={width} style={{ backgroundColor: "transparent" }}>
                  <Defs>
                    <ClipPath id="mask">
                      <Path d={completePath} />
                    </ClipPath>
                  </Defs>
                  <G clipPath="url(#mask)">
                    <SvgImage href={workingUri} width={width} height={height * 0.65} preserveAspectRatio="xMidYMid slice" />
                  </G>
                </Svg>
              </View>
            </View>

            {isUploading ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#0066ff" />
                <Text style={styles.uploadingText}>Uploading to cloud...</Text>
              </View>
            ) : (
              <View style={styles.categorySection}>
                <Text style={styles.categorySectionTitle}>Save to Category</Text>
                <View style={styles.categoryGrid}>
                  {mainCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.categoryCard}
                      onPress={() => handleSaveManual(cat)}
                    >
                      <Text style={styles.categoryCardText}>{cat}</Text>
                      <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* API PREVIEW & SAVE */}
        {mode === "api" && showPreview && apiResult && (
          <View style={styles.editorContainer}>
            <View style={styles.editorHeader}>
              <TouchableOpacity onPress={handleReset} style={styles.headerBackButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.editorTitle}>AI Result</Text>
                <Text style={styles.editorSubtitle}>Background removed</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.previewImageContainer}>
              <Image source={{ uri: apiResult }} style={styles.resultImage} contentFit="contain" />
            </View>

            {isUploading ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#0066ff" />
                <Text style={styles.uploadingText}>Uploading to cloud...</Text>
              </View>
            ) : (
              <View style={styles.categorySection}>
                <Text style={styles.categorySectionTitle}>Save to Category</Text>
                <View style={styles.categoryGrid}>
                  {mainCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.categoryCard}
                      onPress={() => handleSaveAPI(cat)}
                    >
                      <Text style={styles.categoryCardText}>{cat}</Text>
                      <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* SKIP (ORIGINAL) PREVIEW & SAVE */}
        {mode === "choose" && showPreview && (
          <View style={styles.editorContainer}>
            <View style={styles.editorHeader}>
              <TouchableOpacity onPress={handleReset} style={styles.headerBackButton}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerTextContainer}>
                <Text style={styles.editorTitle}>Original Photo</Text>
                <Text style={styles.editorSubtitle}>No editing applied</Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.previewImageContainer}>
              <Image source={{ uri: workingUri }} style={styles.resultImage} contentFit="contain" />
            </View>

            {isUploading ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#0066ff" />
                <Text style={styles.uploadingText}>Uploading to cloud...</Text>
              </View>
            ) : (
              <View style={styles.categorySection}>
                <Text style={styles.categorySectionTitle}>Save to Category</Text>
                <View style={styles.categoryGrid}>
                  {mainCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={styles.categoryCard}
                      onPress={() => handleSaveSkipped(cat)}
                    >
                      <Text style={styles.categoryCardText}>{cat}</Text>
                      <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {processing && mode !== "choose" && (
          <View style={styles.processingOverlay}>
            <View style={styles.processingCard}>
              <ActivityIndicator size="large" color="#0066ff" />
              <Text style={styles.processingText}>
                {mode === "api" ? "Removing background..." : "Processing..."}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar hidden />
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      
      <TouchableOpacity style={styles.cameraCloseButton} onPress={handleClose}>
        <Ionicons name="close" size={28} color="white" />
      </TouchableOpacity>

      <View style={styles.cameraControls}>
        <View style={styles.cameraGuide}>
          <Text style={styles.cameraGuideText}>Center your item in frame</Text>
        </View>
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
    backgroundColor: "#000",
    zIndex: 9999,
  },
  camera: { 
    flex: 1,
    width: "100%",
    height: "100%",
  },
  cameraControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 60,
    alignItems: "center",
  },
  cameraGuide: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 30,
  },
  cameraGuideText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
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
    padding: 32,
    backgroundColor: "#000",
    gap: 16,
  },
  text: { 
    color: "#fff", 
    fontSize: 18, 
    textAlign: "center",
    fontWeight: "600",
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "500",
  },
  permBtn: {
    backgroundColor: "#0066ff",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  permText: { 
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  cameraCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  editorContainer: { 
    flex: 1, 
    backgroundColor: "#000" 
  },
  editorHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingTop: 50, 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    backgroundColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerBackButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: "rgba(255,255,255,0.1)", 
    justifyContent: "center", 
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
  },
  editorTitle: { 
    fontSize: 18, 
    fontWeight: "800", 
    color: "#fff" 
  },
  editorSubtitle: { 
    fontSize: 12, 
    fontWeight: "500", 
    marginTop: 2, 
    color: "rgba(255,255,255,0.6)" 
  },
  chooseContent: { 
    flex: 1, 
    padding: 20,
  },
  imagePreviewContainer: {
    flex: 1,
    maxHeight: height * 0.4,
    marginBottom: 24,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  previewImage: { 
    width: "100%", 
    height: "100%",
  },
  optionsContainer: { 
    flexDirection: "row", 
    gap: 12, 
    marginBottom: 16,
  },
  optionCard: { 
    flex: 1, 
    backgroundColor: "rgba(255,255,255,0.1)", 
    borderRadius: 16, 
    padding: 20, 
    alignItems: "center", 
    borderWidth: 2, 
    borderColor: "rgba(255,255,255,0.2)" 
  },
  optionIconContainer: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    backgroundColor: "rgba(255,255,255,0.15)", 
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: 12 
  },
  optionIcon: { fontSize: 36 },
  optionTitle: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#fff", 
    marginBottom: 4 
  },
  optionSubtitle: { 
    fontSize: 12, 
    fontWeight: "500", 
    color: "rgba(255,255,255,0.6)" 
  },
  skipButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: "rgba(255,255,255,0.05)", 
    paddingVertical: 16, 
    borderRadius: 12, 
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  skipButtonText: { 
    fontSize: 15, 
    fontWeight: "600", 
    color: "rgba(255,255,255,0.8)" 
  },
  drawingContainer: { 
    flex: 1, 
    position: "relative", 
    backgroundColor: "#000" 
  },
  drawingImage: { 
    width: "100%", 
    height: height * 0.65 
  },
  svgOverlay: { 
    position: "absolute", 
    top: 0, 
    left: 0 
  },
  traceIndicator: { 
    position: "absolute", 
    top: 20, 
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  traceIndicatorText: { 
    color: "#00ff88", 
    fontSize: 14, 
    fontWeight: "700" 
  },
  bottomActionBar: { 
    flexDirection: "row", 
    padding: 16, 
    gap: 12, 
    backgroundColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  secondaryButton: { 
    flex: 1, 
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.1)", 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: "center", 
    justifyContent: "center", 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.2)" 
  },
  secondaryButtonText: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#fff" 
  },
  primaryButton: { 
    flex: 1, 
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#0066ff", 
    paddingVertical: 75, 
    borderRadius: 4, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  primaryButtonText: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#fff" 
  },
  buttonDisabled: { 
    opacity: 0.4 
  },
  previewImageContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "#000",
  },
  captureView: { 
    backgroundColor: "transparent",
    width: width,
    height: height * 0.5,
  },
  resultImage: {
    width: "100%",
    height: "100%",
  },
  uploadingOverlay: { 
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.95)",
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  uploadingText: { 
    color: "#fff", 
    fontSize: 18, 
    fontWeight: "700", 
    marginTop: 16 
  },
  categorySection: { 
    backgroundColor: "#000", 
    padding: 20,
    paddingBottom: 70,
  },
  categorySectionTitle: { 
    fontSize: 20, 
    fontWeight: "800", 
    color: "#fff", 
    marginBottom: 16,
    textAlign: "center",
  },
  categoryGrid: { 
    gap: 12,
  },
  categoryCard: { 
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.95)", 
    paddingVertical: 18, 
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  categoryCardText: { 
    fontSize: 17, 
    fontWeight: "700", 
    color: "#1a1a1a" 
  },
  processingOverlay: { 
    position: "absolute", 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: "rgba(0,0,0,0.9)", 
    justifyContent: "center", 
    alignItems: "center", 
    zIndex: 10 
  },
  processingCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
  },
  processingText: { 
    marginTop: 16, 
    fontSize: 16, 
    fontWeight: "600", 
    color: "#fff" 
  },
});
