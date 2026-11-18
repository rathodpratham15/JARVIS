import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { api, errMsg } from "@/lib/api";

interface AuthConfig {
  google_enabled: boolean;
  microsoft_enabled: boolean;
  saml_enabled: boolean;
}

export default function LoginPage() {
  const { authState, signIn } = useApp();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/auth/config").then(r => setConfig(r.data)).catch(() => setConfig({ google_enabled: false, microsoft_enabled: false, saml_enabled: false }));
  }, []);

  if (authState === "in") return <Navigate to="/chat" replace />;

  const resetForm = () => { setUsername(""); setEmail(""); setPassword(""); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
      const body = mode === "login"
        ? { username: username.trim(), password }
        : { username: username.trim(), email: email.trim(), password };
      const { data } = await api.post(endpoint, body);
      signIn(data);
    } catch (e) {
      setError(errMsg(e, mode === "login" ? "Login failed" : "Signup failed"));
    } finally {
      setLoading(false);
    }
  };

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8001";
  const isLogin = mode === "login";
  const hasSSO = isLogin && (config?.google_enabled || config?.saml_enabled);

  return (
    <div className="min-h-screen bg-[#0d0f12] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-3 h-3 bg-emerald-400 animate-pulse rounded-full" />
            <span className="font-mono font-bold text-xl tracking-widest text-white uppercase">
              J.A.R.V.I.S.
            </span>
          </div>
          <p className="font-mono text-[11px] text-zinc-500 uppercase tracking-widest">
            Personal AI Operating System
          </p>
        </div>

        {/* Card */}
        <div className="editorial-panel space-y-6">
          <div>
            <div className="overline-cyan">// ACCESS CONTROL</div>
            <h1 className="font-serif text-2xl font-bold text-white mt-1">
              {isLogin ? "Sign In" : "Create Account"}
            </h1>
            <p className="text-xs text-zinc-500 font-sans mt-0.5">
              {isLogin ? "Authenticate to access your JARVIS instance" : "Register a new account"}
            </p>
          </div>

          <div className="border-b border-zinc-800" />

          {/* SSO buttons — login only, shown when backend reports them enabled */}
          {hasSSO && (
            <div className="space-y-2">
              {config?.google_enabled && (
                <a
                  href={`${BACKEND_URL}/api/auth/google/login`}
                  className="w-full flex items-center justify-center gap-3 border border-zinc-800 bg-[#111318] px-4 py-2.5 font-sans text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google
                </a>
              )}
              {config?.saml_enabled && (
                <a
                  href={`${BACKEND_URL}/api/auth/saml/login`}
                  className="w-full flex items-center justify-center gap-3 border border-zinc-800 bg-[#111318] px-4 py-2.5 font-sans text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition"
                >
                  <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Sign in with SSO (SAML)
                </a>
              )}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 border-t border-zinc-800" />
                <span className="font-mono text-[10px] text-zinc-500">OR</span>
                <div className="flex-1 border-t border-zinc-800" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="label-secondary">USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="editorial-input"
                placeholder={isLogin ? "admin" : "your_username"}
                autoComplete="username"
                required
              />
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="label-secondary">EMAIL <span className="text-zinc-600">(optional)</span></label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="editorial-input"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="label-secondary">PASSWORD</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="editorial-input pr-10"
                  placeholder="••••••••"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="editorial-btn-primary w-full py-3"
            >
              {loading ? (
                <span className="font-mono text-xs">{isLogin ? "AUTHENTICATING…" : "CREATING ACCOUNT…"}</span>
              ) : (
                <>
                  {isLogin ? <LogIn className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{isLogin ? "AUTHENTICATE" : "CREATE ACCOUNT"}</span>
                </>
              )}
            </button>
          </form>

          {error && (
            <p className="font-mono text-xs text-red-400 border border-red-900 bg-red-900/20 px-3 py-2">
              {error}
            </p>
          )}

          <div className="text-center">
            <button
              onClick={() => { setMode(isLogin ? "signup" : "login"); resetForm(); }}
              className="font-mono text-[11px] text-zinc-500 hover:text-white underline underline-offset-2 transition"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="font-mono text-[10px] text-zinc-600 text-center">
          {config?.google_enabled
            ? "Sign in with Google or use username/password"
            : "Secure access — your data stays on your infrastructure"}
        </p>
      </div>
    </div>
  );
}
