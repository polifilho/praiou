import { Drawer } from "expo-router/drawer";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";
import type { DrawerNavigationOptions } from "@react-navigation/drawer";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";

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
  const navigation = props.useNavigation;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function closeDrawer() {
    navigation?.closeDrawer?.();
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: 20 }}>
        {/* Topo do menu */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ marginLeft: 10, fontSize: 18, fontWeight: "800" }}>
            Bem-vindo(a) ao Orla+
          </Text>
          <Text style={{ marginLeft: 10, color: "#6b7280", marginTop: 2 }}>
            A praia do seu jeito!
          </Text>
        </View>

        {/* Somente os itens que você quer */}
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
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      // sem sessão -> login
      if (!data.session) {
        router.replace("/login");
      }

      setBooting(false);
    }

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // sempre que perder sessão -> login
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
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

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route }): DrawerNavigationOptions => ({
        headerStyle: { backgroundColor: "#fb923c" },
        headerTintColor: "#fff",
        // Drawer header não deve aparecer no flow (Stack vai cuidar)
        headerShown: !route.name.startsWith("(flow)/"),

        // ✅ ALTERAÇÃO: bloqueia swipe do drawer em login/signup
        swipeEnabled: !(route.name === "login" || route.name === "signup"),
      })}
      initialRouteName="index"
    >
      {/* Menu */}
      <Drawer.Screen name="index" options={{ title: "Início" }} />
      <Drawer.Screen name="reservas" options={{ title: "Reservas" }} />
      <Drawer.Screen name="perfil" options={{ title: "Perfil" }} />

      {/* Escondidos */}
      <Drawer.Screen
        name="login"
        options={{
          drawerItemStyle: { display: "none" },
          // ✅ ALTERAÇÃO: sem header (remove hamburger)
          headerShown: false,
          // ✅ ALTERAÇÃO: garante sem swipe nesta tela
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

      {/* Flow escondido + sem header do Drawer */}
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
