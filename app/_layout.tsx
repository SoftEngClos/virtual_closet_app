
// app/_layout.tsx
import { Stack } from "expo-router";
import React from "react";
import { ClosetProvider } from "./ClosetProvider"; 

export default function RootLayout() {
  return (
    <ClosetProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Default screen is index (login/signup) */}
        <Stack.Screen name="index" />

        {/* Tabs group */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Register the Add Item screen at /add-item */}
        <Stack.Screen
          name="add-item"
          options={{ headerShown: true, title: "Add Item" }}
        />
      </Stack>
    </ClosetProvider>
  );
}
