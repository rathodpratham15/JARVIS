import React, { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { login, signup, loginWithGoogle, fetchAuthConfig, AuthConfig } from "../utils/auth";

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthConfig().then(setConfig);
  }, []);

  const resetForm = () => { setUsername(""); setEmail(""); setPassword(""); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = mode === "login"
      ? await login(username.trim(), password)
      : await signup(username.trim(), email.trim(), password);
    setLoading(false);
    if (result.ok) {
      onLoginSuccess();
    } else {
      setError(result.error ?? (mode === "login" ? "Login failed" : "Signup failed"));
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) { setError("Google sign-in failed"); return; }
    setLoading(true);
    setError(null);
    const result = await loginWithGoogle(credentialResponse.credential);
    setLoading(false);
    if (result.ok) {
      onLoginSuccess();
    } else {
      setError(result.error ?? "Google sign-in failed");
    }
  };

  const isLogin = mode === "login";

  return (
    <div className="min-h-screen bg-[#F2F2EF] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-3 h-3 bg-[#00E5FF] border border-[#1a1a1a] animate-pulse" />
            <span className="font-mono font-bold text-xl tracking-widest text-[#1a1a1a] uppercase">
              J.A.R.V.I.S.
            </span>
          </div>
          <p className="font-mono text-[11px] text-[#555] uppercase tracking-widest">
            Personal AI Operating System
          </p>
        </div>

        {/* Card */}
        <div className="editorial-panel space-y-6">
          <div>
            <div className="overline-cyan">// ACCESS CONTROL</div>
            <h1 className="font-serif text-2xl font-bold text-[#1a1a1a] mt-1">
              {isLogin ? "Sign In" : "Create Account"}
            </h1>
            <p className="text-xs text-[#555] font-sans mt-0.5">
              {isLogin ? "Authenticate to access your JARVIS instance" : "Register a new account"}
            </p>
          </div>

          <div className="border-b border-[#1a1a1a]" />

          {/* Google OAuth button — login only */}
          {isLogin && config?.google_enabled && (
            <div className="space-y-3">
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-in failed")}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-[#1a1a1a]/20" />
                <span className="font-mono text-[10px] text-[#555]">OR</span>
                <div className="flex-1 border-t border-[#1a1a1a]/20" />
              </div>
            </div>
          )}

          {/* Username / password / email form */}
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
                <label className="label-secondary">EMAIL <span className="text-[#888]">(optional)</span></label>
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#1a1a1a] transition"
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
            <p className="font-mono text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2">
              {error}
            </p>
          )}

          {/* Toggle between login / signup */}
          <div className="text-center">
            <button
              onClick={() => { setMode(isLogin ? "signup" : "login"); resetForm(); }}
              className="font-mono text-[11px] text-[#555] hover:text-[#1a1a1a] underline underline-offset-2 transition"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="font-mono text-[10px] text-[#555] text-center">
          {config?.google_enabled
            ? "Sign in with Google or use username/password"
            : "Set JARVIS_AUTH_ENABLED=true in .env to enable auth"}
        </p>
      </div>
    </div>
  );
};
