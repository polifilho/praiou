"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyVendorId } from "@/lib/vendor";

type Vendor = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;

  address: string | null;
  reference_point: string | null;
  responsible_name: string | null;

  is_active: boolean;
};

export default function DashboardHome() {
  const [vendorId, setVendorId] = useState<string>("");
  const [vendor, setVendor] = useState<Vendor | null>(null);

  const [address, setAddress] = useState("");
  const [referencePoint, setReferencePoint] = useState("");
  const [responsibleName, setResponsibleName] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function setFormFromVendor(v: Vendor) {
    setAddress(v.address ?? "");
    setReferencePoint(v.reference_point ?? "");
    setResponsibleName(v.responsible_name ?? "");
  }

  async function load() {
    setLoading(true);
    setErr(null);
    setOk(null);

    try {
      const vid = await getMyVendorId();
      setVendorId(vid);

      const { data, error } = await supabase
        .from("vendors")
        .select("id,name,description,photo_url,address,reference_point,responsible_name,is_active")
        .eq("id", vid)
        .limit(1);

      if (error) throw new Error(error.message);
      const v = (data?.[0] as Vendor) ?? null;
      if (!v) throw new Error("Barraca não encontrada");

      setVendor(v);
      setFormFromVendor(v);
    } catch (e: any) {
      setErr(e.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onUploadPhoto(file: File) {
    if (!vendorId) return;

    setErr(null);
    setOk(null);
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

      setOk("Foto atualizada com sucesso.");
      await load();
    } catch (e: any) {
      setErr(e.message ?? "Erro no upload da foto");
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    if (!vendorId) return;

    setErr(null);
    setOk(null);
    setSaving(true);

    try {
      const { error } = await supabase
        .from("vendors")
        .update({
          address: address.trim() || null,
          reference_point: referencePoint.trim() || null,
          responsible_name: responsibleName.trim() || null,
        })
        .eq("id", vendorId);

      if (error) throw new Error(error.message);

      setOk("Dados salvos com sucesso.");
      await load();
      setAddress("");
      setReferencePoint("");
      setResponsibleName("");
    } catch (e: any) {
      setErr(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-600">Carregando...</div>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Visão geral</h1>
        <p className="text-gray-600 mt-1">Informações da sua barraca.</p>
      </header>

      {err && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}
      {ok && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
          {ok}
        </div>
      )}

      {/* CARD: BARRACA + FOTO */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-start gap-4">
          <div className="h-24 w-24 rounded-2xl bg-sand overflow-hidden ring-1 ring-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {vendor?.photo_url ? (
              <img
                src={vendor.photo_url}
                alt="Foto da barraca"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                Sem foto
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="text-lg font-semibold text-gray-900">{vendor?.name}</div>
            <div className="text-sm text-gray-600 mt-1">
              {vendor?.description ?? "Sem descrição"}
            </div>

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
                {uploading ? "Enviando..." : "Enviar/alterar foto"}
              </label>

              <span className="text-xs text-gray-500">
                Recomendado: quadrada, até ~2MB.
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm text-gray-700">
        {vendor?.responsible_name ? (
          <div>
            <span className="font-medium text-gray-900">Responsável:</span>{" "}
            {vendor.responsible_name}
          </div>
        ) : null}

        {vendor?.address ? (
          <div>
            <span className="font-medium text-gray-900">Endereço:</span> {vendor.address}
          </div>
        ) : null}

        {vendor?.reference_point ? (
          <div>
            <span className="font-medium text-gray-900">Referência:</span>{" "}
            {vendor.reference_point}
          </div>
        ) : null}
      </div>

      </section>

      {/* CARD: LOCALIZAÇÃO */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Localização na praia</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Endereço (opcional)</label>
            <input
              className="w-full rounded-xl border border-gray-200 p-3 text-gray-900"
              placeholder="Ex: Av. Atlântica, Posto 4"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Ponto de referência</label>
            <input
              className="w-full rounded-xl border border-gray-200 p-3 text-gray-900"
              placeholder="Ex: em frente ao quiosque X / perto do salva-vidas"
              value={referencePoint}
              onChange={(e) => setReferencePoint(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-gray-500">
          Isso ajuda o cliente a te encontrar com mais facilidade.
        </p>
      </section>

      {/* CARD: RESPONSÁVEL */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Responsável</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nome do responsável</label>
            <input
              className="w-full rounded-xl border border-gray-200 p-3 text-gray-900"
              placeholder="Ex: João / Maria"
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
            />
          </div>

          <div className="text-xs text-gray-500 flex items-end">
            (Opcional) Depois podemos adicionar telefone/WhatsApp.
          </div>
        </div>
      </section>

      {/* AÇÕES */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={load}
          className="rounded-xl bg-gray-100 px-4 py-3 text-gray-800 font-medium hover:bg-gray-200"
        >
          Cancelar
        </button>

        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-xl bg-sun px-5 py-3 text-white font-semibold disabled:opacity-60 bg-orange-400"
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </div>
  );
}
