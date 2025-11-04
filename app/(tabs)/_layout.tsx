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
          name="calendar/index"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar-outline" size={size} color={color} />
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

        {/* Hidden plus tab */}
        <Tabs.Screen
          name="plus"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {/* Floating + button */}
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
          elevation: 6,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        }}
      >
        <Ionicons name="add" size={36} color="white" />
      </Pressable>
    </View>
  );
}
