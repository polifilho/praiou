"use client";

import { useState } from "react";

export default function NewVendorPage() {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    vendor_name: "",
    address: "",
    reference_point: "",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  async function submit() {
    setErr(null);
    setInviteLink(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/vendors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro");

      setInviteLink(json.action_link ?? null);
      setForm({
        full_name: "",
        phone: "",
        email: "",
        vendor_name: "",
        address: "",
        reference_point: "",
      });
    } catch (e: any) {
      setErr(e?.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  const waText = inviteLink
    ? encodeURIComponent(
        `Oi! Você foi cadastrado como lojista no Orla+.\n\nDefina sua senha por este link:\n${inviteLink}\n\nDepois faça login no painel.`
      )
    : "";

  const waLink = form.phone
    ? `https://wa.me/${form.phone.replace(/\D/g, "")}?text=${waText}`
    : "";

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Cadastrar lojista</h1>
        <p className="text-sm text-gray-600 mt-1">Cria o acesso e a barraca e gera link para definir senha.</p>
      </div>

      {err && <div className="rounded-xl bg-red-50 text-red-700 p-3">{err}</div>}

      <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
        <Input label="Nome do responsável" value={form.full_name} onChange={(v) => set("full_name", v)} />
        <Input label="WhatsApp (com DDD)" value={form.phone} onChange={(v) => set("phone", v)} placeholder="21999999999" />
        <Input label="Email" value={form.email} onChange={(v) => set("email", v)} />
        <Input label="Nome da barraca" value={form.vendor_name} onChange={(v) => set("vendor_name", v)} />
        <Input label="Endereço" value={form.address} onChange={(v) => set("address", v)} />
        <Input label="Ponto de referência" value={form.reference_point} onChange={(v) => set("reference_point", v)} />

        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded-xl bg-orange-500 text-white font-semibold py-3 disabled:opacity-60"
        >
          {loading ? "Criando..." : "Criar lojista + gerar link"}
        </button>
      </div>

      {inviteLink && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-3">
          <div className="text-emerald-900 font-semibold">Convite gerado ✅</div>

          <div className="text-xs text-emerald-900 break-all bg-white rounded-xl p-3 border border-emerald-100">
            {inviteLink}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(inviteLink)}
              className="rounded-xl bg-white border border-emerald-200 text-emerald-900 font-semibold px-4 py-2"
            >
              Copiar link
            </button>

            <a
              className={`rounded-xl px-4 py-2 font-semibold ${
                form.phone ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500 pointer-events-none"
              }`}
              href={form.phone ? `https://wa.me/${form.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Oi! Você foi cadastrado como lojista no Orla+.\n\nDefina sua senha por este link:\n${inviteLink}\n\nDepois faça login no painel.`
              )}` : "#"}
              target="_blank"
              rel="noreferrer"
            >
              Enviar no WhatsApp
            </a>
          </div>

          <div className="text-xs text-emerald-900">
            *Você também pode mandar esse link por email manualmente ou automatizar depois.
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-gray-800 mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-orange-200"
      />
    </label>
  );
}
