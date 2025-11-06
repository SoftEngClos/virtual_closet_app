import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  GestureResponderEvent,
  Image as RNImage,
  PanResponder,
} from "react-native";
import Svg, { Image as SvgImage, ClipPath, Defs, Polygon, G, Rect, Circle, Line } from "react-native-svg";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system";

type Pt = { x: number; y: number };

export default function FreeformCropper({
  uri,
  onCancel,
  onDone,
}: {
  uri: string;
  onCancel: () => void;
  onDone: (outUri: string) => void;
}) {
  const { width: W } = useWindowDimensions();
  const [imgW, setImgW] = useState<number>(W);
  const [imgH, setImgH] = useState<number>(Math.round(W * 1.3));
  const [points, setPoints] = useState<Pt[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const shotRef = useRef<View>(null);

  // Load the source image dimensions so we can keep its aspect ratio
  useEffect(() => {
    RNImage.getSize(
      uri,
      (w, h) => {
        const scale = W / w;
        setImgW(W);
        setImgH(Math.max(320, Math.round(h * scale)));
      },
      () => {
        // fallback if we can't read size
        setImgW(W);
        setImgH(Math.round(W * 1.3));
      }
    );
  }, [uri, W]);

  // Add point or select near an existing one
  const onGrant = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const hit = points.findIndex((pt) => {
      const dx = pt.x - locationX;
      const dy = pt.y - locationY;
      return dx * dx + dy * dy < 20 * 20;
    });
    if (hit >= 0) setActiveIdx(hit);
    else setPoints((p) => [...p, { x: locationX, y: locationY }]);
  };

  const onMove = (e: GestureResponderEvent) => {
    if (activeIdx == null) return;
    const { locationX, locationY } = e.nativeEvent;
    setPoints((prev) =>
      prev.map((pt, i) => (i === activeIdx ? { x: locationX, y: locationY } : pt))
    );
  };

  const onRelease = () => setActiveIdx(null);

  // Convert points to "x1,y1 x2,y2 ..." for SVG <Polygon>
  const pointsAttr = useMemo(
    () => (points.length ? points.map((p) => `${p.x},${p.y}`).join(" ") : ""),
    [points]
  );

  // Export: capture the masked view as PNG with transparency
  const exportMasked = useCallback(async () => {
    if (!shotRef.current || points.length < 3) return;
    
    // Capture PNG with alpha
    const outPath = await captureRef(shotRef, {
        format: "png",
        quality: 1,
        result: "tmpfile", // changed from before
    })
    onDone(outPath);
  }, [onDone, points.length]);

  return (
    <View
      style={{ flex: 1, backgroundColor: "black" }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
    >
      {/* This view is what we snapshot (masked image only) */}
      <View
        ref={shotRef}
        collapsable={false}
        style={{ width: W, height: imgH, backgroundColor: "transparent", alignSelf: "center" }}
      >
        <Svg width={W} height={imgH}>
          <Defs>
            {points.length >= 3 && (
              <ClipPath id="clip">
                <Polygon points={pointsAttr} />
              </ClipPath>
            )}
          </Defs>

          {/* Background transparent rect so outside stays transparent */}
          <Rect x={0} y={0} width={W} height={imgH} fill="transparent" />

          {/* Image masked by polygon if present; otherwise plain image */}
          <G clipPath={points.length >= 3 ? "url(#clip)" : undefined}>
            <SvgImage
              width={imgW}
              height={imgH}
              href={{ uri }}
              x={0}
              y={0}
              preserveAspectRatio="xMidYMid slice"
            />
          </G>
        </Svg>
      </View>

      {/* Overlay guides (not included in the snapshot) */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" }}>
        <Svg width={W} height={imgH} style={{ marginTop: 0 }}>
          {/* Outline and handles for current polygon */}
          {points.length > 0 && (
            <>
              {/* Outline (open unless 3+ points, we still show lines) */}
              {points.length >= 2 &&
                points.slice(1).map((p, i) => {
                  const prev = points[i];
                  return (
                    <Line
                      key={`seg-${i}`}
                      x1={prev.x}
                      y1={prev.y}
                      x2={p.x}
                      y2={p.y}
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth={2}
                    />
                  );
                })}
              {points.length >= 3 && (
                <Line
                  x1={points[points.length - 1].x}
                  y1={points[points.length - 1].y}
                  x2={points[0].x}
                  y2={points[0].y}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth={2}
                />
              )}
              {points.map((pt, i) => (
                <Circle
                  key={`pt-${i}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={6}
                  fill={i === activeIdx ? "#00E5FF" : "#FFFFFF"}
                />
              ))}
            </>
          )}
        </Svg>
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => setPoints((p) => p.slice(0, -1))}
          disabled={points.length === 0}
          style={styles.btn}
        >
          <Text style={styles.btnTxt}>Undo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setPoints([])}
          disabled={points.length === 0}
          style={styles.btn}
        >
          <Text style={styles.btnTxt}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={styles.btn}>
          <Text style={styles.btnTxt}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={exportMasked}
          disabled={points.length < 3}
          style={[styles.btn, points.length < 3 && { opacity: 0.5 }]}
        >
          <Text style={styles.btnTxt}>Done</Text>
        </TouchableOpacity>
      </View>

          {/* Top header with Cancel / Done */}
            <View style={styles.header} pointerEvents="box-none">
            <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
                <Text style={styles.headerTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={exportMasked}
                disabled={points.length < 3}
                style={[styles.headerBtn, points.length < 3 && { opacity: 0.5 }]}
            >
                <Text style={styles.headerTxt}>Done</Text>
            </TouchableOpacity>
            </View>


    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
  btn: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnTxt: { color: "#1a1a1a", fontWeight: "700" },
  header: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10001,
  },
  headerBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  headerTxt: {color: "white", fontWeight: "700", fontSize: 16},
});
