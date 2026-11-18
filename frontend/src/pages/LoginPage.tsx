import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { api, errMsg } from "@/lib/api";

export default function LoginPage() {
  const { authState, signIn } = useApp();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authState === "in") return <Navigate to="/" replace />;

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

  const isLogin = mode === "login";

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-3 h-3 bg-[#00E5FF] animate-pulse rounded-full shadow-[0_0_8px_#00E5FF]" />
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
            <h1 className="font-mono text-2xl font-bold text-white mt-1">
              {isLogin ? "Sign In" : "Create Account"}
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              {isLogin ? "Authenticate to access your JARVIS instance" : "Register a new account"}
            </p>
          </div>

          <div className="border-b border-zinc-800" />

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
          Secure access — your data stays on your infrastructure
        </p>
      </div>
    </div>
  );
}
