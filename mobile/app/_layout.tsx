import { Drawer } from "expo-router/drawer";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";
import type { DrawerNavigationOptions } from "@react-navigation/drawer";

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

function CustomDrawerContent() {
  const navigation = useNavigation();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function closeDrawer() {
    navigation.dispatch(DrawerActions.closeDrawer());
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: 20 }}>
        {/* Topo do menu */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ marginLeft: 10, fontSize: 18, fontWeight: "800" }}>Bem-vindo(a) ao Orla+</Text>
          <Text style={{ marginLeft: 10, color: "#6b7280", marginTop: 2 }}>A praia do seu jeito!</Text>
        </View>

        {/* Somente os itens que você quer */}
        <View style={{ paddingHorizontal: 10,  marginTop: 10,  }}>
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
  return (
    <Drawer
      drawerContent={() => <CustomDrawerContent />}
      screenOptions={({ route }): DrawerNavigationOptions => ({
        headerStyle: { backgroundColor: "#fb923c" },
        headerTintColor: "#fff",
        // Drawer header não deve aparecer no flow (Stack vai cuidar)
        headerShown: !route.name.startsWith("(flow)/"),
      })}
      initialRouteName="index"
    >
      {/* Menu */}
      <Drawer.Screen name="index" options={{ title: "Início" }} />
      <Drawer.Screen name="reservas" options={{ title: "Reservas" }} />
      <Drawer.Screen name="perfil" options={{ title: "Perfil" }} />

      {/* Escondidos */}
      <Drawer.Screen name="login" options={{ drawerItemStyle: { display: "none" } }} />
      <Drawer.Screen name="signup" options={{ drawerItemStyle: { display: "none" } }} />

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
