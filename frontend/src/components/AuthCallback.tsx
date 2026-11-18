import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signIn } = useApp();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const sessionId = new URLSearchParams(location.hash.slice(1)).get("session_id");
    api.post("/auth/session", {}, { headers: { "X-Session-ID": sessionId } })
      .then(({ data }) => { signIn(data); navigate("/", { replace: true }); })
      .catch(() => navigate("/login?error=1", { replace: true }));
  }, [location.hash, navigate, signIn]);

  return <div className="h-full bg-j-main" data-testid="auth-callback" />;
}
