import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useAppModal } from "../components/AppModal";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const modal = useAppModal();

  const [loading, setLoading] = useState(false);

  async function signUp() {
    if (!fullName.trim()) {
      modal.info("Error", "Informe seu nome completo.", "Ok");
      return;
    }
    if (!email.trim()) {
      modal.info("Error no email", "Informe seu email.", "Ok");
      return;
    }
    if (password.length < 6) {
      modal.info("Error na senha", "A senha deve ter pelo menos 6 caracteres.", "Ok");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: "customer",
        },
      },
    });

    setLoading(false);

    if (error) {
      modal.info("Error", error.message, "Ok");
      return;
    }

    // ✅ limpa campos
    setFullName("");
    setEmail("");
    setPassword("");

    // ✅ feedback de confirmação de email
    modal.confirm({
      title: "Conta criada!",
      message: "Enviamos um email de confirmação. Confirme sua conta para conseguir entrar.",
      confirmText: "Ok",
      variant: "#fb923c",
      onConfirm: () => router.replace("/login"),
    })
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
        <View style={{ width: 200, height: 200, alignSelf: "center", marginBottom: 24 }}>
          <Image
            source={require("../assets/images/logo.png")}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </View>
        <Text style={{ fontSize: 24, fontWeight: "900", marginBottom: 16 }}>
          Criar conta
        </Text>

        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>Nome completo</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Ex: João Silva"
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "white",
                color: "#111827",
              }}
            />
          </View>

          <View>
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
              }}
            />
          </View>

          <View>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>Senha</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="mín. 6 caracteres"
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                padding: 12,
                backgroundColor: "white",
                color: "#111827",
              }}
            />
          </View>

          <Pressable
            onPress={signUp}
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
              {loading ? "Criando..." : "Criar conta"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.replace("/login")} style={{ marginTop: 10 }}>
            <Text style={{ textAlign: "center", color: "#fb923c", fontWeight: "900" }}>
              Já tenho conta
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
