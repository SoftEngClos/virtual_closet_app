import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useCloset } from "../ClosetProvider";
import {Link} from "expo-router";

const categories = ["Shirts", "Pants", "Shoes", "Accessories"];



const ClosetScreen = () => {
  const { closet, addItem, removeItem } = useCloset();

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
              <TouchableOpacity
                onPress={() => showImageMenu(item.id, cat)}
                style={styles.imageWrapper}
              >
                <Image source={{ uri: item.uri }} style={styles.image} />
              </TouchableOpacity>
            )}
          />
        </View>
      ))}
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
  imageWrapper: { margin: 5 },
  image: { width: 80, height: 80, borderRadius: 8 },
});

export default ClosetScreen;

