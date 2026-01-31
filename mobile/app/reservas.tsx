import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, RefreshControl } from "react-native";
import { supabase } from "../lib/supabase";

type Reservation = {
  id: string;
  status: string;
  arrival_time: string | null;
  created_at: string;
};

type TabKey = "atuais" | "antigas";

export default function Reservas() {
  const [tab, setTab] = useState<TabKey>("atuais");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<Reservation[]>([]);

  async function load() {
    setLoading(true);

    const { data: u } = await supabase.auth.getUser();
    const user = u.user;

    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const cutoffIso = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();

    const q = supabase
      .from("reservations")
      .select("id,status,arrival_time,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const { data, error } =
      tab === "atuais"
        ? await q.or(`arrival_time.gte.${cutoffIso},arrival_time.is.null`)
        : await q.not("arrival_time", "is", null).lt("arrival_time", cutoffIso);

    setLoading(false);

    if (error) {
      setItems([]);
      return;
    }

    setItems((data as Reservation[]) ?? []);
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
        <TabButton active={tab === "atuais"} label="Atuais" onPress={() => setTab("atuais")} />
        <TabButton active={tab === "antigas"} label="Antigas" onPress={() => setTab("antigas")} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!items.length ? (
          <View style={{ paddingTop: 60 }}>
            <Text style={{ textAlign: "center", color: "#6b7280", fontWeight: "700" }}>
              {tab === "atuais"
                ? "Nenhuma reserva atual."
                : "Nenhuma reserva antiga."}
            </Text>
            <Text style={{ textAlign: "center", color: "#9ca3af", marginTop: 6 }}>
              Quando você fizer uma reserva, ela aparecerá aqui.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((r) => (
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
                <Text style={{ fontWeight: "900", fontSize: 16 }}>
                  Status: {r.status}
                </Text>

                <Text style={{ color: "#6b7280", marginTop: 6 }}>
                  Chegada:{" "}
                  {r.arrival_time
                    ? new Date(r.arrival_time).toLocaleString()
                    : "--"}
                </Text>

                <Text style={{ color: "#9ca3af", marginTop: 4, fontSize: 12 }}>
                  Criada em: {new Date(r.created_at).toLocaleString()}
                </Text>
              </View>
            ))}
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
