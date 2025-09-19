// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
    return (
        <Tabs screenOptions={{ headerShown: false }}>
            <Tabs.Screen
                name="closet"
                options={{
                    title: "Closet",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="shirt-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="outfits"
                options={{
                    title: "Outfits",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="color-palette-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}
