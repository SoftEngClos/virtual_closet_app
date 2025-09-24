// app/(tabs)/_layout.tsx
import React from "react";
import { View, Pressable } from "react-native";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: { height: 64, position: "absolute" },
        }}
      >
        <Tabs.Screen
          name="closet"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shirt-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="outfits"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="albums-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
        {/* Keep the route, hide it from the tab bar */}
        <Tabs.Screen name="plus" options={{ href: null }} />
      </Tabs>

      {/* Floating center “+” */}
      <Pressable
        onPress={() => router.push("/(tabs)/plus")}
        style={{
          position: "absolute",
          alignSelf: "center",
          bottom: 20,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: "#111",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 6,
        }}
      >
        <Ionicons name="add" size={36} color="white" />
      </Pressable>
    </View>
  );
}
