import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { useAppModal } from "../../components/AppModal";

type Vendor = {
  id: string;
  beach_id: string; // ✅ necessário para a RPC existente
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

const OPEN_H = 7;
const CLOSE_H = 17;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function atDayTime(day: Date, h: number, m: number) {
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}
function formatDateBR(d: Date | null) {
  if (!d) return "--";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatTime(d: Date | null) {
  if (!d) return "--";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function clampToRules(selectedDay: Date, selectedTime: Date) {
  const now = new Date();
  const day0 = startOfDay(now);
  const day1 = startOfDay(addDays(now, 1));
  const pickedDay = startOfDay(selectedDay);

  if (!(isSameDay(pickedDay, day0) || isSameDay(pickedDay, day1))) {
    return { ok: false as const, reason: "Você só pode reservar para hoje ou amanhã." };
  }

  const chosen = new Date(pickedDay);
  chosen.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);

  const open = atDayTime(pickedDay, OPEN_H, 0);
  const close = atDayTime(pickedDay, CLOSE_H, 0);

  if (chosen < open) return { ok: false as const, reason: "Reservas só a partir de 07:00." };
  if (chosen > close) return { ok: false as const, reason: "Reservas só até 17:00." };

  if (isSameDay(pickedDay, day0)) {
    const min = new Date(now.getTime() + 10 * 60 * 1000);
    if (chosen < min) return { ok: false as const, reason: "Para hoje, selecione pelo menos 10 min à frente." };
  }

  return { ok: true as const, value: chosen };
}

export default function VendorScreen() {
  const { vendorId } = useLocalSearchParams();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [items, setItems] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const modal = useAppModal();

  const [submitting, setSubmitting] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState(""); // (mantido no UI)

  const [arrivalDay, setArrivalDay] = useState<Date>(() => new Date());
  const [arrivalTime, setArrivalTime] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [hasOpenReservation, setHasOpenReservation] = useState(false);
  const [openReservationMsg, setOpenReservationMsg] = useState<string | null>(null);

  const safe = (v?: string | null) => (v && v.trim() ? v : "--");

  useEffect(() => {
    load();
    checkOpenReservation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  async function checkOpenReservation() {
    const { data: u, error: uErr } = await supabase.auth.getUser();
    const user = u?.user;

    if (uErr || !user) {
      setHasOpenReservation(false);
      setOpenReservationMsg(null);
      return;
    }

    // ✅ bloquear se tiver PENDING ou CONFIRMED
    const { data, error } = await supabase
      .from("reservations")
      .select("id,status")
      .eq("user_id", user.id)
      .in("status", ["PENDING", "CONFIRMED"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      setHasOpenReservation(false);
      setOpenReservationMsg(null);
      return;
    }

    const has = (data ?? []).length > 0;
    setHasOpenReservation(has);
    setOpenReservationMsg(has ? "Você tem uma reserva em aberto. Conclua para efetuar outra." : null);
  }

  async function load() {
    setLoading(true);

    const { data: vData, error: vErr } = await supabase
      .from("vendors")
      .select("id,beach_id,name,photo_url,rating_avg,address,reference_point,responsible_name")
      .eq("id", String(vendorId))
      .limit(1);

    if (vErr) {
      modal.info("Erro", vErr.message, "Ok");
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
      modal.info("Erro", iErr.message, "Ok");
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

  async function reservar() {
    if (submitting) return;

    await checkOpenReservation();
    if (hasOpenReservation) {
      modal.info("Reserva em aberto", "Você já tem uma reserva em aberto. Conclua para efetuar outra.", "Ok");
      return;
    }

    const hasAny = Object.values(qty).some((v) => v > 0);
    if (!hasAny) {
      modal.info("Atenção", "Selecione pelo menos 1 item.", "Ok");
      return;
    }

    const check = clampToRules(arrivalDay, arrivalTime);
    if (!check.ok) {
      modal.info("Horário inválido", check.reason, "Ok");
      return;
    }

    if (!vendor?.beach_id) {
      modal.info("Erro", "Vendor sem beach_id. Não é possível reservar.", "Ok");
      return;
    }

    const arrivalIso = check.value.toISOString();

    // ✅ IMPORTANTE: sua tabela reservation_items usa `quantity`, mas a RPC espera `jsonb`.
    // A maioria das implementações espera `quantity`. Vamos mandar os dois para ser compatível,
    // e você ajusta no SQL se necessário.
    const itemsPayload = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([itemId, q]) => ({ item_id: itemId, quantity: q, qty: q }));

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_reservation_with_stock", {
        p_vendor_id: vendor.id,
        p_beach_id: vendor.beach_id,
        p_arrival_time: arrivalIso,
        p_items: itemsPayload,
      });

      if (error) {
        modal.info("Erro", error.message, "Ok");
        return;
      }

      // revalida reserva em aberto (mantém UI coerente)
      await checkOpenReservation();

      modal.confirm({
        title: "Reserva enviada!",
        message: "Reserva encaminhada com sucesso. Acompanhe o status em Reservas.",
        confirmText: "Ok",
        variant: "#fb923c",
        onConfirm: () => router.replace("/reservas"),
      });

      setQty({});
      setNote("");
    } catch (e: any) {
      modal.info("Erro", e?.message ?? "Falha ao criar reserva.", "Ok");
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

  const preview = clampToRules(arrivalDay, arrivalTime);
  const previewText = `${formatDateBR(arrivalDay)} às ${formatTime(arrivalTime)}`;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
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

        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 18, marginBottom: 10 }}>Itens</Text>

        {items.length === 0 ? (
          <Text style={{ color: "#6b7280" }}>Esta barraca ainda não cadastrou itens.</Text>
        ) : (
          items.map((it) => {
            const q = qty[it.id] ?? 0;
            const available = it.track_stock ? (it.stock_available ?? 0) : null;
            const canInc = !it.track_stock || q < (available ?? 0);

            return (
              <View key={it.id} style={{ backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: "800" }}>{it.name}</Text>
                <Text style={{ color: "#6b7280", marginTop: 2 }}>
                  R$ {Number(it.price ?? 0).toFixed(2)} {it.track_stock ? ` • Disponível: ${available}` : " • Ilimitado"}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 }}>
                  <Pressable onPress={() => dec(it.id)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 18, fontWeight: "800" }}>-</Text>
                  </Pressable>

                  <Text style={{ minWidth: 24, textAlign: "center", fontSize: 16, fontWeight: "800" }}>{q}</Text>

                  <Pressable
                    onPress={() => (canInc ? inc(it.id, available) : null)}
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: canInc ? "#fb923c" : "#f3f4f6", alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: "800", color: canInc ? "white" : "#9ca3af" }}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <View style={{ marginTop: 12, backgroundColor: "white", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" }}>
          <Text style={{ fontWeight: "800", marginBottom: 8 }}>Reserva</Text>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Dia e horário de chegada</Text>

          <View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: "white" }}>
            <Text style={{ fontWeight: "900" }}>{previewText}</Text>
            <Text style={{ color: "#6b7280", marginTop: 2, fontSize: 12 }}>
              Horário permitido: 07:00–17:00. Para hoje: mínimo 10 min à frente.
            </Text>
            {!preview.ok ? (
              <Text style={{ color: "#b91c1c", marginTop: 6, fontSize: 12, fontWeight: "800" }}>{preview.reason}</Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            <Pressable onPress={() => setShowDatePicker(true)} style={{ flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, backgroundColor: "white" }}>
              <Text style={{ fontWeight: "800" }}>Dia: {formatDateBR(arrivalDay)}</Text>
            </Pressable>

            <Pressable onPress={() => setShowTimePicker(true)} style={{ flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, backgroundColor: "white" }}>
              <Text style={{ fontWeight: "800" }}>Hora: {formatTime(arrivalTime)}</Text>
            </Pressable>
          </View>

          {showDatePicker ? (
            <DateTimePicker
              value={arrivalDay}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, selected) => {
                if (Platform.OS !== "ios") setShowDatePicker(false);
                if (selected) setArrivalDay(selected);
              }}
            />
          ) : null}

          {showTimePicker ? (
            <View style={{ marginBottom: 12 }}>
              <DateTimePicker
                value={arrivalTime}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                themeVariant="light"
                // @ts-ignore
                textColor="#111827"
                onChange={(_, selected) => {
                  if (Platform.OS !== "ios") setShowTimePicker(false);
                  if (selected) setArrivalTime(selected);
                }}
                style={Platform.OS === "ios" ? { height: 160 } : undefined}
              />

              {Platform.OS === "ios" ? (
                <Pressable onPress={() => setShowTimePicker(false)} style={{ marginTop: 8, backgroundColor: "#fb923c", paddingVertical: 12, borderRadius: 12, alignItems: "center" }}>
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
            style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: "white", color: "#111827", minHeight: 90, textAlignVertical: "top" }}
          />

          <Text style={{ fontSize: 16, fontWeight: "800", marginBottom: 12 }}>Total estimado: R$ {total.toFixed(2)}</Text>

          <Pressable
            onPress={reservar}
            disabled={submitting || hasOpenReservation}
            style={{ backgroundColor: "#fb923c", padding: 16, borderRadius: 12, alignItems: "center", opacity: submitting || hasOpenReservation ? 0.5 : 1 }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>
              {submitting ? "Enviando..." : hasOpenReservation ? "Reserva em aberto" : "Reservar"}
            </Text>
          </Pressable>

          {hasOpenReservation ? (
            <Text style={{ marginTop: 8, color: "#9ca3af", fontWeight: "700" }}>{openReservationMsg}</Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}