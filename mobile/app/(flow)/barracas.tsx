import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../lib/supabase";

type Vendor = {
  id: string;
  name: string;
  photo_url: string | null;
  rating_avg: number | null;
};

export default function Barracas() {
  const { beachId, beachName } = useLocalSearchParams();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [beachId]);

  async function load() {
    setLoading(true);
    setErr(null);

    const { data, error } = await supabase
      .from("vendors")
      .select("id,name,photo_url,rating_avg")
      .eq("beach_id", String(beachId))
      .eq("is_active", true)
      .order("rating_avg", { ascending: false });

    if (error) setErr(error.message);
    setVendors((data ?? []) as Vendor[]);
    setLoading(false);
  }

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: "600", marginBottom: 16 }}>
        Barracas — {String(beachName ?? "")}
      </Text>

      {loading ? <ActivityIndicator /> : null}
      {err ? <Text style={{ color: "red", marginBottom: 12 }}>{err}</Text> : null}

      {!loading && vendors.length === 0 ? (
        <Text style={{ color: "#6b7280" }}>
          Nenhuma barraca cadastrada nesta praia ainda.
        </Text>
      ) : null}

      {vendors.map((v) => (
        <Pressable
          key={v.id}
          onPress={() =>
            router.push({
              pathname: "/(flow)/itens",
              params: { vendorId: v.id, vendorName: v.name },
            })
          }
          style={{
            backgroundColor: "white",
            padding: 16,
            borderRadius: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "#e5e7eb",
          }}
        >
          {v.photo_url ? (
            <Image
              source={{ uri: v.photo_url }}
              style={{ height: 120, borderRadius: 12, marginBottom: 8 }}
            />
          ) : null}

          <Text style={{ fontSize: 16, fontWeight: "600" }}>{v.name}</Text>
          <Text style={{ color: "#6b7280" }}>
            ⭐ {Number(v.rating_avg ?? 0).toFixed(1)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
