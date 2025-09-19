import { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Image,
    StyleSheet,
    Alert,
    Modal,
    TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

type ClosetItem = {
    id: string;
    uri: string;
    categories: string[];
};

export default function ClosetScreen() {
    const [closet, setCloset] = useState<ClosetItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState<ClosetItem | null>(null);
    const [newCategory, setNewCategory] = useState("");

    const pickFromGallery = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });
        if (!result.canceled) {
            const newItem: ClosetItem = {
                id: Date.now().toString(),
                uri: result.assets[0].uri,
                categories: [],
            };
            setCloset((prev) => [...prev, newItem]);
        }
    };

    const takePhoto = async () => {
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.7,
        });
        if (!result.canceled) {
            const newItem: ClosetItem = {
                id: Date.now().toString(),
                uri: result.assets[0].uri,
                categories: [],
            };
            setCloset((prev) => [...prev, newItem]);
        }
    };

    const removeItem = (itemId: string) => {
        setCloset((prev) => prev.filter((item) => item.id !== itemId));
        setModalVisible(false);
    };

    const handleAddToCategory = (category: string) => {
        if (!selectedItem) return;

        setCloset((prev) =>
            prev.map((item) =>
                item.id === selectedItem.id
                    ? { ...item, categories: [...new Set([...item.categories, category])] }
                    : item
            )
        );

        if (!categories.includes(category)) {
            setCategories((prev) => [...prev, category]);
        }

        setModalVisible(false);
        setNewCategory("");
    };

    const openOptions = (item: ClosetItem) => {
        setSelectedItem(item);
        setModalVisible(true);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Your Closet</Text>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={pickFromGallery}>
                    <Ionicons name="images-outline" size={24} color="#fff" />
                    <Text style={styles.btnText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={24} color="#fff" />
                    <Text style={styles.btnText}>Camera</Text>
                </TouchableOpacity>
            </View>

            {closet.length === 0 ? (
                <Text style={{ marginTop: 20, color: "#555" }}>No clothes added yet.</Text>
            ) : (
                <FlatList
                    data={closet}
                    keyExtractor={(item) => item.id}
                    numColumns={3}
                    renderItem={({ item }) => (
                        <View style={styles.itemWrapper}>
                            <Image source={{ uri: item.uri }} style={styles.clothingItem} />
                            <TouchableOpacity
                                style={styles.moreBtn}
                                onPress={() => openOptions(item)}
                            >
                                <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}
                    contentContainerStyle={styles.grid}
                />
            )}

            {/* Modal for options */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        {selectedItem && (
                            <>
                                <TouchableOpacity
                                    style={styles.modalOption}
                                    onPress={() => removeItem(selectedItem.id)}
                                >
                                    <Text style={styles.modalText}>Remove</Text>
                                </TouchableOpacity>

                                <Text style={styles.modalTitle}>Add to Category</Text>
                                {categories.length === 0 ? (
                                    <>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Enter new category"
                                            value={newCategory}
                                            onChangeText={setNewCategory}
                                        />
                                        <TouchableOpacity
                                            style={styles.modalOption}
                                            onPress={() => {
                                                if (newCategory.trim()) handleAddToCategory(newCategory.trim());
                                            }}
                                        >
                                            <Text style={styles.modalText}>Create & Add</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        {categories.map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                style={styles.modalOption}
                                                onPress={() => handleAddToCategory(cat)}
                                            >
                                                <Text style={styles.modalText}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                        <TextInput
                                            style={styles.input}
                                            placeholder="➕ New category"
                                            value={newCategory}
                                            onChangeText={setNewCategory}
                                        />
                                        {newCategory.trim() !== "" && (
                                            <TouchableOpacity
                                                style={styles.modalOption}
                                                onPress={() => handleAddToCategory(newCategory.trim())}
                                            >
                                                <Text style={styles.modalText}>Create & Add</Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: "#f5f7fa" },
    title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
    actions: { flexDirection: "row", gap: 12, marginBottom: 20 },
    actionBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#007bff",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
    },
    btnText: { color: "#fff", fontWeight: "600", marginLeft: 6 },
    grid: { gap: 8 },
    itemWrapper: {
        position: "relative",
        margin: 4,
    },
    clothingItem: {
        width: 100,
        height: 100,
        borderRadius: 8,
    },
    moreBtn: {
        position: "absolute",
        top: 6,
        right: 6,
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: 50,
        padding: 4,
    },
    modalOverlay: {
        flex: 1,
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
        padding: 20,
    },
    modalBox: {
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 16,
    },
    modalTitle: { fontWeight: "bold", marginVertical: 10, fontSize: 16 },
    modalOption: {
        paddingVertical: 8,
    },
    modalText: { fontSize: 16, color: "#007bff" },
    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 6,
        padding: 8,
        marginVertical: 8,
    },
});
