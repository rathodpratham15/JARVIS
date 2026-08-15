import React, { useState, useRef, useEffect } from "react";
import {
  Eye,
  Camera,
  ShieldCheck,
  UserCheck,
  Scan,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";
import { DetectedFace, VisionSnapshot } from "../types";
import { playUiSound } from "../utils/audio";

interface VisionViewProps {
  faces: DetectedFace[];
  snapshots: VisionSnapshot[];
  onAnalyzeOpticalFeed: (imageBase64?: string) => Promise<any>;
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
  const [isScanning, setIsScanning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [snapshots, setSnapshots] = useState<VisionSnapshot[]>(initialSnapshots);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Start Webcam Feed
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn("Camera access denied or unavailable, using simulated feed:", err);
      setCameraError("Physical camera unavailable. Switched to simulated high-resolution HUD optical sensor.");
      setCameraActive(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
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
      const res = await onAnalyzeOpticalFeed(imageBase64);
      setAnalysisResult(res);
      playUiSound("success");

      // Save new snapshot
      const newSnap: VisionSnapshot = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        imageUrl:
          imageBase64 ||
          "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80",
        sceneDescription: res.sceneDescription || "Optical feed scan completed.",
        facesCount: res.facesDetected ? res.facesDetected.length : 1,
        threatLevel: res.threatLevel || "Nominal (0%)",
      };
      setSnapshots([newSnap, ...snapshots]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-mono text-black">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white border-2 border-black shadow-[4px_4px_0px_#000000]">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#00e5ff] text-black border-2 border-black shadow-[2px_2px_0px_#000000]">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-black text-black tracking-wide">
              OPTICAL VISION MATRIX & BIOMETRICS
            </h2>
            <p className="text-xs font-mono font-bold text-black/70">
              1080p Optical Feed • Facial Recognition • Thermal & Spatial Environment Mapping
            </p>
          </div>
        </div>

        <button
          onClick={handleCaptureAndAnalyze}
          disabled={isScanning}
          className="w-full sm:w-auto px-4 py-2.5 bg-[#00e5ff] hover:bg-[#00c5db] disabled:opacity-50 text-black font-black font-mono text-xs flex items-center justify-center gap-2 border-2 border-black shadow-[3px_3px_0px_#000000] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#000000] transition"
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
        <div className="lg:col-span-2 relative bg-white border-2 border-black shadow-[5px_5px_0px_#000000] overflow-hidden flex flex-col justify-between min-h-[380px]">
          {/* Video or Simulated HUD Canvas */}
          <div className="relative w-full h-80 sm:h-96 bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`}
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
              <div className="flex justify-between items-start text-[10px] font-mono text-black font-black">
                <span className="bg-[#00e5ff] px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000000]">
                  CAMERA: 1080P @ 60FPS
                </span>
                <span className="bg-[#00e5ff] px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000000]">
                  FOV: 110° • THERMAL: 36.6°C
                </span>
              </div>

              {/* Target Bounding Box Overlay */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 border-2 border-dashed border-[#00e5ff] flex items-center justify-center animate-pulse">
                <div className="absolute -top-3 px-2 py-0.5 bg-black text-[#00e5ff] border border-white text-[10px] font-mono font-black shadow-[2px_2px_0px_#000000]">
                  TARGET LOCK: TONY STARK (99.8%)
                </div>
                <div className="w-4 h-4 border-t-2 border-l-2 border-[#00e5ff] absolute top-0 left-0" />
                <div className="w-4 h-4 border-t-2 border-r-2 border-[#00e5ff] absolute top-0 right-0" />
                <div className="w-4 h-4 border-b-2 border-l-2 border-[#00e5ff] absolute bottom-0 left-0" />
                <div className="w-4 h-4 border-b-2 border-r-2 border-[#00e5ff] absolute bottom-0 right-0" />
              </div>

              <div className="flex justify-between items-end text-[10px] font-mono text-black font-black">
                <span className="bg-[#00e5ff] px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000000]">
                  GRID SEC 04 • SCANNER ONLINE
                </span>
                <span className="bg-emerald-400 px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000000] text-black font-black">
                  THREAT LEVEL: 0%
                </span>
              </div>
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Info Footer */}
          {cameraError && (
            <div className="p-3 bg-[#f3f3ee] border-t-2 border-black text-xs font-mono text-black font-bold flex items-center justify-between">
              <span>{cameraError}</span>
              <button
                onClick={startCamera}
                className="px-2 py-1 bg-[#00e5ff] hover:bg-[#00c5db] border-2 border-black text-black font-black text-[10px] shadow-[1px_1px_0px_#000000]"
              >
                RETRY CAM
              </button>
            </div>
          )}
        </div>

        {/* Biometric Face Recognition Drawer (1 Col) */}
        <div className="p-5 bg-white border-2 border-black space-y-4 shadow-[5px_5px_0px_#000000] flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="text-xs font-heading font-black uppercase tracking-widest text-black flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-black" />
                <span>BIOMETRIC MATCHES</span>
              </h3>
              <span className="text-[10px] font-mono font-bold bg-[#f3f3ee] px-2 py-0.5 border border-black">4 PROFILES</span>
            </div>

            <div className="space-y-3">
              {faces.map((face) => (
                <div
                  key={face.id}
                  className="p-3 bg-[#f3f3ee] border-2 border-black shadow-[2px_2px_0px_#000000] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {face.avatarUrl ? (
                      <img
                        src={face.avatarUrl}
                        alt={face.name}
                        className="w-10 h-10 border-2 border-black object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-[#00e5ff] border-2 border-black flex items-center justify-center text-black font-mono font-black">
                        ?
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <span className="font-black text-black font-mono block">
                        {face.name}
                      </span>
                      <span className="text-[10px] text-black/70 font-mono block">{face.role}</span>
                      <span className="text-[9px] font-mono font-black text-[#008f9e] block">
                        CLEARANCE: LEVEL {face.clearanceLevel}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-black border border-black uppercase ${
                      face.status === "Authorized"
                        ? "bg-emerald-400 text-black"
                        : "bg-amber-300 text-black"
                    }`}
                  >
                    {face.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Scene Analysis Result Card */}
      {analysisResult && (
        <div className="p-5 bg-white border-2 border-black space-y-3 shadow-[5px_5px_0px_#000000]">
          <div className="flex items-center gap-2 text-sm font-heading font-black text-black border-b-2 border-black pb-2">
            <Sparkles className="w-4 h-4 text-[#00a8bb]" />
            <span>OPTICAL ANALYSIS BREAKDOWN</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-black">
            <div>
              <span className="font-mono font-black text-black text-[10px] uppercase block mb-1">
                SCENE DESCRIPTION:
              </span>
              <p className="bg-[#f3f3ee] p-3 border-2 border-black leading-relaxed font-bold">
                {analysisResult.sceneDescription || JSON.stringify(analysisResult)}
              </p>
            </div>
            <div className="space-y-2">
              <span className="font-mono font-black text-black text-[10px] uppercase block">
                TACTICAL READOUTS:
              </span>
              <div className="bg-[#f3f3ee] p-3 border-2 border-black space-y-1 font-mono text-[11px] font-bold">
                <div>THREAT LEVEL: <strong className="text-emerald-700 font-black">{analysisResult.threatLevel || "0% (Nominal)"}</strong></div>
                <div>ENVIRONMENT: <strong className="text-black">{analysisResult.environmentDetails || "Stark Workshop / Command Suite"}</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optical Snapshot Gallery */}
      <div className="p-5 bg-white border-2 border-black space-y-4 shadow-[4px_4px_0px_#000000]">
        <h3 className="text-xs font-heading font-black uppercase tracking-widest text-black flex items-center gap-2">
          <Layers className="w-4 h-4" />
          <span>RECENT OPTICAL SNAPSHOTS</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {snapshots.map((snap) => (
            <div
              key={snap.id}
              className="p-3 bg-[#f3f3ee] border-2 border-black shadow-[2px_2px_0px_#000000] space-y-2 text-xs"
            >
              <img
                src={snap.imageUrl}
                alt="Snapshot"
                className="w-full h-36 object-cover border-2 border-black"
              />
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono font-bold text-black/70">
                  <span>{snap.timestamp}</span>
                  <span className="text-black bg-[#00e5ff] px-1 border border-black">{snap.threatLevel}</span>
                </div>
                <p className="text-black font-mono text-xs line-clamp-2 font-bold">{snap.sceneDescription}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
