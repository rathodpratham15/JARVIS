import { useEffect, useRef, useState } from 'react';
import { Camera, Scan, CameraOff } from 'lucide-react';
import { HudPanel, MonoLabel, ScanLoader } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

interface FacePerson {
  name: string;
  relationship: string;
}

interface FaceResult {
  person: FacePerson | null;
  confidence: number;
}

export default function CameraRecognition() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<FaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setActive(true);
    } catch {
      setError('Camera access denied or unavailable.');
      hudToast.error('CAMERA UNAVAILABLE');
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
    setResult(null);
  };

  useEffect(() => () => stop(), []);

  const scan = async () => {
    if (!videoRef.current) return;
    setScanning(true);
    setResult(null);
    try {
      // Capture current video frame to a canvas, convert to blob, upload
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92)
      );
      const formData = new FormData();
      formData.append('image', blob, 'frame.jpg');
      const res = await fetch('/api/face/identify', { method: 'POST', body: formData });
      const data: FaceResult = await res.json();
      setResult(data);
      hudToast.info(data.person ? `IDENTIFIED: ${data.person.name}` : 'NO MATCH FOUND');
    } catch {
      hudToast.error('SCAN FAILED');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div data-testid="camera-page">
      <PageHeader overline="Live Recognition Feed" title="CAMERA RECOGNITION" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HudPanel
            active={active}
            className="p-0 overflow-hidden relative aspect-video flex items-center justify-center bg-[#03101f]"
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${active ? '' : 'hidden'}`}
            />
            {!active && (
              <div className="flex flex-col items-center gap-3 text-center px-6">
                <CameraOff className="w-10 h-10 text-[#4a7fa0]" />
                <MonoLabel>{error || 'Camera feed offline'}</MonoLabel>
              </div>
            )}
            {active && (
              <>
                <div className="absolute inset-6 border border-[rgba(0,212,255,0.4)] pointer-events-none" />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444] jv-pulse" />
                  <span className="font-hud-mono text-[10px] tracking-widest text-[#ef4444]">LIVE</span>
                </div>
              </>
            )}
          </HudPanel>

          <div className="flex gap-3 mt-4">
            {!active ? (
              <button
                onClick={start}
                data-testid="camera-start"
                className="flex items-center gap-2 px-4 py-2 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.1)]"
              >
                <Camera className="w-4 h-4" /> START FEED
              </button>
            ) : (
              <>
                <button
                  onClick={scan}
                  disabled={scanning}
                  data-testid="camera-scan"
                  className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.2)] disabled:opacity-40"
                >
                  <Scan className="w-4 h-4" /> SCAN FRAME
                </button>
                <button
                  onClick={stop}
                  data-testid="camera-stop"
                  className="px-4 py-2 border border-[#ef4444] text-[#ef4444] font-hud-mono text-xs tracking-widest hover:bg-[rgba(239,68,68,0.1)]"
                >
                  STOP
                </button>
              </>
            )}
          </div>
        </div>

        <HudPanel data-testid="camera-result">
          <MonoLabel className="block mb-3">Recognition Result</MonoLabel>
          {scanning && <ScanLoader />}
          {!scanning && !result && (
            <p className="text-sm text-[#4a7fa0]">
              Start the feed and scan a frame to identify subjects.
            </p>
          )}
          {result && !scanning &&
            (result.person ? (
              <div className="jv-fadeup">
                <div className="font-orbitron text-lg text-[#cae8ff]">{result.person.name}</div>
                <MonoLabel className="block mt-1">{result.person.relationship}</MonoLabel>
                <div className="mt-3 font-hud-mono text-[11px] text-[#00d4ff]">
                  {Math.round(result.confidence * 100)}% confidence
                </div>
              </div>
            ) : (
              <div className="font-hud-mono text-xs tracking-widest text-[#ef4444]">[ NO MATCH ]</div>
            ))}
        </HudPanel>
      </div>
    </div>
  );
}
