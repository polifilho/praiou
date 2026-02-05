import { supabase } from "@/lib/supabaseClient";

export async function getMyVendorId(): Promise<string> {
  // tenta pegar sessão (se refresh token estiver quebrado, volta null)
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    // limpa qualquer lixo de sessão e devolve erro controlado
    await supabase.auth.signOut();
    throw new Error("SEM_SESSAO");
  }

  const { data: links, error: linkErr } = await supabase
    .from("vendor_users")
    .select("vendor_id")
    .eq("user_id", user.id)
    .limit(1);

  if (linkErr) throw new Error(linkErr.message);

  const vendorId = links?.[0]?.vendor_id;
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
