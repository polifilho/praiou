"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const LOGIN_TS_KEY = "orla_login_ts";
const MAX_SESSION_MS = 24 * 60 * 60 * 1000; // 24h
const CHECK_EVERY_MS = 60 * 1000; // 1 min

function isPublicRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth")
  );
}

function getBaseLoginTs(session: any) {
  // preferência: timestamp do último login real
  const last = session?.user?.last_sign_in_at;
  if (last) return new Date(last).getTime();

  // fallback: se não existir, usa "agora"
  return Date.now();
}

export default function SessionGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function enforce() {
      if (isPublicRoute(pathname)) return;

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session;

      if (!session) {
        router.replace("/login");
        return;
      }

      const now = Date.now();
      const savedRaw = localStorage.getItem(LOGIN_TS_KEY);
      const saved = savedRaw ? Number(savedRaw) : 0;

      // ✅ se não tem saved, salva baseado no last_sign_in_at (não "agora")
      const base = saved || getBaseLoginTs(session);

      if (!saved) {
        localStorage.setItem(LOGIN_TS_KEY, String(base));
      }

      if (now - base > MAX_SESSION_MS) {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } finally {
          localStorage.removeItem(LOGIN_TS_KEY);
          router.replace("/login");
        }
      }
    }

    // roda já
    enforce();

    // ✅ roda periodicamente mesmo sem navegação
    const timer = setInterval(enforce, CHECK_EVERY_MS);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session) {
        localStorage.setItem(LOGIN_TS_KEY, String(Date.now()));
      }

      if (event === "SIGNED_OUT") {
        localStorage.removeItem(LOGIN_TS_KEY);
      }
    });

    return () => {
      mounted = false;
      clearInterval(timer);
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  return null;
}