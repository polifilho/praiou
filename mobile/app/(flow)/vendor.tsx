import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, ActivityIndicator, Pressable, TextInput, Alert, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";

type Vendor = {
  id: string;
  name: string;
  photo_url: string | null;
  rating_avg: number | null;
  address: string | null;
  reference_point: string | null;
  responsible_name: string | null;
};

type VendorItem = {
  id: string;
  name: string;
  price: number;
  track_stock: boolean;
  stock_available: number | null;
  is_active: boolean;
};

export default function VendorScreen() {
  const { vendorId } = useLocalSearchParams();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [arrival, setArrival] = useState(""); // MVP: texto "13:30"
  const [qty, setQty] = useState<Record<string, number>>({}); // itemId -> qty

  const safe = (v?: string | null) => (v && v.trim() ? v : "--");

  useEffect(() => {
    load();
  }, [vendorId]);

  async function load() {
    setLoading(true);

    const { data: vData, error: vErr } = await supabase
      .from("vendors")
      .select("id,name,photo_url,rating_avg,address,reference_point,responsible_name")
      .eq("id", String(vendorId))
      .limit(1);

    if (vErr) {
      Alert.alert("Erro", vErr.message);
      setLoading(false);
      return;
    }

    const v = (vData?.[0] as Vendor) ?? null;
    setVendor(v);

    const { data: iData, error: iErr } = await supabase
      .from("vendor_items")
      .select("id,name,price,track_stock,stock_available,is_active")
      .eq("vendor_id", String(vendorId))
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (iErr) {
      Alert.alert("Erro", iErr.message);
      setLoading(false);
      return;
    }

    setItems((iData ?? []) as VendorItem[]);
    setLoading(false);
  }

  const total = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = qty[it.id] ?? 0;
      return sum + q * (it.price ?? 0);
    }, 0);
  }, [items, qty]);

  function inc(id: string) {
    setQty((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }

  function dec(id: string) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  }

  async function reservar() {
    // MVP: validações básicas
    const hasAny = Object.values(qty).some((v) => v > 0);
    if (!hasAny) {
      Alert.alert("Atenção", "Selecione pelo menos 1 item.");
      return;
    }
    if (!arrival.trim()) {
      Alert.alert("Atenção", "Informe o horário aproximado de chegada (ex: 13:30).");
      return;
    }

    // Aqui no próximo passo a gente chama sua RPC de reserva com estoque.
    Alert.alert(
      "Reservar (MVP)",
      `Horário: ${arrival}\nTotal estimado: R$ ${total.toFixed(2)}\n\nPróximo passo: integrar RPC.`
    );
  }

  if (loading) return <View style={{ flex: 1, padding: 24 }}><ActivityIndicator /></View>;
  if (!vendor) return <View style={{ flex: 1, padding: 24 }}><Text>Barraca não encontrada.</Text></View>;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      {/* Card barraca */}
      {vendor.photo_url ? (
        <Image source={{ uri: vendor.photo_url }} style={{ height: 180, borderRadius: 16, marginBottom: 12 }} />
      ) : null}

      <Text style={{ fontSize: 22, fontWeight: "700" }}>{vendor.name}</Text>
      <Text style={{ color: "#6b7280", marginTop: 4 }}>⭐ {Number(vendor.rating_avg ?? 0).toFixed(1)}</Text>

      <View style={{ marginTop: 12, backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" }}>
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>Informações</Text>

        <Text><Text style={{ fontWeight: "600" }}>Responsável:</Text> {safe(vendor.responsible_name)}</Text>
        <Text><Text style={{ fontWeight: "600" }}>Endereço:</Text> {safe(vendor.address)}</Text>
        <Text><Text style={{ fontWeight: "600" }}>Referência:</Text> {safe(vendor.reference_point)}</Text>
      </View>

      {/* Itens */}
      <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 18, marginBottom: 10 }}>Itens</Text>

      {items.length === 0 ? (
        <Text style={{ color: "#6b7280" }}>Esta barraca ainda não cadastrou itens.</Text>
      ) : (
        items.map((it) => {
          const q = qty[it.id] ?? 0;
          const available = it.track_stock ? (it.stock_available ?? 0) : null;

          return (
            <View
              key={it.id}
              style={{
                backgroundColor: "white",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700" }}>{it.name}</Text>
              <Text style={{ color: "#6b7280", marginTop: 2 }}>
                R$ {Number(it.price ?? 0).toFixed(2)}
                {it.track_stock ? ` • Disponível: ${available}` : " • Ilimitado"}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 }}>
                <Pressable
                  onPress={() => dec(it.id)}
                  style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "700" }}>-</Text>
                </Pressable>

                <Text style={{ minWidth: 24, textAlign: "center", fontSize: 16, fontWeight: "700" }}>
                  {q}
                </Text>

                <Pressable
                  onPress={() => inc(it.id)}
                  style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#fb923c", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "700", color: "white" }}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      {/* Chegada + total + reservar */}
      <View style={{ marginTop: 12, backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" }}>
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>Reserva</Text>

        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Horário aproximado de chegada</Text>
        <TextInput
          placeholder="Ex: 13:30"
          value={arrival}
          onChangeText={setArrival}
          style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12 }}
        />

        <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 12 }}>
          Total estimado: R$ {total.toFixed(2)}
        </Text>

        <Pressable
          onPress={reservar}
          style={{ backgroundColor: "#fb923c", padding: 16, borderRadius: 12, alignItems: "center" }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>Reservar</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
