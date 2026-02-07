import { Stack, router } from "expo-router";
import { Pressable, Text } from "react-native";

export default function FlowLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#fb923c" }, // orange-400
        headerTintColor: "#fff",
      }}
    >
      <Stack.Screen
        name="praias"
        options={{
          title: "Praias",
          // força um "back" para o início (regiões)
          headerLeft: () => (
            <Pressable
              onPress={() => router.push("/")}
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
            >
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>
                ‹
              </Text>
            </Pressable>
          ),
        }}
      />

      <Stack.Screen name="barracas" options={{ title: "Barracas" }} />
      <Stack.Screen name="vendor" options={{ title: "Reserva" }} />
      <Stack.Screen name="itens" options={{ title: "Itens" }} />
    </Stack>
  );
}
