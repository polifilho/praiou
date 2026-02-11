"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyVendorId } from "@/lib/vendor";
import { useRouter } from "next/navigation";

type ReservationStatus = "PENDING" | "CONFIRMED" | "ARRIVED" | "NO_SHOW" | "CANCELED";

type Reservation = {
  id: string;
  arrival_time: string | null;
  expires_at: string | null;
  status: ReservationStatus;
  total: number;
  client_checked_in_at: string | null;
  confirmation_code: string | null;
  created_at: string;
};

function statusLabel(s: ReservationStatus) {
  if (s === "PENDING") return "Pendente";
  if (s === "CONFIRMED") return "Confirmada";
  if (s === "ARRIVED") return "Chegou";
  if (s === "NO_SHOW") return "Não apareceu";
  if (s === "CANCELED") return "Cancelada";
  return s;
}

function statusClasses(s: ReservationStatus) {
  if (s === "PENDING") return "bg-amber-50 text-amber-800 border-amber-200";
  if (s === "CONFIRMED") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (s === "ARRIVED") return "bg-sky-50 text-sky-800 border-sky-200";
  if (s === "NO_SHOW") return "bg-red-50 text-red-800 border-red-200";
  if (s === "CANCELED") return "bg-red-50 text-red-800 border-red-200";
  return "bg-gray-50 text-gray-800 border-gray-200";
}

function fmt(iso: string | null) {
  if (!iso) return "--";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReservationsPage() {
  const [vendorId, setVendorId] = useState<string>("");
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  // --------------------------
  // Load
  // --------------------------
  async function load(vid?: string) {
    setErr(null);
    setLoading(true);

    try {
      const resolvedVid = vid ?? (await getMyVendorId());
      setVendorId(resolvedVid);

      const { data, error } = await supabase
        .from("reservations")
        .select(
          "id,arrival_time,expires_at,status,total,client_checked_in_at,confirmation_code,created_at"
        )
        .eq("vendor_id", resolvedVid)
        .order("arrival_time", { ascending: true });

      if (error) throw new Error(error.message);
      setRows((data ?? []) as Reservation[]);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // --------------------------
  // Actions (todas aqui dentro)
  // --------------------------
  async function approve(reservationId: string) {
    setErr(null);
    setBusyId(reservationId);

    // ✅ preferir RPC se você já tem approve_reservation
    const { error } = await supabase.rpc("approve_reservation", {
      p_reservation_id: reservationId,
    });

    setBusyId(null);

    if (error) {
      setErr(error.message);
      return;
    }

    await load(vendorId);
  }

  async function rejectPending(reservationId: string) {
    setErr(null);
    setBusyId(reservationId);

    // ✅ rejeitar = cancel + restock
    const { error } = await supabase.rpc("reject_reservation_by_vendor", { p_reservation_id: reservationId });
    // await supabase.rpc("cancel_reservation_and_restock", {
    //   p_reservation_id: reservationId,
    //   p_new_status: "CANCELED",
    // });
    

    setBusyId(null);

    if (error) setErr(error.message);
    else await load(vendorId);
  }

  async function markArrived(reservationId: string) {
    setErr(null);
    setBusyId(reservationId);

    // MVP: marca arrived (ideal é RPC depois)
    const { error } = await supabase
      .from("reservations")
      .update({ status: "ARRIVED" })
      .eq("id", reservationId)
      .eq("status", "CONFIRMED");

    setBusyId(null);

    if (error) setErr(error.message);
    else await load(vendorId);
  }

  async function markNoShow(reservationId: string) {
    setErr(null);
    setBusyId(reservationId);

    const { error } = await supabase.rpc("cancel_reservation_and_restock", {
      p_reservation_id: reservationId,
      p_new_status: "NO_SHOW",
    });

    setBusyId(null);

    if (error) setErr(error.message);
    else await load(vendorId);
  }

  // --------------------------
  // Confirms (agora funcionam)
  // --------------------------
  function confirmApprove(reservationId: string) {
    const ok = window.confirm(
      "Tem certeza que deseja APROVAR esta reserva?\n\nApós aprovada, ela não poderá ser cancelada."
    );
    if (ok) approve(reservationId);
  }

  function confirmReject(reservationId: string) {
    const ok = window.confirm(
      "Deseja REJEITAR esta reserva?\n\nEssa ação não pode ser desfeita."
    );
    if (ok) rejectPending(reservationId);
  }

  function confirmNoShow(reservationId: string) {
    const ok = window.confirm(
      "Confirmar NO SHOW?\n\nO cliente perderá a reserva e o estoque será devolvido."
    );
    if (ok) markNoShow(reservationId);
  }

  // --------------------------
  // Realtime
  // --------------------------
  useEffect(() => {
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let active = true;

  (async () => {
    try {
      const vid = await getMyVendorId();
      if (!active) return;

      setVendorId(vid);
      await load(vid);

      channel = supabase
        .channel(`vendor-reservations-${vid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "reservations",
            filter: `vendor_id=eq.${vid}`,
          },
          async () => {
            await load(vid);
          }
        )
        .subscribe();
    } catch (e: any) {
      const msg = e?.message ?? "Erro";

      if (msg === "SEM_SESSAO") {
        router.replace("/login"); // ✅ manda pro login do painel
        return;
      }

      setErr(msg);
      setLoading(false);
    }
  })();

  return () => {
    active = false;
    if (channel) supabase.removeChannel(channel);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === "PENDING").length,
    [rows]
  );

  if (loading) return <div className="text-gray-600">Carregando...</div>;

  async function checkinByPin(reservationId: string) {
    setErr(null);
    setBusyId(reservationId);

    const r = rows.find((x) => x.id === reservationId);
    if (!r) {
      setBusyId(null);
      setErr("Reserva não encontrada.");
      return;
    }

    const entered = window.prompt("Digite o PIN que o cliente informou:");
    if (!entered) {
      setBusyId(null);
      return;
    }

    const pin = entered.trim();
    const expected = String(r.confirmation_code ?? "").trim();

    if (!expected) {
      setBusyId(null);
      setErr("Esta reserva ainda não possui PIN (provável erro na aprovação).");
      return;
    }

    if (pin !== expected) {
      setBusyId(null);
      window.alert("PIN inválido. Verifique e tente novamente.");
      return;
    }

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "ARRIVED",
        client_checked_in_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .eq("status", "CONFIRMED");

    setBusyId(null);

    if (error) setErr(error.message);
    else await load(vendorId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
          <p className="text-gray-600 mt-1">
            Aprove ou rejeite pedidos pendentes. Após aprovar, aparece o PIN no app do cliente.
          </p>
        </div>

        <div className="text-sm text-gray-600">
          Pendentes:{" "}
          <span className="font-semibold text-gray-900">{pendingCount}</span>
        </div>
      </div>

      {err && <div className="text-red-700 bg-red-50 p-3 rounded-xl">{err}</div>}

      <div className="rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold text-gray-600 px-4 py-3">
          <div className="col-span-3">Chegada</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">PIN</div>
          <div className="col-span-2">Total</div>
          <div className="col-span-1">Check-in</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-sm text-gray-500">
            Nenhuma reserva ainda.
          </div>
        ) : null}

        {rows.map((r) => {
          const isBusy = busyId === r.id;

          // NO_SHOW só após expirar
          const expired = !!r.expires_at && Date.now() > new Date(r.expires_at).getTime();
          const showApprove = r.status === "PENDING";
          const showReject = r.status === "PENDING";
          const showCheckin = r.status === "CONFIRMED";
          const canNoShow = r.status === "CONFIRMED" && expired && !r.client_checked_in_at;
          const showArrived = r.status === "ARRIVED";

          return (
            <div
              key={r.id}
              className="grid grid-cols-12 px-4 py-3 border-t border-gray-100 items-center"
            >
              <div className="col-span-3">
                <div className="font-medium text-gray-900">
                  {fmt(r.arrival_time)}
                </div>
                <div className="text-xs text-gray-500">
                  Expira: {fmt(r.expires_at)}
                </div>
              </div>

              <div className="col-span-2">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusClasses(
                    r.status
                  )}`}
                >
                  {statusLabel(r.status)}
                </span>
              </div>

              <div className="col-span-2">
                {r.status === "ARRIVED" && r.confirmation_code ? (
                  <span className="text-sm font-semibold text-gray-900">
                    {r.confirmation_code}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">--</span>
                )}
              </div>

              <div className="col-span-2">
                <span className="text-sm text-gray-900">
                  R$ {Number(r.total ?? 0).toFixed(2)}
                </span>
              </div>

              <div className="col-span-1">
                {r.client_checked_in_at ? (
                  <span className="text-xs text-gray-900">OK</span>
                ) : (
                  <span className="text-xs text-gray-400">--</span>
                )}
              </div>

              {/* ✅ Botões em coluna + confirmação */}
              <div className="col-span-2">
                <div className="flex flex-col gap-2 items-end">
                  {showApprove && (
                    <button
                      onClick={() => confirmApprove(r.id)}
                      disabled={isBusy}
                      className="w-28 rounded-lg bg-orange-400 text-white font-semibold px-3 py-2 text-xs hover:bg-orange-500 disabled:opacity-50"
                    >
                      {isBusy ? "..." : "Aprovar"}
                    </button>
                  )}

                  {showReject && (
                    <button
                      onClick={() => confirmReject(r.id)}
                      disabled={isBusy}
                      className="w-28 rounded-lg bg-red-50 text-red-700 font-semibold px-3 py-2 text-xs border border-red-200 hover:bg-red-100 disabled:opacity-50"
                    >
                      Rejeitar
                    </button>
                  )}

                  {/* ✅ Check-in por PIN (aparece quando CONFIRMED) */}
                  {showCheckin && (
                    <button
                      onClick={() => checkinByPin(r.id)}
                      disabled={isBusy}
                      className="w-28 rounded-lg bg-emerald-500 text-white font-semibold px-3 py-2 text-xs hover:bg-emerald-600 disabled:opacity-50"
                    >
                      Check-in
                    </button>
                  )}

                  {r.status === "CONFIRMED" && (
                    <button
                      onClick={() => confirmNoShow(r.id)}
                      disabled={isBusy || !canNoShow}
                      className="w-28 rounded-lg bg-gray-100 text-gray-700 font-semibold px-3 py-2 text-xs hover:bg-gray-200 disabled:opacity-50"
                      title={!canNoShow ? "Disponível após expirar" : ""}
                    >
                      Cliente faltou
                    </button>
                  )}

                  {showArrived && (
                    <button
                      disabled
                      className="w-28 rounded-lg bg-sky-50 text-sky-800 font-semibold px-3 py-2 text-xs border border-sky-200 opacity-80 cursor-default"
                    >
                      Concluída
                    </button>
                  )}
                </div>
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
