import React, { useEffect, useState } from "react";
import { View, Image, Text, Button, Alert, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, getFirestore } from "firebase/firestore";
import { deleteItem } from "../../lib/items";
import TagChips from "../../components/TagChips";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = getFirestore();

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "items", id));
      setItem({ id: snap.id, ...snap.data() });
      setLoading(false);
    })();
  }, [id]);

  async function onAddTag(t: string) {
    await updateDoc(doc(db, "items", id), { tags: arrayUnion(t) });
    setItem((prev: any) => ({ ...prev, tags: Array.from(new Set([...(prev.tags || []), t])) }));
  }

  async function onRemoveTag(t: string) {
    await updateDoc(doc(db, "items", id), { tags: arrayRemove(t) });
    setItem((prev: any) => ({ ...prev, tags: (prev.tags || []).filter((x: string) => x !== t) }));
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

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {item?.imageUrl ? <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 300, borderRadius: 12 }} /> : null}
      <Text style={{ fontSize: 18, fontWeight: "600" }}>{item?.category}</Text>
      <TagChips tags={item?.tags || []} onAdd={onAddTag} onRemove={onRemoveTag} />
      <Button title="Delete" onPress={handleDelete} color="#c0392b" />
    </View>
  );
}
