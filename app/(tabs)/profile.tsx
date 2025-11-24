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
import { useCurrentLocation } from "src/services/useCurrentLocation.ts";
import { useSimpleTheme } from "src/hooks/useSimpleTheme";
import {
  requestNotificationPermissions,
  checkNotificationPermissions,
  cancelAllNotifications,
  scheduleDailyOutfitReminder,
  checkWeatherChangesForScheduledOutfits,
} from "src/services/weatherNotifications";

export default function ProfileScreen() {
  const router = useRouter();
  const auth = getAuth();
  const user = auth.currentUser;
  const { closet } = useCloset();
  const { coords } = useCurrentLocation();
  const { isDark, colors, toggleTheme } = useSimpleTheme();

  // Settings states
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Modal states
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Get face image from closet
  const faceImage = closet["Face"]?.[0]?.uri;

  // Check notification permission on mount
  useEffect(() => {
    (async () => {
      const status = await checkNotificationPermissions();
      setNotificationsEnabled(status === 'granted');
    })();
  }, []);

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      const status = await requestNotificationPermissions();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        await scheduleDailyOutfitReminder(8, 0);
        Alert.alert(
          'Notifications Enabled! 🔔',
          'You will receive:\n• Daily outfit reminders at 8 AM\n• Weather alerts for scheduled outfits\n• Updates when weather changes significantly'
        );
        if (coords && user) {
          await checkWeatherChangesForScheduledOutfits(user.uid, coords);
        }
      } else {
        setNotificationsEnabled(false);
        Alert.alert(
          'Permission Denied',
          'Please enable notifications in your device settings to receive weather alerts and outfit reminders.'
        );
      }
    } else {
      await cancelAllNotifications();
      setNotificationsEnabled(false);
      Alert.alert(
        'Notifications Disabled',
        'You will no longer receive weather alerts or daily outfit reminders.'
      );
    }
  };

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
      const credential = EmailAuthProvider.credential(
        user!.email!,
        currentPassword
      );
      await reauthenticateWithCredential(user!, credential);
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
      style={[styles.settingItem, { borderBottomColor: colors.borderLight }]}
      onPress={onPress}
      disabled={!onPress && !rightComponent}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.iconBackground }]}>
          <Ionicons name={icon} size={22} color={colors.icon} />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent ? rightComponent : showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
          <View style={styles.avatarContainer}>
            {faceImage ? (
              <Image source={{ uri: faceImage }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={40} color="#fff" />
            )}
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>
            {user?.displayName || "Set Username"}
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
        </View>

        {/* Account Settings */}
        <SectionHeader title="ACCOUNT" />
        <View style={[styles.section, { backgroundColor: colors.card }]}>
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
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SettingItem
            icon="notifications-outline"
            title="Weather Notifications"
            subtitle="Get alerts for weather changes & outfit reminders"
            showArrow={false}
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingItem
            icon="moon-outline"
            title="Dark Mode"
            subtitle={isDark ? "Dark theme enabled" : "Switch to dark theme"}
            showArrow={false}
            rightComponent={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        {/* Closet Settings */}
        <SectionHeader title="CLOSET" />
        <View style={[styles.section, { backgroundColor: colors.card }]}>
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
        <View style={[styles.section, { backgroundColor: colors.card }]}>
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
            onPress={() => Alert.alert("About", "Virtual Closet App v1.0.0\n\nYour AI-powered digital wardrobe assistant with weather-based outfit recommendations.")}
          />
          <SettingItem
            icon="document-text-outline"
            title="Terms & Privacy"
            subtitle="Read our policies"
            onPress={() => Alert.alert("Coming Soon", "Terms & Privacy coming soon!")}
          />
        </View>

        {/* Sign Out and Delete Account */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={[styles.dangerButton, { borderBottomColor: colors.borderLight }]} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={[styles.dangerText, { color: colors.error }]}>Sign Out</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.dangerButton, { borderBottomColor: colors.borderLight }]} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
            <Text style={[styles.dangerText, { color: colors.error }]}>Delete Account</Text>
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
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>Update your username</Text>
            
            <TextInput
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              placeholder="Enter username"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { 
                borderColor: colors.border, 
                color: colors.text,
                backgroundColor: isDark ? colors.surface : colors.card
              }]}
              autoCapitalize="words"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => setEditProfileModal(false)}
                style={[styles.modalCancelBtn, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border
                }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpdateProfile} style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}>
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
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
            <Text style={[styles.modalSubtext, { color: colors.textSecondary }]}>Enter your current and new password</Text>
            
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={[styles.input, { 
                borderColor: colors.border, 
                color: colors.text,
                backgroundColor: isDark ? colors.surface : colors.card
              }]}
            />
            
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={[styles.input, { 
                borderColor: colors.border, 
                color: colors.text,
                backgroundColor: isDark ? colors.surface : colors.card
              }]}
            />
            
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={[styles.input, { 
                borderColor: colors.border, 
                color: colors.text,
                backgroundColor: isDark ? colors.surface : colors.card
              }]}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setChangePasswordModal(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
                style={[styles.modalCancelBtn, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border
                }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleChangePassword} style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}>
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
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 30,
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
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: "500",
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
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
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
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
    marginBottom: 4,
  },
  modalSubtext: {
    fontSize: 14,
    marginBottom: 20,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
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
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalBtnTextPrimary: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});
