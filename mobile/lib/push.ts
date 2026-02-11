// lib/push.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// ✅ handler atualizado (nova API pede banner/list no iOS)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log("Push: precisa ser device físico.");
    return null;
  }

  // 1) permissão
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push: permissão negada.");
    return null;
  }

  // 2) token expo
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;

  if (!projectId) {
    console.log("Push: projectId ausente. Verifique app.json extra.eas.projectId.");
  }

  const tokenRes = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  const token = tokenRes.data;

  // 3) android channel (ok deixar)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  // 4) salva no supabase
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user) {
    console.log("Push: sem user logado.");
    return token;
  }

  // ✅ upsert evita duplicar
  const { error } = await supabase
    .from("user_push_tokens")
    .upsert(
      {
        user_id: user.id,
        token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    );

  if (error) {
    console.log("Push: erro ao salvar token:", error.message);
  } else {
    console.log("Push: token salvo:", token);
  }

  return token;
}
