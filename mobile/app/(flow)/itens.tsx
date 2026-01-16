import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function Itens() {
  const { vendorName } = useLocalSearchParams();

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "600" }}>
        Itens — {String(vendorName ?? "")}
      </Text>
    </View>
  );
}
