import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSignup() {
    if (!email || !password) {
      Alert.alert("Atenção", "Preencha email e senha.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      Alert.alert("Erro", error.message);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      await supabase.from("user_profiles").upsert({
        id: userId,
        full_name: fullName || null,
        role: "customer",
      });
    }

    Alert.alert("Conta criada", "Agora você já pode entrar com seu email e senha.");
    router.replace("/login");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 20 }}>
          Criar conta
        </Text>

        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Nome</Text>
        <TextInput
          placeholder="Seu nome"
          value={fullName}
          onChangeText={setFullName}
          style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12 }}
        />

        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Email</Text>
        <TextInput
          placeholder="email@exemplo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12 }}
        />

        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Senha</Text>
        <TextInput
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, marginBottom: 16 }}
        />

        <Pressable
          onPress={onSignup}
          style={{ backgroundColor: "#fb923c", padding: 16, borderRadius: 12, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
            Criar conta
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/login")} style={{ marginTop: 16 }}>
          <Text style={{ color: "#fb923c", textAlign: "center", fontWeight: "700" }}>
            Já tenho conta
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
