"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) return setErr(error.message);
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Painel do Barraqueiro</h1>
          <p className="text-gray-600 mt-1">Entre para gerenciar sua barraca.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-sun"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendedor@teste.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Senha</label>
            <input
              type="password"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-sun"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {err && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sun text-white font-semibold py-3 hover:opacity-95 active:opacity-90 disabled:opacity-60 bg-orange-400"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Dica: use o login de teste que você criou no Supabase.
          </p>
        </form>
      </div>
    </div>
  );
}
