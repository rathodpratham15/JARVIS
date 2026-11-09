import React, { useRef, useState, useCallback, useEffect } from "react";
import { Camera, ScanLine, User, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { API_BASE } from "../utils/api";

type ScanState = "idle" | "capturing" | "scanning" | "result" | "error";

interface ScanResult {
  matched: boolean;
  name?: string;
  confidence?: number;
  profession?: string;
  age?: number;
  image_url?: string;
  error?: string;
}

export const ScannerPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const eventName = params.get("event") ?? "";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [scanState, setScanState] = useState<ScanState>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [camError, setCamError] = useState("");

  // Verify token is usable by pinging health (scanner tokens can't hit /api/auth/me
  // so we just check it isn't obviously missing/malformed)
  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    // Decode exp from JWT payload (no verification — backend enforces)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expired = payload.exp && payload.exp * 1000 < Date.now();
      setTokenValid(!expired && payload.scope === "identify");
    } catch {
      setTokenValid(false);
    }
  }, [token]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanState("capturing");
      setCamError("");
    } catch {
      setCamError("Camera access denied. Please allow camera access and try again.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);

    setScanState("scanning");

    canvas.toBlob(async (blob) => {
      if (!blob) { setScanState("error"); setResult({ matched: false, error: "Failed to capture image" }); return; }

      const form = new FormData();
      form.append("image", blob, "scan.jpg");

      try {
        const res = await fetch(`${API_BASE}/api/face/identify`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await res.json();

        if (!res.ok) {
          setResult({ matched: false, error: data.error ?? "Scan failed" });
          setScanState("error");
          return;
        }

        setResult({
          matched: data.matched ?? false,
          name: data.name,
          confidence: data.confidence,
          profession: data.profession,
          age: data.age,
          image_url: data.image_url,
        });
        setScanState("result");
      } catch {
        setResult({ matched: false, error: "Network error — check your connection" });
        setScanState("error");
      }
    }, "image/jpeg", 0.92);
  }, [token]);

  const reset = useCallback(() => {
    setResult(null);
    setScanState("capturing");
  }, []);

  // ── invalid / expired token ───────────────────────────────────────────────
  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6 p-6 font-mono">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <div className="text-center space-y-2">
          <p className="text-white font-black text-xl">SCANNER TOKEN INVALID</p>
          <p className="text-zinc-500 text-sm">{!token ? "No token provided in URL." : "This token has expired or is not a scanner token."}</p>
          <p className="text-zinc-600 text-xs">Contact the event organizer for a valid scan link.</p>
        </div>
      </div>
    );
  }

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono text-cyan-400 text-sm">
        VERIFYING TOKEN…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">J.A.R.V.I.S.</p>
          <p className="text-white font-black text-sm tracking-wider">VISION SCANNER</p>
        </div>
        {eventName && (
          <span className="text-[10px] font-mono font-black px-3 py-1 border border-cyan-800 text-cyan-400">
            {eventName.toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">

        {/* Idle — start camera */}
        {scanState === "idle" && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-32 h-32 rounded-full border border-cyan-500/30 flex items-center justify-center">
              <Camera className="w-12 h-12 text-cyan-400" />
            </div>
            <div className="space-y-1">
              <p className="text-white font-black text-lg">READY TO SCAN</p>
              <p className="text-zinc-500 text-xs">Point the camera at a person's face to identify them</p>
            </div>
            {camError && <p className="text-red-400 text-xs text-center max-w-xs">{camError}</p>}
            <button
              onClick={startCamera}
              className="px-8 py-3 bg-cyan-500 text-black font-black text-sm tracking-wider hover:bg-cyan-400 transition"
            >
              START CAMERA
            </button>
          </div>
        )}

        {/* Camera live view */}
        {(scanState === "capturing" || scanState === "scanning") && (
          <div className="w-full max-w-sm flex flex-col items-center gap-4">
            <div className="relative w-full aspect-[3/4] bg-zinc-900 overflow-hidden border border-zinc-700">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {/* Scan overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-56 border-2 border-cyan-500/70 relative">
                  <span className="absolute -top-px -left-px w-6 h-6 border-t-2 border-l-2 border-cyan-400" />
                  <span className="absolute -top-px -right-px w-6 h-6 border-t-2 border-r-2 border-cyan-400" />
                  <span className="absolute -bottom-px -left-px w-6 h-6 border-b-2 border-l-2 border-cyan-400" />
                  <span className="absolute -bottom-px -right-px w-6 h-6 border-b-2 border-r-2 border-cyan-400" />
                  {scanState === "scanning" && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-400 animate-bounce" />
                  )}
                </div>
              </div>
              {scanState === "scanning" && (
                <div className="absolute inset-0 bg-cyan-500/10 flex items-center justify-center">
                  <ScanLine className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button
              onClick={capture}
              disabled={scanState === "scanning"}
              className="w-full py-4 bg-white text-black font-black text-sm tracking-wider hover:bg-zinc-200 disabled:opacity-40 transition"
            >
              {scanState === "scanning" ? "SCANNING…" : "SCAN FACE"}
            </button>
          </div>
        )}

        {/* Result */}
        {(scanState === "result" || scanState === "error") && result && (
          <div className="w-full max-w-sm flex flex-col items-center gap-5">
            {result.matched ? (
              <>
                <CheckCircle className="w-10 h-10 text-emerald-400" />
                {result.image_url && (
                  <img
                    src={result.image_url}
                    alt={result.name}
                    className="w-28 h-28 rounded-full object-cover border-2 border-emerald-500"
                  />
                )}
                {!result.image_url && (
                  <div className="w-28 h-28 rounded-full border-2 border-emerald-500 flex items-center justify-center bg-zinc-900">
                    <User className="w-12 h-12 text-zinc-500" />
                  </div>
                )}
                <div className="text-center space-y-1">
                  <p className="text-white font-black text-2xl">{result.name}</p>
                  {result.profession && <p className="text-zinc-400 text-sm">{result.profession}</p>}
                  {result.age && <p className="text-zinc-500 text-xs">Age {result.age}</p>}
                  <p className="text-emerald-400 text-xs font-black">
                    MATCH · {((result.confidence ?? 0) * 100).toFixed(0)}% CONFIDENCE
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-10 h-10 text-red-400" />
                <div className="text-center space-y-1">
                  <p className="text-white font-black text-lg">NO MATCH FOUND</p>
                  <p className="text-zinc-500 text-xs">{result.error ?? "Person not in the database"}</p>
                </div>
              </>
            )}

            <button
              onClick={reset}
              className="flex items-center gap-2 px-6 py-3 border border-zinc-700 text-zinc-300 hover:border-white hover:text-white text-sm font-black transition"
            >
              <RefreshCw className="w-4 h-4" />
              SCAN AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
