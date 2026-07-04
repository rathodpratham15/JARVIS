import { useEffect, useRef, useState } from 'react';
import { Camera, Scan, CameraOff, CheckCircle2, XCircle, User } from 'lucide-react';
import { HudPanel, MonoLabel, ScanLoader, StatBlock } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { UploadZone } from '@/components/hud/UploadZone';
import { hudToast } from '@/lib/hudToast';

type Tab = 'CAMERA' | 'FACE ID' | 'SCENE';

// ── shared types ───────────────────────────────────────────────────────────
interface FacePerson { name: string; relationship: string; notes?: string; }
interface FaceResult { person: FacePerson | null; confidence: number; formatted_result: string; }
interface FaceStats { total_people?: number; matches?: number; accuracy?: number; }
interface VisionResults { description: string; objects: string[]; scene_type: string; mood: string; colors: string[]; }
interface VisionHistoryItem { id: string; description: string; timestamp: string; thumbnail?: string; }

const fmtTime = (iso: string) => new Date(iso).toLocaleString();

// ── Tab button ─────────────────────────────────────────────────────────────
function TabBtn({ label, active, onClick }: { label: Tab; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 font-hud-mono text-xs tracking-widest border-b-2 transition-colors ${
        active
          ? 'border-[#00d4ff] text-[#00d4ff]'
          : 'border-transparent text-[#4a7fa0] hover:text-[#cae8ff]'
      }`}
    >
      {label}
    </button>
  );
}

// ── Camera tab ─────────────────────────────────────────────────────────────
function CameraTab() {
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <HudPanel active={active} className="p-0 overflow-hidden relative aspect-video flex items-center justify-center bg-[#03101f]">
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${active ? '' : 'hidden'}`} />
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
            <button onClick={start} className="flex items-center gap-2 px-4 py-2 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.1)]">
              <Camera className="w-4 h-4" /> START FEED
            </button>
          ) : (
            <>
              <button onClick={scan} disabled={scanning} className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.2)] disabled:opacity-40">
                <Scan className="w-4 h-4" /> SCAN FRAME
              </button>
              <button onClick={stop} className="px-4 py-2 border border-[#ef4444] text-[#ef4444] font-hud-mono text-xs tracking-widest hover:bg-[rgba(239,68,68,0.1)]">
                STOP
              </button>
            </>
          )}
        </div>
      </div>
      <HudPanel>
        <MonoLabel className="block mb-3">Recognition Result</MonoLabel>
        {scanning && <ScanLoader />}
        {!scanning && !result && <p className="text-sm text-[#4a7fa0]">Start the feed and scan a frame to identify subjects.</p>}
        {result && !scanning && (result.person ? (
          <div className="jv-fadeup">
            <div className="font-orbitron text-lg text-[#cae8ff]">{result.person.name}</div>
            <MonoLabel className="block mt-1">{result.person.relationship}</MonoLabel>
            <div className="mt-3 font-hud-mono text-[11px] text-[#00d4ff]">{Math.round(result.confidence * 100)}% confidence</div>
          </div>
        ) : (
          <div className="font-hud-mono text-xs tracking-widest text-[#ef4444]">[ NO MATCH ]</div>
        ))}
      </HudPanel>
    </div>
  );
}

// ── Face ID tab ────────────────────────────────────────────────────────────
function FaceIdTab() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FaceResult | null>(null);
  const [stats, setStats] = useState<FaceStats | null>(null);

  useEffect(() => {
    fetch('/api/face/statistics').then((r) => r.json()).then(d => setStats(d.statistics ?? d)).catch(() => {});
  }, []);

  const onFile = async (file: File, url: string) => {
    setPreview(url);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/face/identify', { method: 'POST', body: formData });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const matched = result?.person;
  const conf = result ? Math.round((result.confidence || 0) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        {!preview ? (
          <UploadZone onFile={onFile} label="Drop a face image to identify" />
        ) : (
          <>
            <HudPanel className="p-0 overflow-hidden"><img src={preview} alt="subject" className="w-full max-h-80 object-cover" /></HudPanel>
            <button onClick={() => { setPreview(null); setResult(null); }} className="font-hud-mono text-xs tracking-widest text-[#4a7fa0] hover:text-[#00d4ff]">‹ UPLOAD ANOTHER</button>
          </>
        )}
        {loading && <HudPanel><MonoLabel className="block mb-3">Scanning facial geometry...</MonoLabel><ScanLoader /></HudPanel>}
        {result && !loading && (matched ? (
          <HudPanel active className="jv-fadeup">
            <div className="flex items-center gap-2 mb-4"><CheckCircle2 className="w-5 h-5 text-[#22c55e]" /><span className="font-hud-mono text-xs tracking-widest text-[#22c55e]">MATCH FOUND</span></div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 border border-[#00b4d8] flex items-center justify-center bg-[rgba(0,180,255,0.08)]"><User className="w-7 h-7 text-[#00d4ff]" /></div>
              <div><div className="font-orbitron text-xl text-[#cae8ff]">{matched.name}</div><MonoLabel>{matched.relationship}</MonoLabel></div>
            </div>
            <MonoLabel className="block mb-1">Confidence — {conf}%</MonoLabel>
            <div className="h-2 bg-[rgba(0,180,255,0.1)] w-full">
              <div className="h-2 bg-[#00d4ff]" style={{ width: `${conf}%`, boxShadow: '0 0 8px #00d4ff' }} />
            </div>
            {matched.notes && <div className="mt-4 font-hud-mono text-[11px] text-[#4a7fa0]">{matched.notes}</div>}
          </HudPanel>
        ) : (
          <HudPanel className="jv-fadeup" style={{ borderColor: '#ef4444' }}>
            <div className="flex items-center gap-2"><XCircle className="w-5 h-5 text-[#ef4444]" /><span className="font-hud-mono text-xs tracking-widest text-[#ef4444]">NO MATCH IN DATABASE</span></div>
            <p className="text-sm text-[#cae8ff] mt-3">{result.formatted_result}</p>
          </HudPanel>
        ))}
      </div>
      <div className="space-y-4">
        <MonoLabel className="block">Database Stats</MonoLabel>
        <StatBlock value={stats?.total_people ?? '—'} label="Known People" />
        <StatBlock value={stats?.matches ?? '—'} label="Total Matches" accent="#fbbf24" />
        <StatBlock value={stats ? `${Math.round((stats.accuracy ?? 0) * 100)}%` : '—'} label="Accuracy" />
      </div>
    </div>
  );
}

// ── Scene tab ──────────────────────────────────────────────────────────────
function SceneTab() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VisionResults | null>(null);
  const [history, setHistory] = useState<VisionHistoryItem[]>([]);

  const refresh = () =>
    fetch('/api/vision/history').then((r) => r.json()).then((r) => setHistory(r.history ?? [])).catch(() => {});

  useEffect(() => { refresh(); }, []);

  const onFile = async (file: File, url: string) => {
    setPreview(url);
    setResults(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/vision/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      setResults(data.results ?? data);
      refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {!preview ? (
            <UploadZone onFile={onFile} label="Drop an image to analyze" />
          ) : (
            <>
              <HudPanel className="p-0 overflow-hidden"><img src={preview} alt="analysis" className="w-full max-h-96 object-cover" /></HudPanel>
              <button onClick={() => { setPreview(null); setResults(null); }} className="font-hud-mono text-xs tracking-widest text-[#4a7fa0] hover:text-[#00d4ff]">‹ ANALYZE ANOTHER</button>
            </>
          )}
        </div>
        <HudPanel>
          <MonoLabel className="block mb-3">Analysis</MonoLabel>
          {loading && <ScanLoader />}
          {!loading && !results && <p className="text-sm text-[#4a7fa0]">Upload an image to begin analysis.</p>}
          {results && !loading && (
            <div className="space-y-4 jv-fadeup">
              <p className="text-sm text-[#cae8ff]">{results.description}</p>
              <div>
                <MonoLabel className="block mb-2">Detected Objects</MonoLabel>
                <div className="flex flex-wrap gap-2">
                  {results.objects.map((o) => <span key={o} className="font-hud-mono text-[11px] px-2 py-1 border border-[rgba(0,180,255,0.25)] text-[#00d4ff]">{o}</span>)}
                </div>
              </div>
              <div className="flex gap-6">
                <div><MonoLabel className="block mb-1">Scene</MonoLabel><span className="text-sm text-[#cae8ff]">{results.scene_type}</span></div>
                <div><MonoLabel className="block mb-1">Mood</MonoLabel><span className="text-sm text-[#fbbf24]">{results.mood}</span></div>
              </div>
              <div>
                <MonoLabel className="block mb-2">Color Palette</MonoLabel>
                <div className="flex gap-2">
                  {results.colors.map((c) => (
                    <div key={c} className="flex flex-col items-center gap-1">
                      <div className="w-10 h-10 border border-[rgba(0,180,255,0.2)]" style={{ background: c }} />
                      <span className="font-hud-mono text-[8px] text-[#4a7fa0]">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </HudPanel>
      </div>
      <MonoLabel className="block mb-3">Analysis History</MonoLabel>
      <div className="space-y-3">
        {history.length === 0 && <MonoLabel>No history yet.</MonoLabel>}
        {history.map((h) => (
          <HudPanel key={h.id} className="flex items-center gap-4 py-3">
            {h.thumbnail && <img src={h.thumbnail} alt="" className="w-16 h-16 object-cover border border-[rgba(0,180,255,0.2)]" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#cae8ff] truncate">{h.description}</p>
              <span className="font-hud-mono text-[10px] text-[#4a7fa0]">{fmtTime(h.timestamp)}</span>
            </div>
          </HudPanel>
        ))}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Vision() {
  const [tab, setTab] = useState<Tab>('CAMERA');
  return (
    <div data-testid="vision-page">
      <PageHeader overline="Visual Intelligence Systems" title="VISION" />
      <div className="flex border-b border-[rgba(0,180,255,0.15)] mb-6">
        {(['CAMERA', 'FACE ID', 'SCENE'] as Tab[]).map((t) => (
          <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>
      {tab === 'CAMERA' && <CameraTab />}
      {tab === 'FACE ID' && <FaceIdTab />}
      {tab === 'SCENE' && <SceneTab />}
    </div>
  );
}
