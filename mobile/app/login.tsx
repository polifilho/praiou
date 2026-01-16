import { View, Text, TextInput, Button, Alert } from "react-native";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      Alert.alert("Erro", "Não foi possível validar o usuário.");
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .limit(1);

    if (profErr) {
      await supabase.auth.signOut();
      Alert.alert("Erro", profErr.message);
      return;
    }

    const role = profile?.[0]?.role ?? "customer";

    if (role !== "customer") {
      await supabase.auth.signOut();
      Alert.alert("Acesso negado", "Este aplicativo é exclusivo para clientes.");
      router.replace("/login");
      return;
    }


    if (error) {
      Alert.alert("Erro", error.message);
      return;
    }

    router.replace("/");
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, marginBottom: 16 }}>Login</Text>

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 12, marginBottom: 12 }}
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Senha"
        secureTextEntry
        style={{ borderWidth: 1, padding: 12, marginBottom: 12 }}
        value={password}
        onChangeText={setPassword}
      />

      <Button title="Entrar" onPress={login} />
    </View>
  );
}
