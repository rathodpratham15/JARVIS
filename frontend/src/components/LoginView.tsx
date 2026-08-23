import React, { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { login } from "../utils/auth";

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
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
              Enter your credentials to access JARVIS
            </p>
          </div>

          <div className="border-b border-[#1a1a1a]" />

          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && (
              <p className="font-mono text-xs text-red-600 border border-red-300 bg-red-50 px-3 py-2">
                {error}
              </p>
            )}

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

          <p className="font-mono text-[10px] text-[#555] text-center">
            Default credentials set via <code className="bg-[#EBEBEA] px-1">JARVIS_ADMIN_PASSWORD</code> in <code className="bg-[#EBEBEA] px-1">.env</code>
          </p>
        </div>
      </div>
    </div>
  );
};
