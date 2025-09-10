import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Welcome to Virtual Closet 👗</Text>
      <Text>Start by adding items and tags.</Text>
    </View>
  );
}
