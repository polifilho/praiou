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
      setItems((data ?? []) as Item[]);
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
    else await load();
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
        <h2 className="font-semibold text-gray-900 text-sm">Adicionar novo item</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <label className="text-sm font-medium text-gray-700">
              Preço (R$)
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border border-gray-200 p-3 text-gray-900"
              value={newPrice}
              onChange={(e) => setNewPrice(Number(e.target.value))}
            />
          </div>

          {/* Estoque */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Estoque total
            </label>
            <input
              type="number"
              min={0}
              disabled={!newTrack}
              className="w-full rounded-xl border border-gray-200 p-3 text-gray-900 disabled:bg-gray-50"
              value={newStock}
              onChange={(e) => setNewStock(Number(e.target.value))}
            />
          </div>

          {/* Track */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={newTrack}
                onChange={(e) => setNewTrack(e.target.checked)}
              />
              Controlar estoque
            </label>
          </div>
        </div>

        <button
          onClick={createItem}
          disabled={!canCreate}
          className="rounded-xl bg-sun px-5 py-2 text-white font-semibold disabled:opacity-50"
        >
          Adicionar item
        </button>
      </section>

      {/* LISTA */}
      <section className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600">
          <div className="col-span-3">Item</div>
          <div className="col-span-2">Preço</div>
          <div className="col-span-2">Estoque total</div>
          <div className="col-span-2">Disponível</div>
          <div className="col-span-1">Ativo</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {items.map((it) => (
          <div
            key={it.id}
            className="grid grid-cols-12 items-center border-t border-gray-100 px-4 py-3"
          >
            <div className="col-span-3 font-medium text-gray-900">
              {it.name}
            </div>

            <div className="col-span-2">
              <input
                type="number"
                className="w-full rounded-xl border border-gray-200 p-2"
                value={it.price}
                onBlur={(e) =>
                  updateItem(it.id, { price: Number(e.target.value) })
                }
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((x) =>
                      x.id === it.id ? { ...x, price: Number(e.target.value) } : x
                    )
                  )
                }
              />
            </div>

            <div className="col-span-2">
              <input
                type="number"
                disabled={!it.track_stock}
                className="w-full rounded-xl border border-gray-200 p-2 disabled:bg-gray-50"
                value={it.stock_total ?? 0}
                onBlur={(e) =>
                  updateItem(it.id, { stock_total: Number(e.target.value) })
                }
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((x) =>
                      x.id === it.id
                        ? { ...x, stock_total: Number(e.target.value) }
                        : x
                    )
                  )
                }
              />
            </div>

            <div className="col-span-2">
              <input
                type="number"
                disabled={!it.track_stock}
                className="w-full rounded-xl border border-gray-200 p-2 disabled:bg-gray-50"
                value={it.stock_available ?? 0}
                onBlur={(e) =>
                  updateItem(it.id, {
                    stock_available: Number(e.target.value),
                  })
                }
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((x) =>
                      x.id === it.id
                        ? {
                            ...x,
                            stock_available: Number(e.target.value),
                          }
                        : x
                    )
                  )
                }
              />
            </div>

            <div className="col-span-1">
              <input
                type="checkbox"
                checked={it.is_active}
                onChange={(e) =>
                  updateItem(it.id, { is_active: e.target.checked })
                }
              />
            </div>

            <div className="col-span-2 text-right">
              <button
                onClick={() => removeItem(it.id)}
                className="rounded-xl bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
