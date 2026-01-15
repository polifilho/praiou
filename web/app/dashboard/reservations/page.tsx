"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyVendorId } from "@/lib/vendor";

type Reservation = {
  id: string;
  arrival_time: string;
  expires_at: string;
  status: "PENDING" | "CONFIRMED" | "ARRIVED" | "NO_SHOW" | "CANCELED";
  total: number;
  client_checked_in_at: string | null;
  created_at: string;
};

export default function ReservationsPage() {
  const [vendorId, setVendorId] = useState<string>("");
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const vid = await getMyVendorId();
      setVendorId(vid);

      const { data, error } = await supabase
        .from("reservations")
        .select("id,arrival_time,expires_at,status,total,client_checked_in_at,created_at")
        .eq("vendor_id", vid)
        .order("arrival_time", { ascending: true });

      if (error) throw new Error(error.message);
      setRows((data ?? []) as Reservation[]);
    } catch (e: any) {
      setErr(e.message ?? "Erro");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markArrived(reservationId: string) {
    setErr(null);
    const { error } = await supabase
      .from("reservations")
      .update({ status: "ARRIVED" })
      .eq("id", reservationId);

    if (error) setErr(error.message);
    else await load();
  }

  async function markNoShow(reservationId: string) {
    setErr(null);
    // usa sua RPC para devolver estoque
    const { error } = await supabase.rpc("cancel_reservation_and_restock", {
      p_reservation_id: reservationId,
      p_new_status: "NO_SHOW",
    });
    if (error) setErr(error.message);
    else await load();
  }

  if (loading) return <div className="text-gray-600">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
        <p className="text-gray-600 mt-1">Marque ARRIVED após o cliente fazer check-in.</p>
      </div>

      {err && <div className="text-red-700 bg-red-50 p-3 rounded-xl">{err}</div>}

      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold text-gray-600 px-4 py-3">
          <div className="col-span-3">Chegada</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Check-in do cliente</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {rows.map((r) => {
          const canArrive = r.status === "CONFIRMED" && !!r.client_checked_in_at;
          const canNoShow = r.status === "CONFIRMED"; // MVP: manual enquanto não tem cron

          return (
            <div key={r.id} className="grid grid-cols-12 px-4 py-3 border-t border-gray-100 items-center">
              <div className="col-span-3">
                <div className="font-medium text-gray-900">
                  {new Date(r.arrival_time).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">
                  Expira: {new Date(r.expires_at).toLocaleString()}
                </div>
              </div>

              <div className="col-span-2">
                <span className="text-sm font-semibold text-gray-900">{r.status}</span>
              </div>

              <div className="col-span-3">
                {r.client_checked_in_at ? (
                  <span className="text-sm text-gray-900">
                    {new Date(r.client_checked_in_at).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">Aguardando</span>
                )}
              </div>

              <div className="col-span-2">
                <span className="text-sm text-gray-900">R$ {Number(r.total).toFixed(2)}</span>
              </div>

              <div className="col-span-2 text-right space-x-2">
                <button
                  onClick={() => markArrived(r.id)}
                  disabled={!canArrive}
                  className="rounded-xl bg-sun text-white font-semibold px-3 py-2 text-sm disabled:opacity-50"
                  title={!r.client_checked_in_at ? "Cliente ainda não fez check-in" : ""}
                >
                  ARRIVED
                </button>

                <button
                  onClick={() => markNoShow(r.id)}
                  disabled={!canNoShow}
                  className="rounded-xl bg-gray-100 text-gray-800 px-3 py-2 text-sm hover:bg-gray-200 disabled:opacity-50"
                >
                  NO_SHOW
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!vendorId ? (
        <div className="text-xs text-gray-500">Sem vendor vinculado.</div>
      ) : null}
    </div>
  );
}
