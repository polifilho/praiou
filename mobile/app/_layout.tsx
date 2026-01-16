import { Drawer } from "expo-router/drawer";
import {
  DrawerContentScrollView,
  DrawerItemList,
} from "@react-navigation/drawer";
import { Alert, Pressable, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { router } from "expo-router";

function CustomDrawerContent(props: any) {
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 80 }}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* Botão fixo no rodapé */}
      <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb" }}>
        <Pressable
          onPress={() =>
            Alert.alert("Sair", "Deseja sair da sua conta?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Sair", style: "destructive", onPress: handleLogout },
            ])
          }
          style={{
            backgroundColor: "#fb923c", // orange-400
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            Sair
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: "#fb923c" }, // orange-400
        headerTintColor: "#fff",
      }}
      initialRouteName="index"
    >
      {/* Itens do menu */}
      <Drawer.Screen name="index" options={{ title: "Início" }} />
      <Drawer.Screen name="reservas" options={{ title: "Reservas" }} />
      <Drawer.Screen name="perfil" options={{ title: "Perfil" }} />

      {/* Rotas internas escondidas */}
      <Drawer.Screen
        name="(flow)"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="login"
        options={{ drawerItemStyle: { display: "none" } }}
      />
    </Drawer>
  );
}
