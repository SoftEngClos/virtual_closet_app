import React, {useState} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  Modal, 
  TextInput,
  Pressable,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useCloset } from "../ClosetProvider";
import {Link} from "expo-router";


const categories = ["Shirts", "Pants", "Shoes", "Accessories"];

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

const ClosetScreen = () => {
  const { closet, addItem, removeItem, addTag, removeTag } = useCloset();

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagText, setTagText] = useState("");
  const [target, setTarget] = useState<{ id: string; category: string } | null>(null);

  const openTagModal = (id: string, category: string) => {
    setTarget({ id, category });
    setTagText("");
    setTagModalOpen(true);
  };

  const submitTag = () => {
    if (target && tagText.trim()) {
      addTag(target.id, target.category, tagText.trim());
    }
    setTagModalOpen(false);
    setTagText("");
  };


  const pickImage = async (category: string, fromCamera: boolean) => {
    try {
      if (Platform.OS !== "web") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return alert("Permission required!");
      }

      let result;
      if (fromCamera) {
        if (Platform.OS !== "web") {
          const { status } =
            await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") return alert("Permission required!");
        }
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          quality: 1,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 1,
        });
      }

      if (!result.canceled && result.assets.length > 0) {
        const newItem = {
          id: Date.now().toString(),
          uri: result.assets[0].uri,
          category,
          tags: [],
        };
        addItem(newItem);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showImageMenu = (itemId: string, category: string) => {
    Alert.alert("Options", "Choose an action", [
      {
        text: "Add Tag",
        onPress: () => openTagModal(itemId, category),
      },
      {
        text: "Remove Item",
        onPress: () => removeItem(itemId, category),
        style: "destructive",
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Closet</Text>

      {categories.map((cat) => (
        <View key={cat}>
          <Text style={styles.categoryTitle}>{cat}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => pickImage(cat, true)}
            >
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => pickImage(cat, false)}
            >
              <Text style={styles.buttonText}>Add from Gallery</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={closet[cat]}
            keyExtractor={(item) => item.id}
            horizontal
            renderItem={({ item }) => (
              <View style={styles.card}>
              <TouchableOpacity
                onPress={() => openTagModal(item.id, cat)}
                onLongPress={() => showImageMenu(item.id, cat)}
                style={styles.imageWrapper}
              >
                <Image source={{ uri: item.uri }} style={styles.image} />
              </TouchableOpacity>

              <TagChips
                tags = {item.tags}
                onRemove={(t) => removeTag(item.id, cat, t)}
                />
          </View>
      )}
      />
    </View>
  ))}
{/* Tag Add Modal */}
  <Modal transparent visible={tagModalOpen} animationType="fade" onRequestClose={() => setTagModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 16, fontWeight: "600", marginBottom: 8 }}>Add a tag</Text>
            <TextInput
              value={tagText}
              onChangeText={setTagText}
              placeholder="e.g., casual"
              autoFocus
              style={styles.input}
              onSubmitEditing={submitTag}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
              <Pressable onPress={() => setTagModalOpen(false)}><Text style={styles.modalBtn}>Cancel</Text></Pressable>
              <Pressable onPress={submitTag}><Text style={styles.modalBtnPrimary}>Add</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  categoryTitle: { fontSize: 20, fontWeight: "600", marginTop: 20 },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 8,
  },
  actionButton: {
    backgroundColor: "#4B7BEC",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontSize: 14 },
  card: {width: 120, margin: 5},
  imageWrapper: { margin: 5 },
  image: { width: 80, height: 80, borderRadius: 8 },
  
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { backgroundColor: "#eee", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999 },
  chipText: { fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "85%", backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 8 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 6 },
  modalBtn: { fontSize: 16 },
  modalBtnPrimary: { fontSize: 16, fontWeight: "700" },
});

export default ClosetScreen;

