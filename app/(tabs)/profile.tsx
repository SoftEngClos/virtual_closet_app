import React from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { getAuth, signOut } from "firebase/auth"; // Uncomment if using Firebase
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert(
      "Confirm Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              
              const auth = getAuth();
              await signOut(auth);


              console.log("User signed out successfully");

              // Navigate to login screen or wherever appropriate
              router.push("/"); // adjust the path if needed
            } catch (error) {
              console.error("Sign out failed:", error);
              Alert.alert("Sign Out Failed", "Something went wrong. Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Profile</Text>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 40 },
  signOutButton: {
    backgroundColor: "#ff3b30",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  signOutText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
