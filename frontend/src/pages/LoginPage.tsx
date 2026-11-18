import { Navigate, useSearchParams } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function LoginPage() {
  const { authState } = useApp();
  const [params] = useSearchParams();
  if (authState === "in") return <Navigate to="/" replace />;

  const login = () => {
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-j-main text-j-text">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          <div className="h-12 w-12 rounded-2xl bg-j-accent grid place-items-center mb-8">
            <MessageSquare className="h-6 w-6 text-black" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to J.A.R.V.I.S.</h1>
          <p className="mt-3 text-j-muted text-sm leading-relaxed">
            Your personal assistant for conversations, voice, people and everything you want remembered.
          </p>
          {params.get("error") && (
            <p className="mt-6 text-sm text-red-500">Sign-in failed. Please try again.</p>
          )}
          <button
            onClick={login}
            className="mt-10 w-full h-12 rounded-full border border-j-border bg-j-main hover:bg-j-hover transition-colors flex items-center justify-center gap-3 font-medium"
          >
            <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-j-muted pb-6">By continuing you agree to the J.A.R.V.I.S. terms of use.</p>
    </div>
  );
}
