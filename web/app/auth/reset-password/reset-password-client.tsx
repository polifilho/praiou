"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // seu client do painel
import { useRouter, useSearchParams } from "next/navigation";

type Phase = "loading" | "ready" | "error" | "success";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<Phase>("loading");
  const [err, setErr] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [saving, setSaving] = useState(false);

  const code = useMemo(() => searchParams.get("code"), [searchParams]);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      setErr(null);
      setPhase("loading");

      try {
        // ✅ 1) Caso PKCE (mais comum): vem ?code=XXXX
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!alive) return;
          setPhase("ready");
          return;
        }

        // ✅ 2) Fallback: se vier tokens no hash (#access_token=...&refresh_token=...)
        if (typeof window !== "undefined" && window.location.hash) {
          const hash = window.location.hash.replace("#", "");
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            if (!alive) return;
            setPhase("ready");
            return;
          }
        }

        // ✅ 3) Se não tem code nem tokens, tenta ver se já existe sessão (ex: o usuário abriu o link no mesmo browser)
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setPhase("ready");
          return;
        }

        setPhase("error");
        setErr("Link inválido ou expirado. Solicite um novo e-mail de redefinição.");
      } catch (e: any) {
        setPhase("error");
        setErr(e?.message ?? "Falha ao validar link. Tente novamente.");
      }
    }

    bootstrap();

    return () => {
      alive = false;
    };
  }, [code]);

  async function onSubmit() {
    setErr(null);

    if (password.length < 6) {
      setErr("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setErr("As senhas não conferem.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setPhase("success");

      // opcional: encerra a sessão temporária do reset
      await supabase.auth.signOut();

      // manda para login do painel
      setTimeout(() => router.replace("/login"), 800);
    } catch (e: any) {
      setErr(e?.message ?? "Erro ao atualizar senha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-100 shadow-sm p-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Redefinir senha</h1>
          <p className="text-sm text-gray-600 mt-1">
            Defina uma nova senha para sua conta do painel.
          </p>
        </div>

        {phase === "loading" && (
          <div className="text-sm text-gray-600">Validando link…</div>
        )}

        {phase === "error" && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">
            {err}
          </div>
        )}

        {phase === "ready" && (
          <>
            {err && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl mb-3">
                {err}
              </div>
            )}

            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Nova senha
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mín. 6 caracteres"
            />

            <label className="block text-sm font-semibold text-gray-800 mb-1 mt-3">
              Confirmar nova senha
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-200"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="repita a senha"
            />

            <button
              onClick={onSubmit}
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-orange-400 hover:bg-orange-500 text-white font-semibold py-3 disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Atualizar senha"}
            </button>

            <button
              onClick={() => router.replace("/login")}
              className="mt-3 w-full text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              Voltar para login
            </button>
          </>
        )}

        {phase === "success" && (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
            Senha atualizada com sucesso! Redirecionando…
          </div>
        )}
      </div>
    </div>
  );
}
