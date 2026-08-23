const TOKEN_KEY = "jarvis_access_token";
const REFRESH_KEY = "jarvis_refresh_token";
const USER_KEY = "jarvis_user";

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeTokens(accessToken: string, refreshToken: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

const API_BASE = (
  typeof import.meta !== "undefined"
    ? ((import.meta as any).env?.VITE_API_BASE ?? "")
    : ""
).replace(/\/$/, "");

let _refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

/**
 * Drop-in replacement for fetch() that:
 * 1. Injects the Bearer token if present
 * 2. On 401, silently refreshes and retries once
 * 3. On second 401, clears tokens and reloads the page so LoginView appears
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const fullUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  const token = getAccessToken();

  const headers = new Headers(init.headers ?? {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    // don't force content-type for FormData — browser sets boundary automatically
  }

  let res = await fetch(fullUrl, { ...init, headers });

  if (res.status === 401) {
    // Deduplicate concurrent refresh attempts
    if (!_refreshPromise) {
      _refreshPromise = refreshAccessToken().finally(() => { _refreshPromise = null; });
    }
    const newToken = await _refreshPromise;
    if (!newToken) {
      // Refresh failed — force re-login
      window.dispatchEvent(new Event("jarvis:unauthenticated"));
      return res;
    }
    headers.set("Authorization", `Bearer ${newToken}`);
    res = await fetch(fullUrl, { ...init, headers });
    if (res.status === 401) {
      clearTokens();
      window.dispatchEvent(new Event("jarvis:unauthenticated"));
    }
  }

  return res;
}

export async function login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Login failed" };
    storeTokens(data.access_token, data.refresh_token, data.user);
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export async function loginWithGoogle(googleIdToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: googleIdToken }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "Google sign-in failed" };
    storeTokens(data.access_token, data.refresh_token, data.user);
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export interface AuthConfig {
  google_enabled: boolean;
  google_client_id: string;
  password_enabled: boolean;
}

export async function fetchAuthConfig(): Promise<AuthConfig> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/config`);
    if (!res.ok) return { google_enabled: false, google_client_id: "", password_enabled: true };
    return await res.json();
  } catch {
    return { google_enabled: false, google_client_id: "", password_enabled: true };
  }
}

export async function logout(apiBase = API_BASE): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    await fetch(`${apiBase}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {}
  clearTokens();
}

/** True if a (possibly expired) access token exists in storage. */
export function isLoggedIn(): boolean {
  return !!getAccessToken();
}
