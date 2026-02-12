"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyVendorId } from "@/lib/vendor";
import { useRouter } from "next/navigation";

type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ARRIVED"
  | "NO_SHOW"
  | "CANCELED";

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

type ReservationItemRow = {
  reservation_id: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  vendor_items?: { name: string | null } | null;
};

type ReservationItemView = {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type TabKey = "current" | "old";

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
  if (s === "CONFIRMED")
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
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

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------- Helpers de data no fuso BR ----------
function nowInBR(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
}
function startOfDayBR(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function atBR(day: Date, hh: number, mm: number): Date {
  const x = new Date(day);
  x.setHours(hh, mm, 0, 0);
  return x;
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const OPEN_H = 7;

export default function ReservationsPage() {
  const [vendorId, setVendorId] = useState<string>("");
  const [rows, setRows] = useState<Reservation[]>([]);
  const [itemsByReservation, setItemsByReservation] = useState<
    Record<string, ReservationItemView[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("current");
  const router = useRouter();

  async function load(vid?: string, whichTab?: TabKey) {
    setErr(null);
    setLoading(true);

    const activeTab = whichTab ?? tab;

    try {
      const resolvedVid = vid ?? (await getMyVendorId());
      setVendorId(resolvedVid);

      const base = supabase
        .from("reservations")
        .select(
          "id,arrival_time,expires_at,status,total,client_checked_in_at,confirmation_code,created_at"
        )
        .eq("vendor_id", resolvedVid);

      const nowBR = nowInBR();
      const today0 = startOfDayBR(nowBR);
      const afterTomorrow0 = startOfDayBR(addDays(today0, 2));

      const todayStartIso = today0.toISOString();
      const afterTomorrowStartIso = afterTomorrow0.toISOString();

      const q =
        activeTab === "current"
          ? base
              .gte("arrival_time", todayStartIso)
              .lt("arrival_time", afterTomorrowStartIso) // hoje + amanhã
              .order("arrival_time", { ascending: true })
          : base
              .or(`arrival_time.lt.${todayStartIso},arrival_time.is.null`)
              .order("arrival_time", { ascending: false });

      const { data, error } = await q;
      if (error) throw new Error(error.message);

      const reservations = (data ?? []) as Reservation[];
      setRows(reservations);

      const ids = reservations.map((r) => r.id);
      if (!ids.length) {
        setItemsByReservation({});
        return;
      }

      const { data: riData, error: riErr } = await supabase
        .from("reservation_items")
        .select("reservation_id,item_id,quantity,unit_price,vendor_items(name)")
        .in("reservation_id", ids);

      if (riErr) {
        console.log("load reservation_items error:", riErr.message);
        setItemsByReservation({});
        return;
      }

      const grouped: Record<string, ReservationItemView[]> = {};
      (riData ?? []).forEach((row: any) => {
        const r = row as ReservationItemRow;
        const name = r.vendor_items?.name?.trim()
          ? String(r.vendor_items.name)
          : `Item ${String(r.item_id).slice(0, 6)}`;

        const quantity = Number(r.quantity ?? 0);
        const unit_price = Number(r.unit_price ?? 0);
        const line_total = quantity * unit_price;

        const v: ReservationItemView = {
          item_id: r.item_id,
          name,
          quantity,
          unit_price,
          line_total,
        };

        if (!grouped[r.reservation_id]) grouped[r.reservation_id] = [];
        grouped[r.reservation_id].push(v);
      });

      setItemsByReservation(grouped);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao carregar");
      setRows([]);
      setItemsByReservation({});
    } finally {
      setLoading(false);
    }
  }

  async function approve(reservationId: string) {
    setErr(null);
    setBusyId(reservationId);

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

    const { error } = await supabase.rpc("reject_reservation_by_vendor", {
      p_reservation_id: reservationId,
    });

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

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    (async () => {
      try {
        const vid = await getMyVendorId();
        if (!active) return;

        setVendorId(vid);
        await load(vid, tab);

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
              await load(vid, tab);
            }
          )
          .subscribe();
      } catch (e: any) {
        const msg = e?.message ?? "Erro";
        if (msg === "SEM_SESSAO") {
          router.replace("/login");
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

  useEffect(() => {
    if (!vendorId) return;
    load(vendorId, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, vendorId]);

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

  // ====== COMPONENTE DE ITENS (reaproveita no desktop e mobile) ======
  function ItemsBox({ reservationId }: { reservationId: string }) {
    const ris = itemsByReservation[reservationId] ?? [];
    const itemsTotal = ris.reduce((sum, it) => sum + it.line_total, 0);

    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-700">Itens reservados</div>
          <div className="text-xs font-semibold text-gray-900">
            {ris.length ? money(itemsTotal) : "--"}
          </div>
        </div>

        {!ris.length ? (
          <div className="text-xs text-gray-500 mt-2">--</div>
        ) : (
          <div className="mt-2 space-y-2">
            {ris.map((it) => (
              <div
                key={`${reservationId}-${it.item_id}`}
                className="flex items-center justify-between text-sm"
              >
                <div className="text-gray-800">
                  <span className="font-semibold">{it.quantity}x</span> {it.name}
                </div>
                <div className="text-gray-900 font-semibold">
                  {money(it.line_total)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
          <p className="text-gray-600 mt-1">
            Atuais mostram hoje + amanhã. Aprovar/Rejeitar só no dia da reserva (a partir de 07h).
          </p>
        </div>

        <div className="text-sm text-gray-600 whitespace-nowrap">
          Pendentes:{" "}
          <span className="font-semibold text-gray-900">{pendingCount}</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTab("current")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
            tab === "current"
              ? "bg-orange-400 text-white border-orange-400"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          }`}
        >
          Atuais (hoje + amanhã)
        </button>

        <button
          onClick={() => setTab("old")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
            tab === "old"
              ? "bg-orange-400 text-white border-orange-400"
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
          }`}
        >
          Antigas
        </button>
      </div>

      {err && <div className="text-red-700 bg-red-50 p-3 rounded-xl">{err}</div>}

      {/* =========================
          MOBILE (<768px) - CARDS
         ========================= */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-sm text-gray-500 rounded-2xl border border-gray-100">
            {tab === "current"
              ? "Nenhuma reserva atual (hoje/amanhã)."
              : "Nenhuma reserva antiga."}
          </div>
        ) : null}

        {rows.map((r) => {
          const isBusy = busyId === r.id;
          const expired = !!r.expires_at && Date.now() > new Date(r.expires_at).getTime();

          const showApprove = r.status === "PENDING";
          const showReject = r.status === "PENDING";
          const showCheckin = r.status === "CONFIRMED";
          const canNoShow = r.status === "CONFIRMED" && expired && !r.client_checked_in_at;
          const showArrived = r.status === "ARRIVED";

          // ====== BLOQUEIO PARA AMANHÃ ATÉ 07h (BR) ======
          const nowBR = nowInBR();
          const arrival = r.arrival_time ? new Date(r.arrival_time) : null;
          const arrivalBR = arrival
            ? new Date(arrival.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
            : null;

          const todayBR0 = startOfDayBR(nowBR);
          const tomorrowBR0 = startOfDayBR(addDays(todayBR0, 1));

          const isForToday = arrivalBR ? isSameDay(startOfDayBR(arrivalBR), todayBR0) : false;
          const isForTomorrow = arrivalBR ? isSameDay(startOfDayBR(arrivalBR), tomorrowBR0) : false;

          const allowApproveReject = isForToday && nowBR >= atBR(todayBR0, OPEN_H, 0);
          const approveRejectTooltip = isForTomorrow
            ? "Permitido somente amanhã a partir das 07h"
            : "Permitido somente a partir de 07h no dia da reserva";

          return (
            <div key={r.id} className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Chegada: {fmt(r.arrival_time)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Expira: {fmt(r.expires_at)}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${statusClasses(
                      r.status
                    )}`}
                  >
                    {statusLabel(r.status)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">Total</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {money(Number(r.total ?? 0))}
                  </div>
                </div>

                {/* Itens */}
                <ItemsBox reservationId={r.id} />

                {/* Ações em linha (mobile friendly) */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {showApprove && (
                    <button
                      onClick={() => (allowApproveReject ? confirmApprove(r.id) : null)}
                      disabled={isBusy || !allowApproveReject}
                      title={!allowApproveReject ? approveRejectTooltip : ""}
                      className={`flex-1 min-w-[120px] rounded-xl font-semibold px-3 py-3 text-sm disabled:opacity-50 ${
                        allowApproveReject
                          ? "bg-orange-400 text-white hover:bg-orange-500"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {isBusy ? "..." : "Aprovar"}
                    </button>
                  )}

                  {showReject && (
                    <button
                      onClick={() => (allowApproveReject ? confirmReject(r.id) : null)}
                      disabled={isBusy || !allowApproveReject}
                      title={!allowApproveReject ? approveRejectTooltip : ""}
                      className={`flex-1 min-w-[120px] rounded-xl font-semibold px-3 py-3 text-sm border disabled:opacity-50 ${
                        allowApproveReject
                          ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      Rejeitar
                    </button>
                  )}

                  {showCheckin && (
                    <button
                      onClick={() => checkinByPin(r.id)}
                      disabled={isBusy}
                      className="flex-1 min-w-[120px] rounded-xl bg-emerald-500 text-white font-semibold px-3 py-3 text-sm hover:bg-emerald-600 disabled:opacity-50"
                    >
                      Check-in
                    </button>
                  )}

                  {r.status === "CONFIRMED" && (
                    <button
                      onClick={() => confirmNoShow(r.id)}
                      disabled={isBusy || !canNoShow}
                      title={!canNoShow ? "Disponível após expirar" : ""}
                      className="flex-1 min-w-[120px] rounded-xl bg-gray-100 text-gray-700 font-semibold px-3 py-3 text-sm hover:bg-gray-200 disabled:opacity-50"
                    >
                      Cliente faltou
                    </button>
                  )}

                  {showArrived && (
                    <button
                      disabled
                      className="flex-1 min-w-[120px] rounded-xl bg-sky-50 text-sky-800 font-semibold px-3 py-3 text-sm border border-sky-200 opacity-80 cursor-default"
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

      {/* =========================
          DESKTOP (>=768px) - TABELA (igual ao seu)
         ========================= */}
      <div className="hidden md:block rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-12 bg-gray-50 text-xs font-semibold text-gray-600 px-4 py-3">
          <div className="col-span-3">Chegada</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">PIN</div>
          <div className="col-span-3">Total</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-sm text-gray-500">
            {tab === "current"
              ? "Nenhuma reserva atual (hoje/amanhã)."
              : "Nenhuma reserva antiga."}
          </div>
        ) : null}

        {rows.map((r) => {
          const isBusy = busyId === r.id;

          const expired = !!r.expires_at && Date.now() > new Date(r.expires_at).getTime();
          const showApprove = r.status === "PENDING";
          const showReject = r.status === "PENDING";
          const showCheckin = r.status === "CONFIRMED";
          const canNoShow = r.status === "CONFIRMED" && expired && !r.client_checked_in_at;
          const showArrived = r.status === "ARRIVED";

          // ====== BLOQUEIO PARA AMANHÃ ATÉ 07h (BR) ======
          const nowBR = nowInBR();
          const arrival = r.arrival_time ? new Date(r.arrival_time) : null;
          const arrivalBR = arrival
            ? new Date(arrival.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
            : null;

          const todayBR0 = startOfDayBR(nowBR);
          const tomorrowBR0 = startOfDayBR(addDays(todayBR0, 1));

          const isForToday = arrivalBR ? isSameDay(startOfDayBR(arrivalBR), todayBR0) : false;
          const isForTomorrow = arrivalBR ? isSameDay(startOfDayBR(arrivalBR), tomorrowBR0) : false;

          const allowApproveReject = isForToday && nowBR >= atBR(todayBR0, OPEN_H, 0);
          const approveRejectTooltip = isForTomorrow
            ? "Permitido somente amanhã a partir das 07h"
            : "Permitido somente a partir de 07h no dia da reserva";

          return (
            <div key={r.id} className="border-t border-gray-100 bg-gray-200 mb-4">
              <div className="grid grid-cols-12 px-4 py-3 items-center">
                <div className="col-span-3">
                  <div className="font-medium text-gray-900">{fmt(r.arrival_time)}</div>
                  <div className="text-xs text-gray-500">Expira: {fmt(r.expires_at)}</div>
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
                    <span className="text-sm font-semibold text-gray-900">{r.confirmation_code}</span>
                  ) : (
                    <span className="text-sm text-gray-400">--</span>
                  )}
                </div>

                <div className="col-span-3">
                  <span className="text-sm text-gray-900">{money(Number(r.total ?? 0))}</span>
                </div>

                <div className="col-span-2">
                  <div className="flex flex-col gap-2 items-end">
                    {showApprove && (
                      <button
                        onClick={() => (allowApproveReject ? confirmApprove(r.id) : null)}
                        disabled={isBusy || !allowApproveReject}
                        title={!allowApproveReject ? approveRejectTooltip : ""}
                        className={`w-28 rounded-lg font-semibold px-3 py-2 text-xs disabled:opacity-50 ${
                          allowApproveReject
                            ? "bg-orange-400 text-white hover:bg-orange-500"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {isBusy ? "..." : "Aprovar"}
                      </button>
                    )}

                    {showReject && (
                      <button
                        onClick={() => (allowApproveReject ? confirmReject(r.id) : null)}
                        disabled={isBusy || !allowApproveReject}
                        title={!allowApproveReject ? approveRejectTooltip : ""}
                        className={`w-28 rounded-lg font-semibold px-3 py-2 text-xs border disabled:opacity-50 ${
                          allowApproveReject
                            ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        }`}
                      >
                        Rejeitar
                      </button>
                    )}

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

              <div className="px-4 pb-4">
                <ItemsBox reservationId={r.id} />
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
