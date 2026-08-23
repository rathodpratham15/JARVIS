import React, { useState, useEffect } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { login, loginWithGoogle, fetchAuthConfig, AuthConfig } from "../utils/auth";

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthConfig().then(setConfig);
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result.ok) {
      onLoginSuccess();
    } else {
      setError(result.error ?? "Login failed");
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
            <h1 className="font-serif text-2xl font-bold text-[#1a1a1a] mt-1">Sign In</h1>
            <p className="text-xs text-[#555] font-sans mt-0.5">
              Authenticate to access your JARVIS instance
            </p>
          </div>

          <div className="border-b border-[#1a1a1a]" />

          {/* Google OAuth button */}
          {config?.google_enabled && (
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

              {config.password_enabled && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-[#1a1a1a]/20" />
                  <span className="font-mono text-[10px] text-[#555]">OR</span>
                  <div className="flex-1 border-t border-[#1a1a1a]/20" />
                </div>
              )}
            </div>
          )}

          {/* Password login — shown when Google is not configured, or as fallback */}
          {(!config || config.password_enabled || !config.google_enabled) && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="label-secondary">USERNAME</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="editorial-input"
                  placeholder="admin"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="label-secondary">PASSWORD</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="editorial-input pr-10"
                    placeholder="••••••••"
                    autoComplete="current-password"
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
                  <span className="font-mono text-xs">AUTHENTICATING…</span>
                ) : (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>AUTHENTICATE</span>
                  </>
                )}
              </button>
            </form>
          )}

          {error && (
            <p className="font-mono text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2">
              {error}
            </p>
          )}

          {loading && !error && (
            <p className="font-mono text-[10px] text-[#555] text-center animate-pulse">
              Verifying…
            </p>
          )}
        </div>

        <p className="font-mono text-[10px] text-[#555] text-center">
          {config?.google_enabled
            ? "Access restricted to authorised Google accounts"
            : "Set JARVIS_AUTH_ENABLED=true in .env to enable auth"}
        </p>
      </div>
    </div>
  );
};
