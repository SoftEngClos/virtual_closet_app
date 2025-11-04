import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  ScrollView,
  Switch,
  Modal,
  TextInput,
  Image,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from "@expo/vector-icons";
import { 
  getAuth, 
  signOut, 
  updateProfile, 
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { useRouter } from "expo-router";
import { useCloset } from "../ClosetProvider";

export default function ProfileScreen() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;
  const { closet } = useCloset();

  // Settings states
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  // Modal states
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Get face image from closet
  const faceImage = closet["Face"]?.[0]?.uri;

  const handleUpdateProfile = async () => {
    if (!newDisplayName.trim()) {
      Alert.alert("Error", "Username cannot be empty.");
      return;
    }

    try {
      await updateProfile(user!, {
        displayName: newDisplayName.trim(),
      });
      Alert.alert("Success", "Username updated successfully!");
      setEditProfileModal(false);
      setNewDisplayName(user?.displayName || "");
    } catch (error: any) {
      console.error("Update profile error:", error);
      Alert.alert("Error", error.message || "Failed to update username.");
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    try {
      // Reauthenticate user
      const credential = EmailAuthProvider.credential(
        user!.email!,
        currentPassword
      );
      await reauthenticateWithCredential(user!, credential);

      // Update password
      await updatePassword(user!, newPassword);
      
      Alert.alert("Success", "Password changed successfully!");
      setChangePasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Change password error:", error);
      if (error.code === "auth/wrong-password") {
        Alert.alert("Error", "Current password is incorrect.");
      } else {
        Alert.alert("Error", error.message || "Failed to change password.");
      }
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
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
              await signOut(auth);
              console.log("User signed out successfully");
              router.push("/");
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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUser(user!);
              router.push("/");
            } catch (error: any) {
              console.error("Delete account error:", error);
              if (error.code === "auth/requires-recent-login") {
                Alert.alert(
                  "Reauthentication Required",
                  "For security reasons, please sign out and sign in again before deleting your account."
                );
              } else {
                Alert.alert("Error", error.message || "Failed to delete account.");
              }
            }
          },
        },
      ]
    );
  };

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    showArrow = true,
    rightComponent 
  }: any) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={!onPress && !rightComponent}
    >
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color="#0066ff" />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent ? rightComponent : showArrow && (
        <Ionicons name="chevron-forward" size={20} color="#999" />
      )}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {faceImage ? (
              <Image source={{ uri: faceImage }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={40} color="#fff" />
            )}
          </View>
          <Text style={styles.userName}>
            {user?.displayName || "Set Username"}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Account Settings */}
        <SectionHeader title="ACCOUNT" />
        <View style={styles.section}>
          <SettingItem
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your username"
            onPress={() => {
              setNewDisplayName(user?.displayName || "");
              setEditProfileModal(true);
            }}
          />
          <SettingItem
            icon="shield-checkmark-outline"
            title="Privacy & Security"
            subtitle="Manage your privacy settings"
            onPress={() => Alert.alert("Coming Soon", "Privacy settings coming soon!")}
          />
          <SettingItem
            icon="key-outline"
            title="Change Password"
            subtitle="Update your password"
            onPress={() => setChangePasswordModal(true)}
          />
        </View>

        {/* App Settings */}
        <SectionHeader title="APP SETTINGS" />
        <View style={styles.section}>
          <SettingItem
            icon="notifications-outline"
            title="Notifications"
            subtitle="Enable outfit reminders"
            showArrow={false}
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: "#e0e0e0", true: "#0066ff" }}
                thumbColor="#fff"
              />
            }
          />
          <SettingItem
            icon="moon-outline"
            title="Dark Mode"
            subtitle="Switch to dark theme"
            showArrow={false}
            rightComponent={
              <Switch
                value={darkModeEnabled}
                onValueChange={setDarkModeEnabled}
                trackColor={{ false: "#e0e0e0", true: "#0066ff" }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Closet Settings */}
        <SectionHeader title="CLOSET" />
        <View style={styles.section}>
          <SettingItem
            icon="pricetag-outline"
            title="Manage Tags"
            subtitle="Edit and organize your tags"
            onPress={() => Alert.alert("Coming Soon", "Tag management coming soon!")}
          />
          <SettingItem
            icon="file-tray-outline"
            title="Storage Management"
            subtitle="Organize your storage locations"
            onPress={() => Alert.alert("Coming Soon", "Storage management coming soon!")}
          />
          <SettingItem
            icon="stats-chart-outline"
            title="Wardrobe Statistics"
            subtitle="View your closet insights"
            onPress={() => Alert.alert("Coming Soon", "Statistics feature coming soon!")}
          />
          <SettingItem
            icon="cash-outline"
            title="Price Per Wear"
            subtitle="Track cost per wear for items"
            onPress={() => Alert.alert("Coming Soon", "Price tracking coming soon!")}
          />
        </View>

        {/* Support */}
        <SectionHeader title="SUPPORT" />
        <View style={styles.section}>
          <SettingItem
            icon="help-circle-outline"
            title="Help & Support"
            subtitle="Get help with the app"
            onPress={() => Alert.alert("Coming Soon", "Support feature coming soon!")}
          />
          <SettingItem
            icon="information-circle-outline"
            title="About"
            subtitle="App version 1.0.0"
            onPress={() => Alert.alert("About", "Closet App v1.0.0\n\nYour digital wardrobe assistant.")}
          />
          <SettingItem
            icon="document-text-outline"
            title="Terms & Privacy"
            subtitle="Read our policies"
            onPress={() => Alert.alert("Coming Soon", "Terms & Privacy coming soon!")}
          />
        </View>

        {/* Sign Out and Delete Account */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={22} color="#ff3b30" />
            <Text style={styles.dangerText}>Sign Out</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={22} color="#ff3b30" />
            <Text style={styles.dangerText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        transparent
        visible={editProfileModal}
        animationType="fade"
        onRequestClose={() => setEditProfileModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalSubtext}>Update your username</Text>
            
            <TextInput
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              placeholder="Enter username"
              style={styles.input}
              autoCapitalize="words"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setEditProfileModal(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateProfile} style={styles.modalSubmitBtn}>
                <Text style={styles.modalBtnTextPrimary}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        transparent
        visible={changePasswordModal}
        animationType="fade"
        onRequestClose={() => setChangePasswordModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalSubtext}>Enter your current and new password</Text>
            
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              secureTextEntry
              style={styles.input}
            />
            
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              secureTextEntry
              style={styles.input}
            />
            
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              secureTextEntry
              style={styles.input}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setChangePasswordModal(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChangePassword} style={styles.modalSubmitBtn}>
                <Text style={styles.modalBtnTextPrimary}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f5f7fa" 
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#0066ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#999",
    fontWeight: "500",
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#999",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: "#fff",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f0f7ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dangerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ff3b30",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    width: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  modalSubtext: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1a1a1a",
    fontWeight: "500",
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#f5f7fa",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e8ecf1",
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: "#0066ff",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#666",
  },
  modalBtnTextPrimary: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});
