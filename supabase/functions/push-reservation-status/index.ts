import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { user_id, status, canceled_by } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data: tokens, error: tErr } = await sb
      .from("user_push_tokens")
      .select("token")
      .eq("user_id", user_id);

    if (tErr) {
      return new Response(JSON.stringify({ ok: false, error: tErr.message }), { status: 500 });
    }

    const to = (tokens ?? []).map((t: any) => t.token).filter(Boolean);

    if (!to.length) {
      return new Response(JSON.stringify({ ok: true, skipped: "no tokens" }), { status: 200 });
    }

    const title = "Atualização da reserva";
    const isUserCancel =
      status === "CANCELED" &&
      (canceled_by === "USER" || canceled_by === "user" || canceled_by === "CLIENT");

    const body =
      status === "CONFIRMED"
        ? "Sua reserva foi aprovada 🎉"
        : status === "CANCELED"
        ? isUserCancel
          ? "Reserva cancelada com sucesso ✅"
          : "Sua reserva não foi aceita."
        : status === "ARRIVED"
        ? "Reserva concluída ✅"
        : `Status atualizado: ${status}`;

    const messages = to.map((token: string) => ({
      to: token,
      sound: "default",
      title,
      body,
      data: { status },
    }));

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });

    const json = await res.json();
    const results = Array.isArray(json?.data) ? json.data : [];
    const errors = results
      .map((r: any, i: number) => ({
        index: i,
        status: r?.status,
        message: r?.message,
        details: r?.details,
      }))
      .filter((r: any) => r.status === "error");

    return new Response(
      JSON.stringify({
        ok: true,
        expo: json,
        summary: {
          total: results.length,
          errors: errors.length,
        },
        errors,
      }),
      { status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { status: 500 });
  }
});
