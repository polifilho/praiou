import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";

type Beach = { id: string; name: string };

export default function Praias() {
  const { regionId, regionName } = useLocalSearchParams();
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [regionId]);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("beaches")
      .select("id,name")
      .eq("region_id", String(regionId))
      .order("name", { ascending: true });

    if (error) setErr(error.message);
    setBeaches((data ?? []) as Beach[]);
    setLoading(false);
  }

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: 16 }}>
        Praias — {String(regionName ?? "")}
      </Text>

      {loading ? <ActivityIndicator /> : null}

      {err ? (
        <Text style={{ color: "red", marginBottom: 12 }}>{err}</Text>
      ) : null}

      {!loading && beaches.length === 0 ? (
        <Text style={{ color: "#6b7280" }}>
          Nenhuma praia cadastrada para esta região.
        </Text>
      ) : null}

      {beaches.map((b) => (
        <Pressable
          key={b.id}
          onPress={() =>
            router.push({
              pathname: "/(flow)/barracas",
              params: { beachId: b.id, beachName: b.name },
            })
          }
          style={{
            backgroundColor: "#fb923c",
            padding: 16,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            {b.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
