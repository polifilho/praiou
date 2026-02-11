import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  email: string;
  phone?: string;
  full_name?: string;

  vendor_name: string;
  beach_id?: string | null; // se você usa isso
  address?: string | null;
  reference_point?: string | null;
  responsible_name?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const email = (body.email ?? "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email é obrigatório." }, { status: 400 });

    if (!body.vendor_name?.trim()) {
      return NextResponse.json({ error: "Nome da barraca é obrigatório." }, { status: 400 });
    }

    // 1) cria user no Auth
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // você pode setar false se quiser forçar confirmação
      user_metadata: {
        full_name: body.full_name ?? null,
      },
    });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    const userId = created.user.id;

    // 2) cria profile (role vendor)
    const { error: profErr } = await supabaseAdmin
      .from("user_profiles")
      .upsert(
        {
          id: userId,
          full_name: body.full_name ?? null,
          phone: body.phone ?? null,
          role: "vendor",
        },
        { onConflict: "id" }
      );

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 400 });
    }

    // 3) cria vendor vinculado ao user
    const { data: vendorRow, error: vendorErr } = await supabaseAdmin
      .from("vendors")
      .insert({
        name: body.vendor_name,
        owner_user_id: userId,
        beach_id: body.beach_id ?? null,
        address: body.address ?? null,
        reference_point: body.reference_point ?? null,
        responsible_name: body.responsible_name ?? body.full_name ?? null,
        is_active: true,
      })
      .select("id,name,owner_user_id")
      .single();

    if (vendorErr) {
      return NextResponse.json({ error: vendorErr.message }, { status: 400 });
    }

    // 4) gera link para definir senha (recovery)
    // ✅ Recomendo usar sua página web no Vercel:
    // ex: https://dashboard.orlamais.com.br/auth/reset-password
    const redirectTo = process.env.NEXT_PUBLIC_VENDOR_RESET_REDIRECT_TO
      ?? "https://www.orlamais.com.br"; // troque depois pelo seu domínio do dashboard

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 400 });
    }

    const actionLink = linkData.properties?.action_link;

    return NextResponse.json({
      ok: true,
      user_id: userId,
      vendor: vendorRow,
      action_link: actionLink,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
