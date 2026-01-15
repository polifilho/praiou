import { supabase } from "@/lib/supabaseClient";

export async function getMyVendorId(): Promise<string> {
  const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw new Error(sessErr.message);

  const user = sessionData.session?.user;
  if (!user) throw new Error("Sem sessão");

  console.log("SESSION USER ID:", user.id, "EMAIL:", user.email);

  // Evita .single() / .maybeSingle()
  const { data, error } = await supabase
    .from("vendor_users")
    .select("vendor_id")
    .eq("user_id", user.id)
    .limit(1);

  if (error) throw new Error(error.message);

  const vendorId = data?.[0]?.vendor_id;
  console.log("VENDOR_USERS RESULT:", data);

  if (!vendorId) throw new Error("Usuário não vinculado a nenhuma barraca");
  return vendorId;
}

export async function getMyVendor() {
  const vendorId = await getMyVendorId();
  console.log("VENDOR_ID:", vendorId);

  const { data, error } = await supabase
    .from("vendors")
    .select("id,name,description,photo_url,beach_id,is_active,rating_avg,rating_count")
    .eq("id", vendorId)
    .limit(1);

  if (error) throw new Error(error.message);

  console.log("VENDORS RESULT:", data);

  const vendor = data?.[0];
  if (!vendor) throw new Error("Barraca não encontrada (vendors)");
  return vendor;
}
