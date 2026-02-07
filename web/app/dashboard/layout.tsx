"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={[
        "block rounded-xl px-3 py-2 text-sm font-medium",
        active
          ? "bg-orange-400 text-sun ring-1 ring-orange-100"
          : "text-gray-700 hover:bg-gray-50",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
  let mounted = true;

  async function check() {
    // getUser() valida no servidor; getSession() pode ser só cache local
    const { data, error } = await supabase.auth.getUser();

    if (!mounted) return;

    if (error || !data?.user) {
      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }

    setEmail(data.user.email ?? "");
  }

  check();

  const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
    if (!session) router.replace("/login");
  });

  return () => {
    mounted = false;
    sub.subscription.unsubscribe();
  };
}, [router]);


  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-sand">
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
          <aside className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-4">
            <div className="mb-4">
              <div className="text-sm font-semibold text-gray-900">Cadeiras RJ</div>
              <div className="text-xs text-gray-500 truncate">{email}</div>
            </div>

            <nav className="space-y-1">
              <NavItem href="/dashboard" label="Visão geral" />
              <NavItem href="/dashboard/items" label="Itens" />
              <NavItem href="/dashboard/reservations" label="Reservas" />
            </nav>

            <button
              onClick={logout}
              className="mt-6 w-full rounded-xl bg-gray-100 text-gray-800 font-medium py-2 hover:bg-gray-200"
            >
              Sair
            </button>
          </aside>

          <main className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
