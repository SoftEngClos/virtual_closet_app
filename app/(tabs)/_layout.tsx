import { Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerTitleAlign: "center" }}>
      <Tabs.Screen name="index" 
      options={{ 
        title: "Home", tabBarIcon:({color,size}) =>(
        <Ionicons name = "home" size={size} color={color} />
            ), 
          }} 
        />


      <Tabs.Screen name="items" 
      options={{ 
        title: "Closet", 
        tabBarIcon: ({ color, size }) => (
        <MaterialCommunityIcons name = "hanger" size = {size} color={color} />
              ),
            }}
          />


      <Tabs.Screen name="outfits" 
      options={{ 
        title: "Outfits",
        tabBarIcon: ({color, size}) => (
          <Ionicons name = "shirt-outline" size={size} color={color} />
              ),
            }} 
         />

         
    </Tabs>
  );
}