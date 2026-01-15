"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyVendor, getMyVendorId } from "@/lib/vendor";

export default function DashboardHome() {
  const [vendor, setVendor] = useState<any>(null);
  const [vendorId, setVendorId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setErr(null);
    try {
      const vid = await getMyVendorId();
      setVendorId(vid);
      setVendor(await getMyVendor());
    } catch (e: any) {
      setErr(e.message ?? "Erro");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onUploadPhoto(file: File) {
    if (!vendorId) return;
    setErr(null);
    setUploading(true);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${vendorId}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("vendors")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw new Error(upErr.message);

      const { data } = supabase.storage.from("vendors").getPublicUrl(path);
      const publicUrl = data.publicUrl;

      const { error: dbErr } = await supabase
        .from("vendors")
        .update({ photo_url: publicUrl })
        .eq("id", vendorId);

      if (dbErr) throw new Error(dbErr.message);

      await load();
    } catch (e: any) {
      setErr(e.message ?? "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  if (err) return <div className="text-red-700 bg-red-50 p-3 rounded-xl">{err}</div>;
  if (!vendor) return <div className="text-gray-600">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Visão geral</h1>
        <p className="text-gray-600 mt-1">Sua barraca e configurações.</p>
      </div>

      <div className="rounded-2xl border border-gray-100 p-4 bg-white">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 rounded-2xl bg-sand overflow-hidden ring-1 ring-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {vendor.photo_url ? (
              <img src={vendor.photo_url} alt="Foto da barraca" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                Sem foto
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="text-lg font-semibold text-gray-900">{vendor.name}</div>
            <div className="text-sm text-gray-600 mt-1">{vendor.description ?? "Sem descrição"}</div>

            <div className="mt-3 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-800 cursor-pointer hover:bg-gray-200">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadPhoto(f);
                  }}
                />
                {uploading ? "Enviando..." : "Enviar foto"}
              </label>

              <span className="text-xs text-gray-500">
                Recomendado: imagem quadrada, até ~2MB.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
