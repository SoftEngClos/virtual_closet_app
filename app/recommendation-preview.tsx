// app/recommendation-preview.tsx
import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useCloset } from "app/ClosetProvider";

import { auth, db } from "../firebaseConfig";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

export default function RecommendationPreviewScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { pendingRecommendedOutfit } = useCloset();

  if (!pendingRecommendedOutfit) {
    return (
      <View style={styles.center}>
        <Text>No recommended outfit to show.</Text>
      </View>
    );
  }

  const handleUseOutfit = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Not signed in", "Please log in first.");
      return;
    }

    if (!date) {
      Alert.alert(
        "No date selected",
        "We couldn't find the selected date for this outfit."
      );
      return;
    }

    try {
      const eventsRef = collection(db, "calendar");

      // Check if there's already an event for this user & date
      const q = query(
        eventsRef,
        where("uid", "==", user.uid),
        where("date", "==", date)
      );
      const snap = await getDocs(q);

if (!snap.empty) {
  // Update the existing event
  const existing = snap.docs[0];
  await updateDoc(doc(db, "calendar", existing.id), {
    outfitId: pendingRecommendedOutfit.id,
    outfitCategory: pendingRecommendedOutfit.tags?.[0] ?? "Recommended",
    title: pendingRecommendedOutfit.name,
  });
} else {
  // Create a brand-new calendar event
  await addDoc(eventsRef, {
    uid: user.uid,
    date,
    outfitId: pendingRecommendedOutfit.id,
    outfitCategory: pendingRecommendedOutfit.tags?.[0] ?? "Recommended",
    title: pendingRecommendedOutfit.name,
    createdAt: new Date().toISOString(),
  });
}


      Alert.alert("Saved", "This outfit has been scheduled for that day.");

      // Go back to the calendar tab
      router.push("/(tabs)/calendar");
    } catch (err: any) {
      console.error("Error saving recommended outfit:", err);
      Alert.alert(
        "Error",
        err?.message ?? "Failed to schedule this outfit. Please try again."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{pendingRecommendedOutfit.name}</Text>

      {pendingRecommendedOutfit.thumbnailUrl ? (
        <Image
          source={{ uri: pendingRecommendedOutfit.thumbnailUrl }}
          style={styles.image}
        />
      ) : (
        <Text style={{ textAlign: "center", marginBottom: 16 }}>
          No image available
        </Text>
      )}

      <Text style={styles.tags}>
        Tags: {pendingRecommendedOutfit.tags?.join(", ") ?? "No tags"}

      </Text>

      <TouchableOpacity style={styles.button} onPress={handleUseOutfit}>
        <Text style={styles.buttonText}>Use this outfit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  image: {
    width: 220,
    height: 220,
    alignSelf: "center",
    marginBottom: 16,
    borderRadius: 12,
  },
  tags: { textAlign: "center", marginBottom: 24 },
  button: {
    backgroundColor: "#0066ff",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    alignSelf: "center",
    minWidth: 200,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
