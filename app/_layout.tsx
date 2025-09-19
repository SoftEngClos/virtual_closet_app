// app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            {/* Default screen is index (login/signup) */}
            <Stack.Screen name="index" />
            {/* Tabs group */}
            <Stack.Screen name="(tabs)" />
        </Stack>
    );
}
