"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyVendorId } from "@/lib/vendor";

const ITEM_OPTIONS = [
  { value: "Cadeira", label: "Cadeira" },
  { value: "Guarda-sol", label: "Guarda-sol" },
  { value: "Mesa", label: "Mesa" },
  { value: "Cooler", label: "Cooler" },
];

type Item = {
  id: string;
  vendor_id: string;
  name: string;
  price: number;
  is_active: boolean;
  track_stock: boolean;
  stock_total: number | null;
  stock_available: number | null;
};

function TrashIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={props.className ?? "w-5 h-5"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 16h10l1-16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function ItemsPage() {
  const [vendorId, setVendorId] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Form novo item
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newStock, setNewStock] = useState<number>(0);
  const [newTrack, setNewTrack] = useState(true);

  // drafts: guarda edições locais (sem salvar automaticamente)
  const [drafts, setDrafts] = useState<Record<string, Partial<Item>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const canCreate = useMemo(
    () => newName !== "" && newPrice > 0,
    [newName, newPrice]
  );

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const vid = await getMyVendorId();
      setVendorId(vid);

      const { data, error } = await supabase
        .from("vendor_items")
        .select(
          "id,vendor_id,name,price,is_active,track_stock,stock_total,stock_available"
        )
        .eq("vendor_id", vid)
        .order("name");

      if (error) throw new Error(error.message);

      const list = (data ?? []) as Item[];
      setItems(list);
      setDrafts({}); // limpa drafts ao recarregar
    } catch (e: any) {
      setErr(e.message ?? "Erro ao carregar itens");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createItem() {
    if (!vendorId) return;

    if (items.some((i) => i.name === newName)) {
      setErr("Este item já existe para sua barraca");
      return;
    }

    setErr(null);

    const payload = {
      vendor_id: vendorId,
      name: newName,
      price: newPrice,
      is_active: true,
      track_stock: newTrack,
      stock_total: newTrack ? newStock : null,
      stock_available: newTrack ? newStock : null,
    };

    const { error } = await supabase.from("vendor_items").insert(payload);
    if (error) {
      setErr(error.message);
      return;
    }

    setNewName("");
    setNewPrice(0);
    setNewStock(0);
    setNewTrack(true);

    await load();
  }

  async function updateItem(id: string, patch: Partial<Item>) {
    setErr(null);
    const { error } = await supabase.from("vendor_items").update(patch).eq("id", id);
    if (error) setErr(error.message);
  }

  async function saveRow(it: Item) {
    const draft = drafts[it.id];
    if (!draft || Object.keys(draft).length === 0) return;

    setSavingId(it.id);
    try {
      // normaliza números
      const patch: Partial<Item> = { ...draft };

      if (patch.price !== undefined) patch.price = Number(patch.price);
      if (patch.stock_total !== undefined) patch.stock_total = Number(patch.stock_total);
      if (patch.stock_available !== undefined) patch.stock_available = Number(patch.stock_available);

      // Se não rastreia estoque, não salva estoque
      if (!it.track_stock) {
        delete patch.stock_total;
        delete patch.stock_available;
      }

      await updateItem(it.id, patch);

      // remove draft do item salvo
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[it.id];
        return copy;
      });

      await load();
    } finally {
      setSavingId(null);
    }
  }

  function setDraft(id: string, patch: Partial<Item>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
    // também atualiza visualmente na lista (pra refletir input na hora)
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } as Item : x)));
  }

  function isDirty(id: string) {
    return !!drafts[id] && Object.keys(drafts[id]!).length > 0;
  }

  async function removeItem(id: string) {
    if (!confirm("Remover este item?")) return;
    const { error } = await supabase.from("vendor_items").delete().eq("id", id);
    if (error) setErr(error.message);
    else await load();
  }

  if (loading) return <p className="text-gray-600">Carregando...</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-900">Itens da barraca</h1>
        <p className="text-gray-600 mt-1">
          Configure preços e disponibilidade dos itens.
        </p>
      </header>

      {err && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* NOVO ITEM */}
      <section className="rounded-2xl border border-gray-100 bg-white p-4 space-y-4">
        <h2 className="font-semibold text-gray-900 text-sm">
          Adicionar novo item
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Tipo */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Tipo do item
            </label>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-gray-900"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            >
              <option value="">Selecione</option>
              {ITEM_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={items.some((i) => i.name === opt.value)}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preço */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Preço (R$)</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-gray-200 p-3 text-gray-900"
              value={newPrice}
              onChange={(e) => setNewPrice(Number(e.target.value))}
            />
          </div>

          {/* Estoque total */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Estoque total</label>
            <input
              type="number"
              min={0}
              disabled={!newTrack}
              className="w-full rounded-xl border border-gray-200 p-3 text-gray-900 disabled:bg-gray-50"
              value={newStock}
              onChange={(e) => setNewStock(Number(e.target.value))}
            />
          </div>

          {/* Botão */}
          <div>
            <button
              onClick={createItem}
              disabled={!canCreate}
              className="w-full rounded-xl px-5 py-3 text-white font-semibold disabled:opacity-50 bg-orange-400 hover:bg-orange-500"
            >
              Adicionar item
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={newTrack}
            onChange={(e) => setNewTrack(e.target.checked)}
          />
          Controlar estoque (Se estiver selecionado, será limitado o número de produtos.)
        </label>
      </section>

      {/* LISTA - MOBILE (cards) */}
      <section className="md:hidden space-y-3">
        {items.map((it) => {
          const dirty = isDirty(it.id);
          const saving = savingId === it.id;

          return (
            <div key={it.id} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{it.name}</div>
                  <div className="text-xs text-gray-500">
                    {it.track_stock ? "Com estoque" : "Ilimitado"}
                  </div>
                </div>

                <button
                  onClick={() => removeItem(it.id)}
                  className="rounded-xl p-2 text-red-600 hover:bg-red-50"
                  title="Remover item"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Preço (R$)</label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-gray-200 p-3 text-gray-900"
                    value={it.price}
                    onChange={(e) => setDraft(it.id, { price: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Ativo</label>
                  <div className="h-[46px] rounded-xl border border-gray-200 px-3 flex items-center">
                    <input
                      type="checkbox"
                      checked={it.is_active}
                      onChange={(e) => setDraft(it.id, { is_active: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {it.is_active ? "Sim" : "Não"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Estoque total</label>
                  <input
                    type="number"
                    disabled={!it.track_stock}
                    className="w-full rounded-xl border border-gray-200 p-3 text-gray-900 disabled:bg-gray-50"
                    value={it.stock_total ?? 0}
                    onChange={(e) => setDraft(it.id, { stock_total: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Disponível</label>
                  <input
                    type="number"
                    disabled={!it.track_stock}
                    className="w-full rounded-xl border border-gray-200 p-3 text-gray-900 disabled:bg-gray-50"
                    value={it.stock_available ?? 0}
                    onChange={(e) => setDraft(it.id, { stock_available: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button
                onClick={() => saveRow(it)}
                disabled={!dirty || saving}
                className="w-full rounded-xl px-4 py-3 text-white font-semibold disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700"
              >
                {saving ? "Atualizando..." : "Atualizar estoque / preço"}
              </button>

              {dirty ? (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Alterações pendentes. Toque em <b>Atualizar</b> para salvar.
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      {/* LISTA - DESKTOP (tabela) */}
      <section className="hidden md:block rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
          <div className="col-span-3">Item</div>
          <div className="col-span-2">Preço</div>
          <div className="col-span-2">Estoque total</div>
          <div className="col-span-2">Disponível</div>
          <div className="col-span-1">Ativo</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {items.map((it) => {
          const dirty = isDirty(it.id);
          const saving = savingId === it.id;

          return (
            <div
              key={it.id}
              className="grid grid-cols-12 items-center border-t border-gray-100 px-4 py-3"
            >
              <div className="col-span-3 font-medium text-gray-900">
                {it.name}
                <div className="text-xs text-gray-500 mt-1">
                  {it.track_stock ? "Com estoque" : "Ilimitado"}
                </div>
              </div>

              <div className="col-span-2 pr-3">
                <input
                  type="number"
                  className="w-full text-gray-900 rounded-xl border border-gray-200 p-2"
                  value={it.price}
                  onChange={(e) => setDraft(it.id, { price: Number(e.target.value) })}
                />
              </div>

              <div className="col-span-2 pr-3">
                <input
                  type="number"
                  disabled={!it.track_stock}
                  className="w-full text-gray-900 rounded-xl border border-gray-200 p-2 disabled:bg-gray-50"
                  value={it.stock_total ?? 0}
                  onChange={(e) => setDraft(it.id, { stock_total: Number(e.target.value) })}
                />
              </div>

              <div className="col-span-2 pr-3">
                <input
                  type="number"
                  disabled={!it.track_stock}
                  className="w-full text-gray-900 rounded-xl border border-gray-200 p-2 disabled:bg-gray-50"
                  value={it.stock_available ?? 0}
                  onChange={(e) => setDraft(it.id, { stock_available: Number(e.target.value) })}
                />
              </div>

              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={it.is_active}
                  onChange={(e) => setDraft(it.id, { is_active: e.target.checked })}
                />
              </div>

              <div className="col-span-2">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => saveRow(it)}
                    disabled={!dirty || saving}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    title={!dirty ? "Sem alterações" : "Salvar alterações"}
                  >
                    {saving ? "..." : "Atualizar"}
                  </button>

                  <button
                    onClick={() => removeItem(it.id)}
                    className="rounded-xl p-2 text-red-600 hover:bg-red-50"
                    title="Remover item"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>

                {dirty ? (
                  <div className="text-[11px] text-amber-700 mt-2 text-right">
                    Alterações pendentes
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
