import React, { useEffect, useState } from "react";
import {
  View,
  Image,
  Text,
  Button,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getFirestore,
} from "firebase/firestore";
import { deleteItem } from "../../lib/items";
import TagChips from "../../components/TagChips";
import { useCloset } from "app/ClosetProvider"; // 👈 NEW

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = getFirestore();

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 👇 All reusable tags across closet, computed in ClosetProvider
  const { availableTags } = useCloset();

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "items", id));
      setItem({ id: snap.id, ...snap.data() });
      setLoading(false);
    })();
  }, [id]);

  async function onAddTag(t: string) {
    const tag = t.trim();
    if (!tag) return;

    await updateDoc(doc(db, "items", id), { tags: arrayUnion(tag) });
    setItem((prev: any) => ({
      ...prev,
      tags: Array.from(new Set([...(prev?.tags || []), tag])),
    }));
  }

  async function onRemoveTag(t: string) {
    await updateDoc(doc(db, "items", id), { tags: arrayRemove(t) });
    setItem((prev: any) => ({
      ...prev,
      tags: (prev?.tags || []).filter((x: string) => x !== t),
    }));
  }

  function handleDelete() {
    Alert.alert("Delete item", "This will remove the item and its image.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteItem(id as string, item?.imageUrl, item?.originalUrl);
          router.back();
        },
      },
    ]);
  }

  if (loading) return <ActivityIndicator />;

  const currentTags: string[] = item?.tags || [];

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {item?.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: "100%", height: 300, borderRadius: 12 }}
        />
      ) : null}

      <Text style={{ fontSize: 18, fontWeight: "600" }}>
        {item?.category}
      </Text>

      {/* Existing free-form tags UI */}
      <TagChips
        tags={currentTags}
        onAdd={onAddTag}
        onRemove={onRemoveTag}
      />

      {/* NEW: quick-select reusable tags */}
      {availableTags && availableTags.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>
            Quick tags
          </Text>
          <View style={styles.quickRow}>
            {availableTags.map((tag) => {
              const selected = currentTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.quickChip,
                    selected && styles.quickChipSelected,
                  ]}
                  onPress={() =>
                    selected ? onRemoveTag(tag) : onAddTag(tag)
                  }
                >
                  <Text
                    style={[
                      styles.quickText,
                      selected && styles.quickTextSelected,
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <Button title="Delete" onPress={handleDelete} color="#c0392b" />
    </View>
  );
}

const styles = StyleSheet.create({
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickChipSelected: {
    backgroundColor: "#0066ff",
    borderColor: "#0066ff",
  },
  quickText: {
    fontSize: 13,
    color: "#333",
  },
  quickTextSelected: {
    color: "#fff",
  },
});
