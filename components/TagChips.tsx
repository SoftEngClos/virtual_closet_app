// components/TagChips.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useCloset } from "app/ClosetProvider";

type Props = {
  tags: string[];
  onAdd(tag: string): void;
  onRemove(tag: string): void;
};

export default function TagChips({ tags, onAdd, onRemove }: Props) {
  const [input, setInput] = useState("");
  const { availableTags } = useCloset();

  const suggestions = availableTags.filter((t) => {
    const needle = input.trim().toLowerCase();
    return !tags.includes(t) && (!needle || t.toLowerCase().includes(needle));
  });

  const handleAdd = (tag?: string) => {
    const value = (tag ?? input).trim();
    if (!value) return;
    if (tags.includes(value)) {
      setInput("");
      return;
    }
    onAdd(value);
    setInput("");
  };

  return (
    <View style={{ gap: 8 }}>
      {/* input + Add button */}
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="Add tag (e.g., casual, summer)"
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd()}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* suggested tags (from other items) */}
      {suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.suggestRow}
        >
          {suggestions.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={styles.suggestChip}
              onPress={() => handleAdd(tag)}
            >
              <Text style={styles.suggestText}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* current tags on this item */}
      <View style={styles.tagsRow}>
        {tags.map((tag) => (
          <View key={tag} style={styles.tagChip}>
            <Text style={styles.tagText}>#{tag}</Text>
            <TouchableOpacity onPress={() => onRemove(tag)}>
              <Text style={styles.removeText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1677ff",
  },
  addText: {
    color: "white",
    fontWeight: "600",
  },
  suggestRow: {
    marginTop: 4,
  },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1677ff",
    marginRight: 6,
    backgroundColor: "#f5f8ff",
  },
  suggestText: {
    color: "#1677ff",
    fontSize: 12,
    fontWeight: "500",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#f0f0f0",
    gap: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  removeText: {
    fontSize: 12,
    color: "#999",
  },
});
