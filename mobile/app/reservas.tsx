import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";

type Reservation = {
  id: string;
  status: string;
  arrival_time: string | null;
  created_at: string;
  confirmation_code?: string | null;
  vendor_id: string | null;
  vendor_name?: string | null; // ✅ preenchido no front
};

type TabKey = "atuais" | "antigas";

function statusLabel(s: string) {
  if (s === "PENDING") return "Aguardando aprovação";
  if (s === "CONFIRMED") return "Aprovado";
  if (s === "ARRIVED") return "Concluído";
  if (s === "CANCELED") return "Rejeitado";
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

  // ✅ Realtime
  const [userId, setUserId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

    // ✅ salva userId para o realtime
    setUserId(user.id);

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

    // ✅ busca nomes das barracas por vendor_id (2ª query)
    const vendorIds = Array.from(
      new Set(reservations.map((r) => r.vendor_id).filter(Boolean))
    ) as string[];

    const vendorMap = new Map<string, string>();

    if (vendorIds.length > 0) {
      const { data: vData, error: vErr } = await supabase
        .from("vendors")
        .select("id,name")
        .in("id", vendorIds);

      if (vErr) {
        // se der RLS aqui, você vai ver a mensagem
        setErr(vErr.message);
      } else {
        (vData ?? []).forEach((v: any) => {
          vendorMap.set(v.id, v.name);
        });
      }
    }

    const merged: Reservation[] = reservations.map((r) => ({
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

  // ✅ load ao trocar aba
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ✅ Realtime: assina quando tiver userId
  useEffect(() => {
    if (!userId) return;

    // limpa canal anterior (evita duplicar)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`customer-reservations-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          // MVP robusto: recarrega
          await load();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 12 }}>
        Reservas
      </Text>

      {/* Tabs */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#f3f4f6",
          borderRadius: 14,
          padding: 4,
          marginBottom: 12,
        }}
      >
        <TabButton
          active={tab === "atuais"}
          label="Atuais"
          onPress={() => setTab("atuais")}
        />
        <TabButton
          active={tab === "antigas"}
          label="Antigas"
          onPress={() => setTab("antigas")}
        />
      </View>

      {err ? (
        <View
          style={{
            backgroundColor: "#fff7ed",
            borderColor: "#fdba74",
            borderWidth: 1,
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "#9a3412", fontWeight: "800" }}>
            Erro ao carregar reservas
          </Text>
          <Text style={{ color: "#9a3412", marginTop: 4 }}>{err}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!items.length ? (
          <View style={{ paddingTop: 60 }}>
            <Text
              style={{
                textAlign: "center",
                color: "#6b7280",
                fontWeight: "700",
              }}
            >
              {tab === "atuais"
                ? "Nenhuma reserva atual."
                : "Nenhuma reserva antiga."}
            </Text>
            <Text
              style={{
                textAlign: "center",
                color: "#9ca3af",
                marginTop: 6,
              }}
            >
              Quando você fizer uma reserva, ela aparecerá aqui.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((r) => {
              const c = statusColors(r.status);
              const vendorName = r.vendor_name ?? "--";

              return (
                <View
                  key={r.id}
                  style={{
                    backgroundColor: "white",
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  {/* topo: nome da barraca + badge */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: "900",
                        fontSize: 16,
                        flexShrink: 1,
                      }}
                    >
                      {vendorName}
                    </Text>

                    <View
                      style={{
                        backgroundColor: c.bg,
                        borderColor: c.border,
                        borderWidth: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          color: c.text,
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        {statusLabel(r.status)}
                      </Text>
                    </View>
                  </View>

                  {/* PIN se confirmado */}
                  {r.status === "CONFIRMED" && r.confirmation_code ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ color: "#111827", fontWeight: "900" }}>
                        PIN:{" "}
                        <Text style={{ color: "#fb923c" }}>
                          {r.confirmation_code}
                        </Text>
                      </Text>
                      <Text
                        style={{
                          color: "#6b7280",
                          marginTop: 4,
                          fontSize: 12,
                        }}
                      >
                        Informe este PIN ao barraqueiro para confirmar sua
                        chegada.
                      </Text>
                    </View>
                  ) : null}

                  <Text style={{ color: "#6b7280", marginTop: 10 }}>
                    Chegada: {formatNoSeconds(r.arrival_time)}
                  </Text>

                  <Text style={{ color: "#9ca3af", marginTop: 4, fontSize: 12 }}>
                    Criada em: {formatNoSeconds(r.created_at)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
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
      <Text style={{ fontWeight: "900", color: active ? "white" : "#111827" }}>
        {label}
      </Text>
    </Pressable>
  );
}
