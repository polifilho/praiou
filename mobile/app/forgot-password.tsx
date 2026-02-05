import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";
import * as Linking from "expo-linking";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const e = email.trim().toLowerCase();
    if (!e) {
      Alert.alert("Atenção", "Digite seu email.");
      return;
    }

    setSending(true);

    const redirectTo = Linking.createURL("reset-password");

    const { error } = await supabase.auth.resetPasswordForEmail(e, {
        redirectTo,
    });

    setSending(false);

    if (error) {
      Alert.alert("Erro", error.message);
      return;
    }

    Alert.alert(
      "Email enviado",
      "Se esse email estiver cadastrado, você receberá um link para redefinir sua senha.",
      [{ text: "OK", onPress: () => router.replace("/login") }]
    );

    setEmail("");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "900", marginBottom: 10 }}>
          Esqueci minha senha
        </Text>
        <Text style={{ color: "#6b7280", marginBottom: 18 }}>
          Digite seu email e enviaremos um link para redefinir sua senha.
        </Text>

        <Text style={{ fontWeight: "800", marginBottom: 6 }}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="seuemail@exemplo.com"
          placeholderTextColor="#9ca3af"
          style={{
            borderWidth: 1,
            borderColor: "#e5e7eb",
            borderRadius: 12,
            padding: 12,
            backgroundColor: "white",
            color: "#111827",
            marginBottom: 14,
          }}
        />

        <Pressable
          onPress={send}
          disabled={sending}
          style={{
            backgroundColor: "#fb923c",
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
            opacity: sending ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "900" }}>
            {sending ? "Enviando..." : "Enviar link"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={{ textAlign: "center", color: "#fb923c", fontWeight: "900" }}>
            Voltar
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
