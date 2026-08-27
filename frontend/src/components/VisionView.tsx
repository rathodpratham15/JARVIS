import React, { useState, useRef, useEffect } from "react";
import {
  Eye,
  Camera,
  UserCheck,
  RefreshCw,
  Sparkles,
  Layers,
  UserPlus,
  Trash2,
  Upload,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  SwitchCamera,
} from "lucide-react";
import { DetectedFace, VisionSnapshot, ResearchDossier } from "../types";
import { playUiSound } from "../utils/audio";
import { API_BASE, apiFetch } from "../utils/api";

interface EnrolledPerson {
  name: string;
  profession?: string;
  image_url?: string;
}

interface VisionViewProps {
  faces: DetectedFace[];
  snapshots: VisionSnapshot[];
  onAnalyzeOpticalFeed: (imageBase64?: string, onSceneUpdate?: (r: any) => void) => Promise<any>;
  accentColor?: string;
}

export const VisionView: React.FC<VisionViewProps> = ({
  faces,
  snapshots: initialSnapshots,
  onAnalyzeOpticalFeed,
  accentColor = "cyan",
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzingScene, setIsAnalyzingScene] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<VisionSnapshot[]>(initialSnapshots);

  const [enrolledPeople, setEnrolledPeople] = useState<EnrolledPerson[]>([]);
  const [enrollName, setEnrollName] = useState("");
  const [enrollOrg, setEnrollOrg] = useState("");
  const [enrollFiles, setEnrollFiles] = useState<FileList | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [showEnrollForm, setShowEnrollForm] = useState(false);

  // OSINT / research state
  const [osintDossier, setOsintDossier] = useState<ResearchDossier | null>(null);
  const [osintLoading, setOsintLoading] = useState(false);
  const [osintError, setOsintError] = useState<string | null>(null);
  const [osintSourcesOpen, setOsintSourcesOpen] = useState(false);
  // For unknown-face manual lookup
  const [unknownName, setUnknownName] = useState("");
  const [unknownCompany, setUnknownCompany] = useState("");
  const [showUnknownForm, setShowUnknownForm] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [lensToast, setLensToast] = useState<string | null>(null);
  // Reverse image search state
  const [reverseResults, setReverseResults] = useState<{name: string; score: number}[]>([]);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  const [savedToDb, setSavedToDb] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enrollFileRef = useRef<HTMLInputElement>(null);

  const runOsint = async (subject: string, company?: string) => {
    setOsintLoading(true);
    setOsintError(null);
    setOsintDossier(null);
    setOsintSourcesOpen(false);
    try {
      const res = await apiFetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, kind: "person", ...(company ? { company } : {}) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ResearchDossier = await res.json();
      setOsintDossier(data);
    } catch (err: any) {
      setOsintError(err.message ?? "Research failed");
    } finally {
      setOsintLoading(false);
    }
  };

  const handleGoogleLens = async () => {
    if (!capturedFrame) return;
    window.open("https://lens.google.com/", "_blank");
    try {
      const blob = await (await fetch(capturedFrame)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/jpeg": blob })]);
      setLensToast("Image copied — paste it into Google Lens (Ctrl+V / ⌘V)");
    } catch {
      // Clipboard API not supported — fall back to downloading the image
      const a = document.createElement("a");
      a.href = capturedFrame;
      a.download = "face-scan.jpg";
      a.click();
      setLensToast("Image downloaded — upload it to Google Lens");
    }
    setTimeout(() => setLensToast(null), 5000);
  };

  const runReverseSearch = async (imageBase64: string) => {
    setReverseLoading(true);
    setReverseResults([]);
    try {
      const blob = await (await fetch(imageBase64)).blob();
      const form = new FormData();
      form.append("image", blob, "frame.jpg");
      const res = await apiFetch("/api/vision/reverse-search", { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.available && data.candidates?.length > 0) {
        setReverseResults(data.candidates);
        setShowUnknownForm(false);
      } else {
        setShowUnknownForm(true);
      }
    } catch {
      setShowUnknownForm(true);
    } finally {
      setReverseLoading(false);
    }
  };

  const handleConfirmCandidate = async (name: string, frame: string | null) => {
    setConfirmedName(name);
    setReverseResults([]);
    setShowUnknownForm(false);
    runOsint(name);
    if (!frame) return;
    try {
      const blob = await (await fetch(frame)).blob();
      const form = new FormData();
      form.append("name", name);
      form.append("image", blob, "face.jpg");
      const res = await apiFetch("/api/face/add-person", { method: "POST", body: form });
      if (res.ok) {
        setSavedToDb(true);
        fetchEnrolled();
      }
    } catch {
      // silently ignore DB save failure — research still shows
    }
  };

  const fetchEnrolled = async () => {
    try {
      const res = await apiFetch(`/api/face/list`);
      if (res.ok) {
        const data = await res.json();
        setEnrolledPeople(data.people ?? []);
      }
    } catch {
      // ignore
    }
  };

  const handleEnroll = async () => {
    if (!enrollName.trim() || !enrollFiles || enrollFiles.length === 0) {
      setEnrollError("Name and at least one photo are required.");
      return;
    }
    setEnrolling(true);
    setEnrollError(null);
    try {
      const form = new FormData();
      form.append("name", enrollName.trim());
      if (enrollOrg.trim()) form.append("organization", enrollOrg.trim());
      for (let i = 0; i < enrollFiles.length; i++) {
        form.append("image", enrollFiles[i]);
      }
      const res = await apiFetch(`/api/face/add-person`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? "Enrollment failed");
      playUiSound("success");
      setEnrollName("");
      setEnrollOrg("");
      setEnrollFiles(null);
      if (enrollFileRef.current) enrollFileRef.current.value = "";
      setShowEnrollForm(false);
      await fetchEnrolled();
    } catch (err: any) {
      setEnrollError(err.message);
    } finally {
      setEnrolling(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Remove ${name} from face recognition?`)) return;
    try {
      const res = await apiFetch(`/api/face/person/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (res.ok) {
        setEnrolledPeople(prev => prev.filter(p => p.name !== name));
      }
    } catch {
      // ignore
    }
  };

  const stopCurrentStream = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Start Webcam Feed
  const startCamera = async (facing: "user" | "environment" = facingMode) => {
    try {
      setCameraError(null);
      stopCurrentStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facing },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setFacingMode(facing); // only update after stream opens successfully
      }
    } catch (err: any) {
      console.warn("Camera access denied or unavailable, using simulated feed:", err);
      setCameraError("Physical camera unavailable. Switched to simulated high-resolution HUD optical sensor.");
      setCameraActive(false);
      // facingMode intentionally left unchanged — label stays accurate
    }
  };

  const handleSwitchCamera = async () => {
    const next = facingMode === "user" ? "environment" : "user";
    await startCamera(next); // setFacingMode happens inside on success only
  };

  useEffect(() => {
    startCamera();
    fetchEnrolled();
    return () => { stopCurrentStream(); };
  }, []);

  // Capture Snapshot and run Gemini Optical Analysis
  const handleCaptureAndAnalyze = async () => {
    playUiSound("scan");
    setIsScanning(true);

    let imageBase64: string | undefined = undefined;

    if (cameraActive && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        imageBase64 = canvas.toDataURL("image/jpeg");
      }
    }

    try {
      // Face recognition returns fast; scene analysis fires in background via callback
      const res = await onAnalyzeOpticalFeed(imageBase64, (sceneResult: any) => {
        setAnalysisResult((prev: any) => ({ ...prev, ...sceneResult }));
        setIsAnalyzingScene(false);
      });

      // Unlock UI immediately after face ID
      setAnalysisResult(res);
      setIsAnalyzingScene(true);  // scene is still loading in background
      playUiSound("success");

      // OSINT: auto-research known match, reverse-search for unknown
      setOsintDossier(null);
      setOsintError(null);
      setShowUnknownForm(false);
      setReverseResults([]);
      setConfirmedName(null);
      setSavedToDb(false);
      setCapturedFrame(imageBase64 ?? null);
      if (res.faceMatch) {
        const org = res.facePerson?.additional_data?.organization || res.facePerson?.profession || undefined;
        runOsint(res.faceMatch, org);
      } else if (imageBase64) {
        runReverseSearch(imageBase64);
      } else {
        setShowUnknownForm(true);
      }

      const newSnap: VisionSnapshot = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        imageUrl:
          imageBase64 ||
          "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
        sceneDescription: "Analyzing scene...",
        facesCount: 1,
        threatLevel: res.threatLevel || "Nominal (0%)",
      };
      setSnapshots([newSnap, ...snapshots]);
    } catch (err) {
      console.error(err);
      setIsAnalyzingScene(false);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-mono">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-[#111318] border border-zinc-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#00E5FF] text-black">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-black text-white tracking-wide">
              OPTICAL VISION MATRIX & BIOMETRICS
            </h2>
            <p className="text-xs font-mono font-bold text-zinc-400">
              Live Camera Feed • Facial Recognition • AI Scene Analysis
            </p>
          </div>
        </div>

        <button
          onClick={handleCaptureAndAnalyze}
          disabled={isScanning}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#00E5FF] hover:bg-[#00c5db] disabled:opacity-50 text-black font-black font-mono text-xs flex items-center justify-center gap-2 border border-transparent transition"
        >
          {isScanning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>SCANNING FEED...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>CAPTURE & ANALYZE SCAN</span>
            </>
          )}
        </button>
      </div>

      {/* Main Grid: Optical Feed Display & Face Recognition Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Optical Feed Panel (2 Cols) */}
        <div className="lg:col-span-2 relative bg-[#111318] border border-zinc-800 shadow-lg overflow-hidden flex flex-col justify-between min-h-[380px]">
          {/* Video or Simulated HUD Canvas */}
          <div className="relative w-full h-80 sm:h-96 bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"} ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
            />

            {!cameraActive && (
              <div className="relative w-full h-full bg-slate-900 flex items-center justify-center">
                {/* Simulated Holographic Workshop Grid */}
                <img
                  src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1000&q=80"
                  alt="Simulated Feed"
                  className="w-full h-full object-cover opacity-60 grayscale contrast-125"
                />
              </div>
            )}

            {/* HUD Target Overlay Crosshairs */}
            <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between border-2 border-[#00e5ff]/50">
              {/* Target Bounding Box Overlay */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 border-2 border-dashed border-[#00e5ff] flex items-center justify-center animate-pulse">
                <div className="absolute -top-3 px-2 py-0.5 bg-black text-[#00e5ff] border border-[#00e5ff]/30 text-[10px] font-mono font-black">
                  {cameraActive ? "CAMERA ACTIVE" : "SIMULATED FEED"}
                </div>
                <div className="w-4 h-4 border-t-2 border-l-2 border-[#00e5ff] absolute top-0 left-0" />
                <div className="w-4 h-4 border-t-2 border-r-2 border-[#00e5ff] absolute top-0 right-0" />
                <div className="w-4 h-4 border-b-2 border-l-2 border-[#00e5ff] absolute bottom-0 left-0" />
                <div className="w-4 h-4 border-b-2 border-r-2 border-[#00e5ff] absolute bottom-0 right-0" />
              </div>

              <div className="flex justify-end items-end text-[10px] font-mono mt-auto">
                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 border border-emerald-800 font-black">
                  THREAT LEVEL: 0%
                </span>
              </div>
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Controls Footer */}
          <div className="p-3 bg-[#111318] border-t border-zinc-800 flex items-center justify-between gap-2">
            {cameraError ? (
              <span className="text-xs font-mono text-zinc-300 font-bold flex-1">{cameraError}</span>
            ) : (
              <span className="text-[10px] font-mono text-zinc-500">
                {facingMode === "user" ? "FRONT CAMERA (MIRRORED)" : "REAR CAMERA"}
              </span>
            )}
            <div className="flex items-center gap-2">
              {cameraActive && (
                <button
                  onClick={handleSwitchCamera}
                  className="px-2 py-1 bg-[#111318] hover:bg-[#00E5FF] hover:text-black border border-zinc-800 text-zinc-300 font-black text-[10px] flex items-center gap-1 transition"
                  title="Switch camera"
                >
                  <SwitchCamera className="w-3 h-3" />
                  FLIP CAM
                </button>
              )}
              {cameraError && (
                <button
                  onClick={() => startCamera()}
                  className="px-2 py-1 bg-[#00E5FF] hover:bg-[#00c5db] border border-transparent text-black font-black text-[10px]"
                >
                  RETRY CAM
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Biometric Face Recognition Drawer (1 Col) */}
        <div className="p-5 bg-[#111318] border border-zinc-800 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-xs font-heading font-black uppercase tracking-widest text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-zinc-300" />
                <span>BIOMETRIC MATCHES</span>
              </h3>
              <span className="text-[10px] font-mono font-bold bg-[#0d0f12] px-2 py-0.5 border border-zinc-800 text-zinc-300">
                {faces.length > 0 ? `${faces.length} PROFILES` : "NO MATCHES"}
              </span>
            </div>

            <div className="space-y-3">
              {faces.length === 0 && (
                <div className="py-6 text-center text-[11px] font-mono text-zinc-500">
                  Capture a scan to identify faces.
                </div>
              )}
              {faces.map((face) => (
                <div
                  key={face.id}
                  className="p-3 bg-[#0d0f12] border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {face.avatarUrl ? (
                      <img
                        src={face.avatarUrl}
                        alt={face.name}
                        className="w-10 h-10 border border-zinc-700 object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-[#00E5FF] flex items-center justify-center text-black font-mono font-black">
                        ?
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <span className="font-black text-white font-mono block">
                        {face.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono block">{face.role}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-black border uppercase ${
                      face.status === "Authorized"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-800"
                        : "bg-amber-500/20 text-amber-400 border-amber-800"
                    }`}
                  >
                    {face.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Reverse search loading */}
          {reverseLoading && (
            <div className="border-t border-zinc-800 pt-3 flex items-center gap-2 text-[11px] font-mono font-bold text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Searching the web for identity…
            </div>
          )}

          {/* Reverse search candidates */}
          {!reverseLoading && reverseResults.length > 0 && !osintDossier && (
            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <p className="text-[10px] font-mono font-black text-zinc-400 uppercase">Possible matches — confirm identity:</p>
              {reverseResults.map((c, i) => (
                <button
                  key={i}
                  onClick={() => handleConfirmCandidate(c.name, capturedFrame)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[#0d0f12] border border-zinc-800 hover:bg-[#00E5FF] hover:text-black transition text-left font-mono text-xs font-bold text-zinc-300"
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] text-zinc-500">{Math.min(100, Math.round(c.score * 100))}%</span>
                </button>
              ))}
              <button
                onClick={() => { setReverseResults([]); setShowUnknownForm(true); }}
                className="w-full text-[10px] font-mono text-zinc-500 hover:text-white transition py-1"
              >
                None of these — enter manually
              </button>
            </div>
          )}

          {/* Manual form fallback */}
          {showUnknownForm && !osintLoading && !osintDossier && !reverseLoading && reverseResults.length === 0 && (
            <div className="border-t border-zinc-800 pt-3 space-y-2">
              <p className="text-[10px] font-mono font-bold text-zinc-500 uppercase">No match — research manually:</p>
              <button
                onClick={handleGoogleLens}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#111318] border border-zinc-800 font-mono font-black text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                SEARCH ON GOOGLE LENS
              </button>
              {lensToast && (
                <p className="text-[10px] font-mono text-emerald-400 bg-emerald-900/20 border border-emerald-900 px-2 py-1.5">{lensToast}</p>
              )}
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
                <div className="flex-1 border-t border-zinc-800" />
                <span>OR ENTER NAME MANUALLY</span>
                <div className="flex-1 border-t border-zinc-800" />
              </div>
              <input
                type="text"
                value={unknownName}
                onChange={e => setUnknownName(e.target.value)}
                placeholder="Person's name"
                className="w-full border border-zinc-800 px-2 py-1.5 text-xs font-mono bg-[#0d0f12] text-white focus:outline-none"
              />
              <input
                type="text"
                value={unknownCompany}
                onChange={e => setUnknownCompany(e.target.value)}
                placeholder="Company (optional)"
                className="w-full border border-zinc-800 px-2 py-1.5 text-xs font-mono bg-[#0d0f12] text-white focus:outline-none"
              />
              <button
                onClick={() => { if (unknownName.trim()) { setConfirmedName(unknownName.trim()); runOsint(unknownName.trim(), unknownCompany.trim() || undefined); }}}
                disabled={!unknownName.trim()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#00E5FF] border border-transparent font-mono font-black text-xs text-black transition disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                COMPILE DOSSIER
              </button>
            </div>
          )}

          {/* OSINT loading */}
          {osintLoading && (
            <div className="border-t border-zinc-800 pt-3 flex items-center gap-2 text-[11px] font-mono font-bold text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Running OSINT pipeline…
            </div>
          )}

          {/* OSINT error */}
          {osintError && (
            <p className="border-t border-zinc-800 pt-2 text-[11px] font-mono text-red-400">{osintError}</p>
          )}
        </div>
      </div>

      {/* OSINT Dossier panel */}
      {osintDossier && (
        <div className="p-5 bg-[#111318] border border-zinc-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#00E5FF]" />
              <h3 className="text-xs font-heading font-black uppercase tracking-widest text-white">
                INTELLIGENCE DOSSIER — {osintDossier.subject.toUpperCase()}
              </h3>
            </div>
            <span className="text-[10px] font-mono font-bold bg-[#0d0f12] px-2 py-0.5 border border-zinc-800 text-zinc-300">
              {osintDossier.sources.length} SOURCES
            </span>
          </div>

          {/* Summary */}
          <p className="text-xs font-mono text-zinc-200 leading-relaxed bg-[#0d0f12] border border-zinc-800 p-3">
            {osintDossier.summary}
          </p>

          {savedToDb && (
            <p className="text-[11px] font-mono text-emerald-400 bg-emerald-900/20 border border-emerald-900 px-3 py-2">
              ✓ Face saved — will be recognised instantly next time.
            </p>
          )}

          {/* Sections */}
          {Object.keys(osintDossier.sections).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(osintDossier.sections).map(([title, content]) => (
                <div key={title} className="border border-zinc-800 p-3 space-y-1 bg-[#0d0f12]">
                  <div className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-1">
                    {title}
                  </div>
                  <p className="text-[11px] font-mono text-zinc-300 leading-relaxed">{content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Sources toggle */}
          {osintDossier.sources.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setOsintSourcesOpen(o => !o)}
                className="flex items-center gap-1.5 text-[10px] font-mono font-black text-zinc-500 uppercase tracking-widest hover:text-white transition"
              >
                {osintSourcesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {osintDossier.sources.length} Sources
              </button>
              {osintSourcesOpen && (
                <div className="space-y-1.5">
                  {osintDossier.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2 border border-zinc-800 hover:border-zinc-600 transition group"
                    >
                      <span className="font-mono text-[10px] text-zinc-600 shrink-0 mt-0.5">[{i + 1}]</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[11px] font-bold text-zinc-300 truncate group-hover:text-[#00E5FF] transition">{src.title}</div>
                        <div className="font-mono text-[10px] text-zinc-500 line-clamp-1">{src.snippet}</div>
                      </div>
                      <ExternalLink className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Scene Analysis Result Card */}
      {(analysisResult || isAnalyzingScene) && (
        <div className="p-5 bg-[#111318] border border-zinc-800 space-y-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-heading font-black text-white border-b border-zinc-800 pb-2">
            <Sparkles className="w-4 h-4 text-[#00E5FF]" />
            <span>OPTICAL ANALYSIS BREAKDOWN</span>
            {isAnalyzingScene && <RefreshCw className="w-3 h-3 animate-spin text-[#00E5FF] ml-auto" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-zinc-300">
            <div>
              <span className="font-mono font-black text-zinc-400 text-[10px] uppercase block mb-1">
                SCENE DESCRIPTION:
              </span>
              <p className="bg-[#0d0f12] p-3 border border-zinc-800 leading-relaxed font-bold min-h-[48px] text-zinc-200">
                {isAnalyzingScene && !analysisResult?.sceneDescription
                  ? <span className="text-zinc-500">Analyzing scene...</span>
                  : (analysisResult?.sceneDescription || <span className="text-zinc-500">Analyzing scene...</span>)
                }
              </p>
            </div>
            <div className="space-y-2">
              <span className="font-mono font-black text-zinc-400 text-[10px] uppercase block">
                TACTICAL READOUTS:
              </span>
              <div className="bg-[#0d0f12] p-3 border border-zinc-800 space-y-1 font-mono text-[11px] font-bold">
                <div>THREAT LEVEL: <strong className="text-emerald-400 font-black">{analysisResult?.threatLevel || "Nominal (0%)"}</strong></div>
                <div>ENVIRONMENT: <strong className="text-zinc-200">{analysisResult?.environmentDetails || "—"}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Face Enrollment Panel */}
      <div className="p-5 bg-[#111318] border border-zinc-800 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-xs font-heading font-black uppercase tracking-widest text-white flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            <span>ENROLLED IDENTITIES</span>
            <span className="text-[10px] font-mono font-bold bg-[#0d0f12] px-2 py-0.5 border border-zinc-800 text-zinc-300 ml-1">
              {enrolledPeople.length} PROFILES
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const res = await apiFetch("/api/face/reencode-all", { method: "POST" });
                const data = await res.json();
                alert(`Re-encoded ${data.reencoded} people. Failed: ${data.failed}.\n\n${data.details.map((d: {name:string;encodings:number}) => `${d.name}: ${d.encodings} encoding(s)`).join("\n")}`);
                fetchEnrolled();
              }}
              className="px-3 py-1.5 bg-[#111318] border border-zinc-800 text-zinc-300 hover:text-white font-black font-mono text-[10px] flex items-center gap-1.5 hover:bg-zinc-800 transition"
              title="Re-run InsightFace on existing photos (fixes dlib→InsightFace migration)"
            >
              <RefreshCw className="w-3 h-3" />
              RE-ENCODE ALL
            </button>
            <button
              onClick={() => { setShowEnrollForm(f => !f); setEnrollError(null); }}
              className="px-3 py-1.5 bg-[#00E5FF] hover:bg-[#00c5db] border border-transparent text-black font-black font-mono text-[10px] flex items-center gap-1.5 transition"
            >
              <UserPlus className="w-3 h-3" />
              {showEnrollForm ? "CANCEL" : "ENROLL NEW"}
            </button>
          </div>
        </div>

        {/* Enroll form */}
        {showEnrollForm && (
          <div className="p-4 bg-[#0d0f12] border border-zinc-800 space-y-3">
            <p className="text-[10px] font-mono font-bold text-zinc-500">
              Upload 1–3 clear face photos. Multiple photos improve recognition accuracy.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Full name (e.g. Pratham Rathod)"
                value={enrollName}
                onChange={e => setEnrollName(e.target.value)}
                className="flex-1 px-3 py-2 border border-zinc-800 bg-[#0d0f12] text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#00E5FF]"
              />
              <input
                type="text"
                placeholder="Organization (e.g. Northeastern, Swapt)"
                value={enrollOrg}
                onChange={e => setEnrollOrg(e.target.value)}
                className="flex-1 px-3 py-2 border border-zinc-800 bg-[#0d0f12] text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#00E5FF]"
              />
              <label className="flex items-center gap-2 px-3 py-2 border border-zinc-800 bg-[#0d0f12] text-zinc-300 font-mono text-[10px] font-black cursor-pointer hover:bg-[#00E5FF] hover:text-black transition">
                <Upload className="w-3.5 h-3.5" />
                {enrollFiles && enrollFiles.length > 0 ? `${enrollFiles.length} PHOTO(S)` : "CHOOSE PHOTOS"}
                <input
                  ref={enrollFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => setEnrollFiles(e.target.files)}
                />
              </label>
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-black font-mono text-[10px] flex items-center gap-2 border border-zinc-700 transition"
              >
                {enrolling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                {enrolling ? "ENROLLING..." : "ENROLL"}
              </button>
            </div>
            {enrollError && (
              <p className="text-[10px] font-mono font-bold text-red-400">{enrollError}</p>
            )}
          </div>
        )}

        {/* Enrolled people grid */}
        {enrolledPeople.length === 0 ? (
          <p className="text-center text-[11px] font-mono text-zinc-500 py-4">
            No faces enrolled. Click "ENROLL NEW" to add people.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {enrolledPeople.map(person => (
              <div key={person.name} className="p-3 bg-[#0d0f12] border border-zinc-800 flex flex-col items-center gap-2 text-xs relative group">
                {person.image_url ? (
                  <img
                    src={`${API_BASE}${person.image_url}`}
                    alt={person.name}
                    className="w-16 h-16 object-cover border border-zinc-700"
                  />
                ) : (
                  <div className="w-16 h-16 bg-[#00E5FF] flex items-center justify-center text-black font-black text-xl">
                    {person.name[0]?.toUpperCase()}
                  </div>
                )}
                <span className="font-black font-mono text-[10px] text-zinc-200 text-center truncate w-full">{person.name}</span>
                {person.profession && (
                  <span className="text-[9px] font-mono text-zinc-500 text-center truncate w-full">{person.profession}</span>
                )}
                <button
                  onClick={() => handleDelete(person.name)}
                  className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 border border-red-900 text-white opacity-0 group-hover:opacity-100 transition"
                  title={`Remove ${person.name}`}
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Optical Snapshot Gallery */}
      <div className="p-5 bg-[#111318] border border-zinc-800 space-y-4 shadow-lg">
        <h3 className="text-xs font-heading font-black uppercase tracking-widest text-white flex items-center gap-2">
          <Layers className="w-4 h-4" />
          <span>RECENT OPTICAL SNAPSHOTS</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="p-3 bg-[#0d0f12] border border-zinc-800 space-y-2 text-xs"
            >
              <img
                src={snap.imageUrl}
                alt="Snapshot"
                className="w-full h-36 object-cover border border-zinc-800"
              />
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-500">
                  <span>{snap.timestamp}</span>
                  <span className="text-black bg-[#00E5FF] px-1">{snap.threatLevel}</span>
                </div>
                <p className="text-zinc-300 font-mono text-xs line-clamp-2 font-bold">{snap.sceneDescription}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
