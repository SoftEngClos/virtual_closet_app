import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";

type Props = {
  outfits: Array<{
    id: string;
    name: string;
    tags: string[];
    thumbnailUrl?: string;
  }>;
  onWear?: (id: string) => void;
};

export default function RecommendationList({ outfits, onWear }: Props) {
  if (!outfits?.length) return null;

  return (
    <View style={{ gap: 12 }}>
      {outfits.map((o) => (
        <View
          key={o.id}
          style={{
            borderWidth: 1,
            borderColor: "#333",
            borderRadius: 12,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          {o.thumbnailUrl ? (
            <Image
              source={{ uri: o.thumbnailUrl }}
              style={{ width: 64, height: 64, borderRadius: 8 }}
            />
          ) : (
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 8,
                backgroundColor: "#222",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text>👗</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600" }}>{o.name}</Text>
            <Text style={{ opacity: 0.7, marginTop: 2 }}>
              {o.tags?.slice(0, 5).join(" • ") || "—"}
            </Text>
          </View>
          {onWear && (
            <TouchableOpacity
              onPress={() => onWear(o.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: "#444",
              }}
            >
              <Text>Wear</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}
