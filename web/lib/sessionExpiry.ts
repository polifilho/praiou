// web/lib/sessionExpiry.ts
export const LOGIN_AT_KEY = "orla_login_at";
export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export function setLoginNow() {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
}

export function clearLoginAt() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LOGIN_AT_KEY);
}

export function isExpired() {
  if (typeof window === "undefined") return false;
  const v = localStorage.getItem(LOGIN_AT_KEY);
  if (!v) return false; // se não tem, não expira aqui (fica a cargo do guard/sessão)
  const loginAt = Number(v);
  if (!Number.isFinite(loginAt)) return false;
  return Date.now() - loginAt > SESSION_MAX_AGE_MS;
}
