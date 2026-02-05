import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, router } from "expo-router";
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
  const [submitting, setSubmitting] = useState(false);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  // TimePicker
  const [arrivalTime, setArrivalTime] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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

  function inc(id: string, max?: number | null) {
    setQty((prev) => {
      const next = (prev[id] ?? 0) + 1;
      if (typeof max === "number") return { ...prev, [id]: Math.min(next, max) };
      return { ...prev, [id]: next };
    });
  }

  function dec(id: string) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) - 1) }));
  }

  function formatTime(d: Date | null) {
    if (!d) return "--";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function buildArrivalISO(selected: Date) {
    const now = new Date();
    const d = new Date(now);
    d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    // se o horário escolhido já passou hoje, joga para amanhã (MVP)
    if (d.getTime() < now.getTime() - 60 * 1000) {
      d.setDate(d.getDate() + 1);
    }

    return d.toISOString();
  }

  function todayAt(h: number, m: number) {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  const OPEN_LIMIT = { h: 22, m: 0 }; // fecha 18:00

  function clampToRules(selected: Date) {
    const now = new Date();
    const close = todayAt(OPEN_LIMIT.h, OPEN_LIMIT.m);

    // se já passou do horário limite, nem deixa reservar hoje
    if (now >= close) {
      return { ok: false as const, reason: "Reservas encerradas hoje (após 18:00)." };
    }

    // cria um Date "hoje" com a hora/minuto escolhidos
    const chosen = new Date();
    chosen.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    // não permitir passado
    if (chosen < now) {
      return { ok: false as const, reason: "Escolha um horário no futuro (não pode no passado)." };
    }

    // não permitir depois das 18:00
    if (chosen > close) {
      return { ok: false as const, reason: "Reservas só até 18:00." };
    }

    return { ok: true as const, value: chosen };
  }

  function handleTimeSelected(selected: Date) {
    const res = clampToRules(selected);
    if (!res.ok) {
      Alert.alert("Horário inválido", res.reason);
      return;
    }
    setArrivalTime(res.value);
  }

  async function reservar() {
    // ✅ trava duplo clique
    if (submitting) return;

    const hasAny = Object.values(qty).some((v) => v > 0);
    if (!hasAny) {
      Alert.alert("Atenção", "Selecione pelo menos 1 item.");
      return;
    }

    if (!arrivalTime) {
      Alert.alert("Atenção", "Selecione o horário de chegada.");
      return;
    }

    const check = clampToRules(arrivalTime);
    if (!check.ok) {
      Alert.alert("Horário inválido", check.reason);
      return;
    }

    const arrivalIso = check.value.toISOString();

    const itemsPayload = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([itemId, q]) => ({
        item_id: itemId,
        qty: q,
      }));

    setSubmitting(true);

    try {
      const { data: reservationId, error } = await supabase.rpc(
        "create_reservation_with_stock",
        {
          p_vendor_id: vendor!.id,
          p_arrival_time: arrivalIso,
          p_note: note?.trim() || null,
          p_items: itemsPayload,
        }
      );

      if (error) {
        Alert.alert("Erro", error.message);
        return;
      }

      // ✅ opcional: limpar estado antes de sair
      setQty({});
      setArrivalTime(null);
      setNote("");

      Alert.alert(
        "Reserva enviada!",
        "Reserva encaminhada com sucesso. Acompanhe o status em Reservas.",
        [{ text: "OK", onPress: () => router.replace("/reservas") }]
      );
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Falha ao criar reserva.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 24 }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={{ flex: 1, padding: 24 }}>
        <Text>Barraca não encontrada.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} // ajuste fino se precisar
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Card barraca */}
        {vendor.photo_url ? (
          <Image source={{ uri: vendor.photo_url }} style={{ height: 180, borderRadius: 16, marginBottom: 12 }} />
        ) : (
          <View style={{ height: 180, borderRadius: 16, marginBottom: 12, backgroundColor: "#f3f4f6" }} />
        )}

        <Text style={{ fontSize: 22, fontWeight: "800" }}>{vendor.name}</Text>
        <Text style={{ color: "#6b7280", marginTop: 4 }}>⭐ {Number(vendor.rating_avg ?? 0).toFixed(1)}</Text>

        <View style={{ marginTop: 12, backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" }}>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>Informações</Text>
          <Text><Text style={{ fontWeight: "700" }}>Responsável:</Text> {safe(vendor.responsible_name)}</Text>
          <Text><Text style={{ fontWeight: "700" }}>Endereço:</Text> {safe(vendor.address)}</Text>
          <Text><Text style={{ fontWeight: "700" }}>Referência:</Text> {safe(vendor.reference_point)}</Text>
        </View>

        {/* Itens */}
        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 18, marginBottom: 10 }}>Itens</Text>

        {items.length === 0 ? (
          <Text style={{ color: "#6b7280" }}>Esta barraca ainda não cadastrou itens.</Text>
        ) : (
          items.map((it) => {
            const q = qty[it.id] ?? 0;
            const available = it.track_stock ? (it.stock_available ?? 0) : null;
            const canInc = !it.track_stock || q < (available ?? 0);

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
                <Text style={{ fontSize: 16, fontWeight: "800" }}>{it.name}</Text>
                <Text style={{ color: "#6b7280", marginTop: 2 }}>
                  R$ {Number(it.price ?? 0).toFixed(2)} {it.track_stock ? ` • Disponível: ${available}` : " • Ilimitado"}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 }}>
                  <Pressable
                    onPress={() => dec(it.id)}
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "800" }}>-</Text>
                  </Pressable>

                  <Text style={{ minWidth: 24, textAlign: "center", fontSize: 16, fontWeight: "800" }}>
                    {q}
                  </Text>

                  <Pressable
                    onPress={() => (canInc ? inc(it.id, available) : null)}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: canInc ? "#fb923c" : "#f3f4f6",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "800", color: canInc ? "white" : "#9ca3af" }}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {/* Reserva */}
        <View style={{ marginTop: 12, backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" }}>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>Reserva</Text>

          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Horário aproximado de chegada</Text>

          <Pressable
            onPress={() => setShowPicker(true)}
            style={{
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              backgroundColor: "white",
            }}
          >
            <Text style={{ fontWeight: "800" }}>{arrivalTime ? formatTime(arrivalTime) : "Selecionar horário"}</Text>
            <Text style={{ color: "#6b7280", marginTop: 2, fontSize: 12 }}>
              Você tem 20 min de tolerância a partir desse horário.
            </Text>
          </Pressable>

          {showPicker ? (
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderWidth: 1,
                borderColor: "#e5e7eb",
                marginBottom: 12,
              }}
            >
              <DateTimePicker
                value={arrivalTime ?? new Date()}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                themeVariant="light"              // ✅ força tema claro
                textColor="#111827"               // ✅ iOS: garante texto escuro
                onChange={(_, selected) => {
                  if (Platform.OS !== "ios") setShowPicker(false);
                  if (selected) handleTimeSelected(selected);
                }}
                style={Platform.OS === "ios" ? { height: 160 } : undefined} // ✅ dá altura no iOS
              />

              {Platform.OS === "ios" ? (
                <Pressable
                  onPress={() => setShowPicker(false)}
                  style={{
                    marginTop: 8,
                    backgroundColor: "#fb923c",
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "900" }}>OK</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Observação (opcional)</Text>
          <TextInput
            multiline
            value={note}
            onChangeText={setNote}
            placeholder="Ex: vou chegar perto do posto 9"
            placeholderTextColor="#9ca3af"
            style={{
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              backgroundColor: "white",
              color: "#111827",
              minHeight: 90,
              textAlignVertical: "top",
            }}
          />

          <Text style={{ fontSize: 16, fontWeight: "800", marginBottom: 12 }}>
            Total estimado: R$ {total.toFixed(2)}
          </Text>

          <Pressable
            onPress={reservar}
            disabled={submitting}
            style={{
              backgroundColor: "#fb923c",
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>
              {submitting ? "Enviando..." : "Reservar"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
