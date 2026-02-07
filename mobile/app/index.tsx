import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

type Region = { id: string; name: string };

export default function Regioes() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("regions")
      .select("id,name")
      .order("name", { ascending: true });

    if (error) setErr(error.message);
    setRegions((data ?? []) as Region[]);
    setLoading(false);
  }

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: 16 }}>
        Escolha a região
      </Text>

      {loading ? <ActivityIndicator /> : null}

      {err ? (
        <Text style={{ color: "red", marginBottom: 12 }}>{err}</Text>
      ) : null}

      {!loading && regions.length === 0 ? (
        <Text style={{ color: "#6b7280" }}>
          Nenhuma região cadastrada ainda.
        </Text>
      ) : null}

      {regions.map((r) => (
        <Pressable
          key={r.id}
          onPress={() =>
            router.push({
              pathname: "/(flow)/praias",
              params: { regionId: r.id, regionName: r.name },
            })
          }
          style={{
            backgroundColor: "#fb923c", // orange-400
            padding: 16,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            {r.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
