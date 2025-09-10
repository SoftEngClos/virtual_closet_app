import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: "center" }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="items" options={{ title: "Items" }} />
      <Tabs.Screen name="outfits" options={{ title: "Outfits" }} />
    </Tabs>
  );
}