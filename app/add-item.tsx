// app/add-item.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from "react-native";
import * as MediaLibrary from "expo-media-library";
import React from "react";
import {router, type Href} from "expo-router";

const {uri} = useLocalSearchParams<{uri?: string }>();
const href: Href = "/(tabs)/closet";

export default function AddItem() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasMediaPermission(status === "granted");
    })();
  }, []);

  const saveItem = async () => {
    try {
      if (!uri) {
        Alert.alert("No photo", "Please retake the photo.");
        return;
      }

      // Example: save photo to device library (optional)
      if (hasMediaPermission) {
        await MediaLibrary.saveToLibraryAsync(uri);
      }

      // TODO: upload to your backend (Supabase/Firebase) with metadata
      // await uploadClothingItem({ uri, title, tags: tags.split(",").map(t => t.trim()) });

      Alert.alert("Saved", "Clothing item added!");
      router.replace(href); // go back to your main tab
    } catch (e) {
      Alert.alert("Save failed", String(e));
    }
  };

  const retake = () => router.replace("/(tabs)/plus");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Add Clothing Item</Text>

      {uri ? (
        <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
      ) : (
        <View style={styles.previewFallback}>
          <Text>No photo</Text>
        </View>
      )}

      <Text style={styles.label}>Title</Text>
      <TextInput
        placeholder="e.g., Black Hoodie"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />

      <Text style={styles.label}>Tags (comma-separated)</Text>
      <TextInput
        placeholder="e.g., casual, winter, black"
        value={tags}
        onChangeText={setTags}
        style={styles.input}
      />

      <View style={styles.actions}>
        <TouchableOpacity onPress={retake} style={[styles.btn, styles.secondary]}>
          <Text style={styles.btnText}>Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={saveItem} style={[styles.btn, styles.primary]}>
          <Text style={styles.btnText}>Save</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  header: { fontSize: 20, fontWeight: "600", marginBottom: 8 },
  preview: { width: "100%", height: 360, borderRadius: 12, backgroundColor: "#111" },
  previewFallback: {
    width: "100%", height: 360, borderRadius: 12, backgroundColor: "#eee",
    alignItems: "center", justifyContent: "center",
  },
  label: { fontWeight: "600", marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, gap: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  primary: { backgroundColor: "#111" },
  secondary: { backgroundColor: "#999" },
  btnText: { color: "white", fontWeight: "600" },
});
