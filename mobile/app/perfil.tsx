import { View, Text, Pressable, Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";

export default function Perfil() {
  async function logout() {
    await supabase.auth.signOut();
    Alert.alert("Saiu", "Você saiu da sua conta.");
    router.replace("/login");
  }

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: 16 }}>
        Perfil
      </Text>
    </View>
  );
}
