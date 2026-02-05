import {
  View,
  Text,
  TextInput,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image
} from "react-native";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function friendlyAuthError(message: string) {
    const m = message.toLowerCase();

    if (m.includes("email not confirmed") || m.includes("not confirmed")) {
      return "Seu email ainda não foi confirmado. Verifique sua caixa de entrada (e spam) e confirme para conseguir entrar.";
    }

    if (m.includes("invalid login credentials")) {
      return "Email ou senha incorretos.";
    }

    return message;
  }

  async function login() {
    if (!email.trim() || !password) {
      Alert.alert("Erro", "Informe email e senha.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    // ✅ primeiro trata erro do login
    if (error) {
      setLoading(false);
      Alert.alert("Erro", friendlyAuthError(error.message));
      return;
    }

    // ✅ agora sim pega user da sessão
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData.user;

    if (userErr || !user) {
      setLoading(false);
      Alert.alert("Erro", "Não foi possível validar o usuário.");
      return;
    }

    // valida role no profile (customer-only)
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
      Alert.alert("Acesso negado", "Este aplicativo é exclusivo para clientes.");
      router.replace("/login");
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
        contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require("../assets/images/logo.png")}
          style={{
            width: 200,
            height: 200,
            alignSelf: "center",
            marginBottom: 24,
          }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 24, fontWeight: "900", marginBottom: 16 }}>
          Login
        </Text>

        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>Email</Text>
            <TextInput
              placeholder="seuemail@exemplo.com"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "white",
                color: "#111827",
              }}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>Senha</Text>
            <TextInput
              placeholder="sua senha"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "white",
                color: "#111827",
              }}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Pressable
            onPress={login}
            disabled={loading}
            style={{
              backgroundColor: "#fb923c",
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              marginTop: 6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "900" }}>
              {loading ? "Entrando..." : "Entrar"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.push("/signup")} style={{ marginTop: 10 }}>
            <Text style={{ textAlign: "center", color: "#fb923c", fontWeight: "900" }}>
              Criar conta
            </Text>
          </Pressable>

          {/* opcional (futuro) */}
          {/* <Text style={{ textAlign: "center", color: "#9ca3af", marginTop: 6, fontSize: 12 }}>
            Esqueceu a senha? Vamos adicionar essa opção em seguida.
          </Text> */}
          <Pressable onPress={() => router.push("/forgot-password")} style={{ marginTop: 12 }}>
            <Text style={{ color: "#fb923c", textAlign: "center", fontWeight: "800" }}>
              Esqueci minha senha
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
