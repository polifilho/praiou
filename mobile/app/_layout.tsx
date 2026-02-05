import { Drawer } from "expo-router/drawer";
import {
  Alert,
  Pressable,
  Text,
  View,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { Redirect, usePathname, router } from "expo-router";
import type { DrawerNavigationOptions } from "@react-navigation/drawer";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

function DrawerMenuItem({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function CustomDrawerContent(props: any) {
  async function handleLogout() {
    props.navigation?.closeDrawer?.();
    await supabase.auth.signOut(); // guard vai mandar pro login
  }

  function closeDrawer() {
    props.navigation?.closeDrawer?.();
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: 20 }}>
        {/* Topo do menu */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 5,
          }}
        >
          <Image
            source={require("../assets/images/logo.png")}
            style={{
              width: 36,
              height: 36,
              marginRight: 10,
              marginLeft: 10,
            }}
            resizeMode="contain"
          />

          <View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
              Bem-vindo(a) ao Orla+
            </Text>
            <Text style={{ color: "#6b7280", marginTop: 2 }}>
              A praia do seu jeito!
            </Text>
          </View>
        </View>

        {/* Itens do menu */}
        <View style={{ paddingHorizontal: 10, marginTop: 10 }}>
          <DrawerMenuItem
            label="Início"
            onPress={() => {
              router.push("/");
              closeDrawer();
            }}
          />
          <DrawerMenuItem
            label="Reservas"
            onPress={() => {
              router.push("/reservas");
              closeDrawer();
            }}
          />
          <DrawerMenuItem
            label="Perfil"
            onPress={() => {
              router.push("/perfil");
              closeDrawer();
            }}
          />
        </View>

        <View style={{ flex: 1 }} />

        {/* Rodapé com logout */}
        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
          }}
        >
          <Pressable
            onPress={() =>
              Alert.alert("Sair", "Deseja sair da sua conta?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Sair", style: "destructive", onPress: handleLogout },
              ])
            }
            style={{
              backgroundColor: "#fb923c",
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>
              Sair
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const pathname = usePathname();

  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  // ✅ Boot robusto (não trava em loading)
  useEffect(() => {
    let mounted = true;

    // fallback: nunca ficar travado no loading
    const t = setTimeout(() => {
      if (mounted) setBooting(false);
    }, 4000);

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.log("getSession error:", error.message);
          setSession(null);
        } else {
          setSession(data.session ?? null);
        }
      } catch (e: any) {
        console.log("getSession crash:", e?.message ?? e);
        if (mounted) setSession(null);
      } finally {
        if (mounted) setBooting(false);
        clearTimeout(t);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  if (booting) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  // ✅ Rotas liberadas sem sessão (somente auth)
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password";

  if (!session && !isAuthRoute) {
    return <Redirect href="/login" />;
  }

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route }): DrawerNavigationOptions => ({
        headerStyle: { backgroundColor: "#fb923c" },
        headerTintColor: "#fff",
        headerShown: !route.name.startsWith("(flow)/"),
        swipeEnabled: !(
          route.name === "login" ||
          route.name === "signup" ||
          route.name === "forgot-password"
        ),
      })}
      initialRouteName="index"
    >
      {/* Menu */}
      <Drawer.Screen name="index" options={{ title: "Início" }} />
      <Drawer.Screen name="reservas" options={{ title: "Reservas" }} />
      <Drawer.Screen name="perfil" options={{ title: "Perfil" }} />

      {/* Escondidos (auth) */}
      <Drawer.Screen
        name="login"
        options={{
          drawerItemStyle: { display: "none" },
          headerShown: false,
          swipeEnabled: false,
        }}
      />
      <Drawer.Screen
        name="signup"
        options={{
          drawerItemStyle: { display: "none" },
          headerShown: false,
          swipeEnabled: false,
        }}
      />
      <Drawer.Screen
        name="forgot-password"
        options={{
          drawerItemStyle: { display: "none" },
          headerShown: false,
          swipeEnabled: false,
        }}
      />

      {/* Flow escondido */}
      <Drawer.Screen
        name="(flow)"
        options={{
          drawerItemStyle: { display: "none" },
          headerShown: false,
          title: "",
        }}
      />
    </Drawer>
  );
}
