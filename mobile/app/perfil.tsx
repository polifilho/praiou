import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  Pressable,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../lib/supabase";

type UserProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
};

export default function Perfil() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);

  // ✅ troca de senha
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // campos editáveis
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const initials = useMemo(() => {
    const name = (profile?.full_name || fullName || "").trim();
    if (!name) return "U";
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "U";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
    return (first + last).toUpperCase();
  }, [profile?.full_name, fullName]);

  const safe = (v?: string | null) => (v && v.trim() ? v : "--");

  async function load() {
    setLoading(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setLoading(false);
      Alert.alert("Erro", userErr.message);
      return;
    }

    const user = userRes.user;
    if (!user) {
      setLoading(false);
      Alert.alert("Erro", "Usuário não encontrado. Faça login novamente.");
      return;
    }

    setEmail(user.email ?? null);

    const { data: prof, error: profErr } = await supabase
      .from("user_profiles")
      .select("id, full_name, phone, avatar_url, role")
      .eq("id", user.id)
      .limit(1);

    if (profErr) {
      setLoading(false);
      Alert.alert("Erro", profErr.message);
      return;
    }

    const p = (prof?.[0] as UserProfile) ?? null;
    setProfile(p);

    setFullName(p?.full_name ?? "");
    setPhone(p?.phone ?? "");

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveProfile() {
    if (!profile?.id) return;

    setSaving(true);

    const { error } = await supabase
      .from("user_profiles")
      .update({
        full_name: fullName.trim() ? fullName.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      Alert.alert("Erro", error.message);
      return;
    }

    Alert.alert("Sucesso", "Perfil atualizado.");
    await load();
  }

  // ✅ troca de senha (usuário logado)
  async function changePassword() {
    if (newPassword.length < 6) {
      Alert.alert("Erro", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Erro", "As senhas não coincidem.");
      return;
    }

    setChangingPass(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setChangingPass(false);

    if (error) {
      Alert.alert("Erro", error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    Alert.alert("Sucesso", "Senha atualizada.");
  }

  async function pickAndUploadAvatar() {
    if (!profile?.id) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Permissão", "Precisamos de acesso à sua galeria para enviar a foto.");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (res.canceled) return;

    const asset = res.assets?.[0];
    if (!asset?.uri) return;

    setUploading(true);

    try {
      const filePath = `${profile.id}/avatar.jpg`;

      const fileResp = await fetch(asset.uri);
      const arrayBuffer = await fileResp.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      const { error: upErr } = await supabase.storage.from("avatars").upload(filePath, fileData, {
        contentType: "image/jpeg",
        upsert: true,
      });

      if (upErr) {
        setUploading(false);
        Alert.alert("Erro", upErr.message);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { error: saveErr } = await supabase
        .from("user_profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);

      setUploading(false);

      if (saveErr) {
        Alert.alert("Erro", saveErr.message);
        return;
      }

      Alert.alert("Sucesso", "Foto atualizada.");
      await load();
    } catch (e: any) {
      setUploading(false);
      Alert.alert("Erro", e?.message ?? "Falha ao enviar foto.");
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 16 }}>Perfil</Text>

        {/* Avatar */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 }}>
          {profile?.avatar_url ? (
            <Image
              source={{ uri: `${profile.avatar_url}?t=${Date.now()}` }}
              style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#f3f4f6" }}
            />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#fde68a",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#92400e" }}>{initials}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800" }}>
              {safe(profile?.full_name) === "--" ? "Seu nome" : safe(profile?.full_name)}
            </Text>
            <Text style={{ color: "#6b7280", marginTop: 2 }}>{email ?? "--"}</Text>

            <Pressable onPress={pickAndUploadAvatar} style={{ marginTop: 8 }}>
              <Text style={{ color: "#fb923c", fontWeight: "800" }}>
                {uploading ? "Enviando..." : "Trocar foto"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Form Perfil */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: "#e5e7eb",
            gap: 12,
          }}
        >
          <View>
            <Text style={{ fontWeight: "700", marginBottom: 6 }}>Nome completo</Text>
            <TextInput
              placeholder="Ex: João Silva"
              value={fullName}
              onChangeText={setFullName}
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
            <Text style={{ fontWeight: "700", marginBottom: 6 }}>Telefone</Text>
            <TextInput
              placeholder="Ex: (21) 99999-9999"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
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
            <Text style={{ fontWeight: "700", marginBottom: 6 }}>Email</Text>
            <Text style={{ fontSize: 16, fontWeight: "700" }}>{email ?? "--"}</Text>
          </View>
        </View>

        <Pressable
          onPress={saveProfile}
          disabled={saving}
          style={{
            backgroundColor: "#fb923c",
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
            marginTop: 16,
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
            {saving ? "Salvando..." : "Atualizar"}
          </Text>
        </Pressable>

        {/* ✅ Segurança (dropdown) */}
        <View
          style={{
            marginTop: 18,
            backgroundColor: "white",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: "#e5e7eb",
          }}
        >
          <Pressable
            onPress={() => setShowSecurity((v) => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "900" }}>Trocar Senha</Text>
            <Text style={{ color: "#fb923c", fontWeight: "900" }}>
              {showSecurity ? "Ocultar" : "Mostrar"}
            </Text>
          </Pressable>

          {showSecurity ? (
            <View style={{ marginTop: 12, gap: 12 }}>
              <View>
                <Text style={{ fontWeight: "700", marginBottom: 6 }}>Nova senha</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
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

              <View>
                <Text style={{ fontWeight: "700", marginBottom: 6 }}>Confirmar nova senha</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="repita a senha"
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
                onPress={changePassword}
                disabled={changingPass}
                style={{
                  backgroundColor: "#fb923c",
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  opacity: changingPass ? 0.7 : 1,
                }}
              >
                <Text style={{ color: "white", fontSize: 16, fontWeight: "900" }}>
                  {changingPass ? "Alterando..." : "Alterar senha"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// import { useEffect, useMemo, useState } from "react";
// import {
//   View,
//   Text,
//   Image,
//   ActivityIndicator,
//   Pressable,
//   Alert,
//   TextInput,
//   KeyboardAvoidingView,
//   Platform,
//   ScrollView,
// } from "react-native";
// import * as ImagePicker from "expo-image-picker";
// import { supabase } from "../lib/supabase";

// type UserProfile = {
//   id: string;
//   full_name: string | null;
//   phone: string | null;
//   avatar_url: string | null;
//   role: string | null;
// };

// export default function Perfil() {
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [uploading, setUploading] = useState(false);

//   const [email, setEmail] = useState<string | null>(null);
//   const [profile, setProfile] = useState<UserProfile | null>(null);

//   // campos editáveis
//   const [fullName, setFullName] = useState("");
//   const [phone, setPhone] = useState("");

//   const initials = useMemo(() => {
//     const name = (profile?.full_name || fullName || "").trim();
//     if (!name) return "U";
//     const parts = name.split(/\s+/).filter(Boolean);
//     const first = parts[0]?.[0] ?? "U";
//     const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
//     return (first + last).toUpperCase();
//   }, [profile?.full_name, fullName]);

//   const safe = (v?: string | null) => (v && v.trim() ? v : "--");

//   async function load() {
//     setLoading(true);

//     const { data: userRes, error: userErr } = await supabase.auth.getUser();
//     if (userErr) {
//       setLoading(false);
//       Alert.alert("Erro", userErr.message);
//       return;
//     }

//     const user = userRes.user;
//     if (!user) {
//       setLoading(false);
//       Alert.alert("Erro", "Usuário não encontrado. Faça login novamente.");
//       return;
//     }

//     setEmail(user.email ?? null);

//     const { data: prof, error: profErr } = await supabase
//       .from("user_profiles")
//       .select("id, full_name, phone, avatar_url, role")
//       .eq("id", user.id)
//       .limit(1);

//     if (profErr) {
//       setLoading(false);
//       Alert.alert("Erro", profErr.message);
//       return;
//     }

//     const p = (prof?.[0] as UserProfile) ?? null;
//     setProfile(p);

//     setFullName(p?.full_name ?? "");
//     setPhone(p?.phone ?? "");

//     setLoading(false);
//   }

//   useEffect(() => {
//     load();
//   }, []);

//   async function saveProfile() {
//     if (!profile?.id) return;

//     setSaving(true);

//     const { error } = await supabase
//       .from("user_profiles")
//       .update({
//         full_name: fullName.trim() ? fullName.trim() : null,
//         phone: phone.trim() ? phone.trim() : null,
//       })
//       .eq("id", profile.id);

//     setSaving(false);

//     if (error) {
//       Alert.alert("Erro", error.message);
//       return;
//     }

//     Alert.alert("Sucesso", "Perfil atualizado.");
//     await load();
//   }

//   async function pickAndUploadAvatar() {
//   if (!profile?.id) return;

//   const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
//   if (perm.status !== "granted") {
//     Alert.alert("Permissão", "Precisamos de acesso à sua galeria para enviar a foto.");
//     return;
//   }

//   const res = await ImagePicker.launchImageLibraryAsync({
//     mediaTypes: ImagePicker.MediaTypeOptions.Images,
//     allowsEditing: true,
//     aspect: [1, 1],
//     quality: 0.9,
//   });

//   if (res.canceled) return;

//   const asset = res.assets?.[0];
//   if (!asset?.uri) return;

//   setUploading(true);

//   try {
//     const filePath = `${profile.id}/avatar.jpg`;

//     // ✅ pegar bytes via arrayBuffer (evita 0 bytes no iOS)
//     const fileResp = await fetch(asset.uri);
//     const arrayBuffer = await fileResp.arrayBuffer();
//     const fileData = new Uint8Array(arrayBuffer);

//     const { error: upErr } = await supabase.storage
//       .from("avatars")
//       .upload(filePath, fileData, {
//         contentType: "image/jpeg",
//         upsert: true,
//       });

//     if (upErr) {
//       setUploading(false);
//       Alert.alert("Erro", upErr.message);
//       return;
//     }

//     const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
//     const publicUrl = data.publicUrl;

//     const { error: saveErr } = await supabase
//       .from("user_profiles")
//       .update({ avatar_url: publicUrl })
//       .eq("id", profile.id);

//     setUploading(false);

//     if (saveErr) {
//       Alert.alert("Erro", saveErr.message);
//       return;
//     }

//     Alert.alert("Sucesso", "Foto atualizada.");
//     await load();
//   } catch (e: any) {
//     setUploading(false);
//     Alert.alert("Erro", e?.message ?? "Falha ao enviar foto.");
//   }
// }

//   if (loading) {
//     return (
//       <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
//         <ActivityIndicator />
//       </View>
//     );
//   }

//   return (
//     <KeyboardAvoidingView
//       style={{ flex: 1 }}
//       behavior={Platform.OS === "ios" ? "padding" : "height"}
//     >
//       <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
//         <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 16 }}>
//           Perfil
//         </Text>

//         {/* Avatar */}
//         <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 }}>
//           {profile?.avatar_url ? (
//             <Image
//               source={{ uri: `${profile.avatar_url}?t=${Date.now()}` }}
//               style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#f3f4f6" }}
//             />
//           ) : (
//             <View
//               style={{
//                 width: 72,
//                 height: 72,
//                 borderRadius: 36,
//                 backgroundColor: "#fde68a",
//                 alignItems: "center",
//                 justifyContent: "center",
//               }}
//             >
//               <Text style={{ fontSize: 22, fontWeight: "900", color: "#92400e" }}>
//                 {initials}
//               </Text>
//             </View>
//           )}

//           <View style={{ flex: 1 }}>
//             <Text style={{ fontSize: 18, fontWeight: "800" }}>
//               {safe(profile?.full_name) === "--" ? "Seu nome" : safe(profile?.full_name)}
//             </Text>
//             <Text style={{ color: "#6b7280", marginTop: 2 }}>
//               {email ?? "--"}
//             </Text>

//             <Pressable onPress={pickAndUploadAvatar} style={{ marginTop: 8 }}>
//               <Text style={{ color: "#fb923c", fontWeight: "800" }}>
//                 {uploading ? "Enviando..." : "Trocar foto"}
//               </Text>
//             </Pressable>
//           </View>
//         </View>

//         {/* Form */}
//         <View
//           style={{
//             backgroundColor: "white",
//             borderRadius: 16,
//             padding: 14,
//             borderWidth: 1,
//             borderColor: "#e5e7eb",
//             gap: 12,
//           }}
//         >
//           <View>
//             <Text style={{ fontWeight: "700", marginBottom: 6 }}>Nome completo</Text>
//             <TextInput
//               placeholder="Ex: João Silva"
//               value={fullName}
//               onChangeText={setFullName}
//               style={{
//                 borderWidth: 1,
//                 borderColor: "#e5e7eb",
//                 borderRadius: 12,
//                 padding: 12,
//               }}
//             />
//           </View>

//           <View>
//             <Text style={{ fontWeight: "700", marginBottom: 6 }}>Telefone</Text>
//             <TextInput
//               placeholder="Ex: (21) 99999-9999"
//               value={phone}
//               onChangeText={setPhone}
//               keyboardType="phone-pad"
//               style={{
//                 borderWidth: 1,
//                 borderColor: "#e5e7eb",
//                 borderRadius: 12,
//                 padding: 12,
//               }}
//             />
//           </View>

//           <View>
//             <Text style={{ fontWeight: "700", marginBottom: 6 }}>Email</Text>
//             <Text style={{ fontSize: 16, fontWeight: "700" }}>{email ?? "--"}</Text>
//           </View>
//         </View>

//         <Pressable
//           onPress={saveProfile}
//           disabled={saving}
//           style={{
//             backgroundColor: "#fb923c",
//             paddingVertical: 14,
//             borderRadius: 12,
//             alignItems: "center",
//             marginTop: 16,
//             opacity: saving ? 0.7 : 1,
//           }}
//         >
//           <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
//             {saving ? "Salvando..." : "Atualizar"}
//           </Text>
//         </Pressable>
//       </ScrollView>
//     </KeyboardAvoidingView>
//   );
// }
