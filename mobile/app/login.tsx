import {
  View,
  Text,
  TextInput,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!email || !password) {
      Alert.alert("Atenção", "Preencha email e senha.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      Alert.alert("Erro", error.message);
      return;
    }

    const user = data.user;
    if (!user) {
      setLoading(false);
      Alert.alert("Erro", "Não foi possível validar o usuário.");
      return;
    }

    const { data: profile, error: profErr } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .limit(1);

    if (profErr) {
      await supabase.auth.signOut();
      setLoading(false);
      Alert.alert("Erro", profErr.message);
      return;
    }

    const role = profile?.[0]?.role ?? "customer";

    if (role !== "customer") {
      await supabase.auth.signOut();
      setLoading(false);
      Alert.alert(
        "Acesso negado",
        "Este aplicativo é exclusivo para clientes."
      );
      return;
    }

    setLoading(false);
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 24 }}>
          Entrar
        </Text>

        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Email</Text>
        <TextInput
          placeholder="email@exemplo.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
          }}
        />

        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Senha</Text>
        <TextInput
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            padding: 12,
            marginBottom: 20,
          }}
        />

        <Pressable
          onPress={login}
          disabled={loading}
          style={{
            backgroundColor: "#fb923c",
            padding: 16,
            borderRadius: 12,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
            {loading ? "Entrando..." : "Entrar"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/signup")}
          style={{ marginTop: 20 }}
        >
          <Text
            style={{
              color: "#fb923c",
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            Criar conta
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
