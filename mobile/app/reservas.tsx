import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";

type Reservation = {
  id: string;
  status: string;
  arrival_time: string | null;
  created_at: string;
  confirmation_code?: string | null;
  vendor_id: string | null;
  vendor_name?: string | null;
};

type TabKey = "atuais" | "antigas";

function statusLabel(s: string) {
  if (s === "PENDING") return "Aguardando aprovação";
  if (s === "CONFIRMED") return "Aprovado";
  if (s === "ARRIVED") return "Concluído";
  if (s === "CANCELED") return "Cancelada";
  return s;
}

function statusColors(s: string) {
  if (s === "CANCELED") return { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" };
  if (s === "PENDING") return { bg: "#fef3c7", text: "#92400e", border: "#fde68a" };
  if (s === "CONFIRMED") return { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" };
  if (s === "ARRIVED") return { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" };
  return { bg: "#f3f4f6", text: "#111827", border: "#e5e7eb" };
}

function formatNoSeconds(iso: string | null) {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Reservas() {
  const [tab, setTab] = useState<TabKey>("atuais");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Reservation[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // modal cancelamento
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [canceling, setCanceling] = useState(false);

  const CANCEL_MIN_BEFORE_ARRIVAL = 10;

  // reavalia o botão com o tempo passando
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  function getCancelBlockReason(arrivalIso: string | null) {
    // backend permite cancelar se arrival_time for null
    if (!arrivalIso) return null;

    const arrival = new Date(arrivalIso).getTime();
    const deadline = arrival - CANCEL_MIN_BEFORE_ARRIVAL * 60 * 1000;

    if (Date.now() < deadline) return null;

    return `Não é possível cancelar a menos de ${CANCEL_MIN_BEFORE_ARRIVAL} min do horário de chegada.`;
  }

  const canCancelReservation = useMemo(() => {
    void nowTick;

    return (r: Reservation) => {
      const statusOk = r.status === "PENDING" || r.status === "CONFIRMED";
      const timeOk = getCancelBlockReason(r.arrival_time) === null;
      return statusOk && timeOk;
    };
  }, [nowTick]);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr) {
      setItems([]);
      setErr(uErr.message);
      setLoading(false);
      return;
    }

    const user = u.user;
    if (!user) {
      setItems([]);
      setErr("Sessão inválida. Faça login novamente.");
      setLoading(false);
      return;
    }

    const cutoffIso = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

    const q = supabase
      .from("reservations")
      .select("id,status,arrival_time,created_at,confirmation_code,vendor_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const { data, error } =
      tab === "atuais"
        ? await q.or(`arrival_time.gte.${cutoffIso},arrival_time.is.null`)
        : await q.not("arrival_time", "is", null).lt("arrival_time", cutoffIso);

    if (error) {
      setItems([]);
      setErr(error.message);
      setLoading(false);
      return;
    }

    const reservations = (data ?? []) as Reservation[];

    // nomes das barracas (2ª query)
    const vendorIds = Array.from(new Set(reservations.map((r) => r.vendor_id).filter(Boolean))) as string[];

    const vendorMap = new Map<string, string>();
    if (vendorIds.length > 0) {
      const { data: vData, error: vErr } = await supabase.from("vendors").select("id,name").in("id", vendorIds);
      if (vErr) {
        setErr(vErr.message);
      } else {
        (vData ?? []).forEach((v: any) => vendorMap.set(v.id, v.name));
      }
    }

    const merged = reservations.map((r) => ({
      ...r,
      vendor_name: r.vendor_id ? vendorMap.get(r.vendor_id) ?? null : null,
    }));

    setItems(merged);
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // realtime
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user || !active) return;

      channel = supabase
        .channel(`user-reservations-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reservations", filter: `user_id=eq.${user.id}` },
          async () => {
            await load();
          }
        )
        .subscribe();
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function openCancel(r: Reservation) {
    const block = getCancelBlockReason(r.arrival_time);

    if (!canCancelReservation(r)) {
      Alert.alert("Não é possível cancelar", block ?? "Essa reserva não pode ser cancelada agora.");
      return;
    }

    setCancelId(r.id);
    setCancelReason("");
    setCancelOpen(true);
  }

  async function confirmCancel() {
    if (!cancelId) return;

    setCanceling(true);
    setErr(null);

    const { error } = await supabase.rpc("cancel_reservation_by_user", {
      p_reservation_id: cancelId,
      p_reason: cancelReason?.trim() || null,
    });

    setCanceling(false);

    if (error) {
      if (error.message?.includes("too_late_to_cancel")) {
        Alert.alert("Tarde demais", `Você só pode cancelar até ${CANCEL_MIN_BEFORE_ARRIVAL} min antes da chegada.`);
      } else if (error.message?.includes("invalid_status")) {
        Alert.alert("Não permitido", "Essa reserva não pode ser cancelada nesse status.");
      } else if (error.message?.includes("not_allowed")) {
        Alert.alert("Não permitido", "Você não tem permissão para cancelar esta reserva.");
      } else {
        Alert.alert("Erro", error.message);
      }
      return;
    }

    setCancelOpen(false);
    setCancelId(null);
    setCancelReason("");
    await load();
  }

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>Reservas</Text>

      {/* Tabs */}
      <View style={{ flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 14, padding: 4, marginBottom: 12 }}>
        <TabButton active={tab === "atuais"} label="Atuais" onPress={() => setTab("atuais")} />
        <TabButton active={tab === "antigas"} label="Antigas" onPress={() => setTab("antigas")} />
      </View>

      {err ? (
        <View style={{ backgroundColor: "#fff7ed", borderColor: "#fdba74", borderWidth: 1, padding: 12, borderRadius: 12, marginBottom: 12 }}>
          <Text style={{ color: "#9a3412", fontWeight: "800" }}>Erro ao carregar reservas</Text>
          <Text style={{ color: "#9a3412", marginTop: 4 }}>{err}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {!items.length ? (
          <View style={{ paddingTop: 60 }}>
            <Text style={{ textAlign: "center", color: "#6b7280", fontWeight: "700" }}>
              {tab === "atuais" ? "Nenhuma reserva atual." : "Nenhuma reserva antiga."}
            </Text>
            <Text style={{ textAlign: "center", color: "#9ca3af", marginTop: 6 }}>Quando você fizer uma reserva, ela aparecerá aqui.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((r) => {
              const c = statusColors(r.status);
              const vendorName = r.vendor_name ?? "--";
              const blockReason = getCancelBlockReason(r.arrival_time);
              const canCancelNow = canCancelReservation(r);

              return (
                <View key={r.id} style={{ backgroundColor: "white", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, padding: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "900", fontSize: 16, flexShrink: 1 }}>{vendorName}</Text>

                    <View style={{ backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
                      <Text style={{ color: c.text, fontWeight: "900", fontSize: 12 }}>{statusLabel(r.status)}</Text>
                    </View>
                  </View>

                  {r.status === "CONFIRMED" && r.confirmation_code ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: "#111827", fontWeight: "900" }}>
                        PIN: <Text style={{ color: "#fb923c" }}>{r.confirmation_code}</Text>
                      </Text>
                      <Text style={{ color: "#6b7280", marginTop: 4, fontSize: 12 }}>
                        Informe este PIN ao barraqueiro para confirmar sua chegada.
                      </Text>
                    </View>
                  ) : null}

                  <Text style={{ color: "#6b7280", marginTop: 10 }}>Chegada: {formatNoSeconds(r.arrival_time)}</Text>
                  <Text style={{ color: "#9ca3af", marginTop: 4, fontSize: 12 }}>Criada em: {formatNoSeconds(r.created_at)}</Text>

                  {(r.status === "PENDING" || r.status === "CONFIRMED") ? (
                    <View style={{ marginTop: 12 }}>
                      <Pressable
                        onPress={() => openCancel(r)}
                        disabled={!canCancelNow}
                        style={{
                          borderWidth: 1,
                          borderColor: canCancelNow ? "#ef4444" : "#e5e7eb",
                          backgroundColor: canCancelNow ? "#fff" : "#f9fafb",
                          paddingVertical: 12,
                          borderRadius: 12,
                          alignItems: "center",
                          opacity: canCancelNow ? 1 : 0.6,
                        }}
                      >
                        <Text style={{ color: canCancelNow ? "#ef4444" : "#9ca3af", fontWeight: "900" }}>
                          Cancelar reserva
                        </Text>
                      </Pressable>

                      {!canCancelNow ? (
                        <Text style={{ color: "#9ca3af", marginTop: 6, fontSize: 12 }}>
                          {blockReason ?? "Cancelamento indisponível."}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 18 }}>
          <View style={{ backgroundColor: "white", borderRadius: 16, padding: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: "#111827" }}>Cancelar reserva</Text>
            <Text style={{ color: "#6b7280", marginTop: 6 }}>Conte rapidamente o motivo (opcional).</Text>

            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Ex: não vou conseguir chegar a tempo"
              placeholderTextColor="#9ca3af"
              multiline
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 12,
                padding: 12,
                marginTop: 12,
                minHeight: 90,
                color: "#111827",
                textAlignVertical: "top",
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={() => setCancelOpen(false)}
                disabled={canceling}
                style={{ flex: 1, backgroundColor: "#f3f4f6", paddingVertical: 12, borderRadius: 12, alignItems: "center", opacity: canceling ? 0.7 : 1 }}
              >
                <Text style={{ color: "#111827", fontWeight: "900" }}>Voltar</Text>
              </Pressable>

              <Pressable
                onPress={confirmCancel}
                disabled={canceling}
                style={{ flex: 1, backgroundColor: "#ef4444", paddingVertical: 12, borderRadius: 12, alignItems: "center", opacity: canceling ? 0.7 : 1 }}
              >
                <Text style={{ color: "white", fontWeight: "900" }}>{canceling ? "Cancelando..." : "Confirmar"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: "center",
        backgroundColor: active ? "#fb923c" : "transparent",
      }}
    >
      <Text style={{ fontWeight: "900", color: active ? "white" : "#111827" }}>{label}</Text>
    </Pressable>
  );
}
