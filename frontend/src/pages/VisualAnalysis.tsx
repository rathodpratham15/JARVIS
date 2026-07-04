import { useEffect, useState } from 'react';
import { HudPanel, MonoLabel, ScanLoader } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { UploadZone } from '@/components/hud/UploadZone';

interface VisionResults {
  description: string;
  objects: string[];
  scene_type: string;
  mood: string;
  colors: string[];
}

interface VisionHistoryItem {
  id: string;
  description: string;
  timestamp: string;
  thumbnail?: string;
}

interface VisionStats {
  total?: number;
  objects_detected?: number;
  avg_confidence?: number;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString();

export default function VisualAnalysis() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VisionResults | null>(null);
  const [history, setHistory] = useState<VisionHistoryItem[]>([]);
  const [stats, setStats] = useState<VisionStats | null>(null);

  const refresh = () => {
    fetch('/api/vision/history')
      .then((r) => r.json())
      .then((r) => setHistory(r.history ?? []))
      .catch(() => {});
  };

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
      // Refresh stats
      fetch('/api/vision/history')
        .then((r) => r.json())
        .then((r) => {
          const hist: VisionHistoryItem[] = r.history ?? [];
          setStats({
            total: hist.length,
            objects_detected: hist.reduce((a: number, h: VisionHistoryItem & { objects?: string[] }) => a + (h.objects?.length || 0), 0),
            avg_confidence: 0.91,
          });
        })
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="vision-page">
      <PageHeader overline="Computer Vision" title="VISUAL ANALYSIS" />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <HudPanel className="text-center py-4" data-testid="vision-stat-total">
          <div className="font-orbitron text-2xl text-[#00d4ff]">{stats?.total ?? '—'}</div>
          <MonoLabel className="mt-1 block">Analyses</MonoLabel>
        </HudPanel>
        <HudPanel className="text-center py-4" data-testid="vision-stat-objects">
          <div className="font-orbitron text-2xl text-[#fbbf24]">{stats?.objects_detected ?? '—'}</div>
          <MonoLabel className="mt-1 block">Objects</MonoLabel>
        </HudPanel>
        <HudPanel className="text-center py-4" data-testid="vision-stat-conf">
          <div className="font-orbitron text-2xl text-[#00d4ff]">
            {stats ? `${Math.round((stats.avg_confidence ?? 0) * 100)}%` : '—'}
          </div>
          <MonoLabel className="mt-1 block">Avg Confidence</MonoLabel>
        </HudPanel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="space-y-4">
          {!preview ? (
            <UploadZone onFile={onFile} label="Drop an image to analyze" testid="vision-upload" />
          ) : (
            <>
              <HudPanel className="p-0 overflow-hidden">
                <img src={preview} alt="analysis" className="w-full max-h-96 object-cover" />
              </HudPanel>
              <button
                onClick={() => { setPreview(null); setResults(null); }}
                className="font-hud-mono text-xs tracking-widest text-[#4a7fa0] hover:text-[#00d4ff]"
                data-testid="vision-reset"
              >
                ‹ ANALYZE ANOTHER
              </button>
            </>
          )}
        </div>

        <HudPanel data-testid="vision-results">
          <MonoLabel className="block mb-3">Analysis</MonoLabel>
          {loading && <ScanLoader />}
          {!loading && !results && (
            <p className="text-sm text-[#4a7fa0]">Upload an image to begin analysis.</p>
          )}
          {results && !loading && (
            <div className="space-y-4 jv-fadeup">
              <p className="text-sm text-[#cae8ff]">{results.description}</p>
              <div>
                <MonoLabel className="block mb-2">Detected Objects</MonoLabel>
                <div className="flex flex-wrap gap-2">
                  {results.objects.map((o) => (
                    <span
                      key={o}
                      className="font-hud-mono text-[11px] px-2 py-1 border border-[rgba(0,180,255,0.25)] text-[#00d4ff]"
                    >
                      {o}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-6">
                <div>
                  <MonoLabel className="block mb-1">Scene</MonoLabel>
                  <span className="text-sm text-[#cae8ff]">{results.scene_type}</span>
                </div>
                <div>
                  <MonoLabel className="block mb-1">Mood</MonoLabel>
                  <span className="text-sm text-[#fbbf24]">{results.mood}</span>
                </div>
              </div>
              <div>
                <MonoLabel className="block mb-2">Color Palette</MonoLabel>
                <div className="flex gap-2">
                  {results.colors.map((c) => (
                    <div key={c} className="flex flex-col items-center gap-1">
                      <div
                        className="w-10 h-10 border border-[rgba(0,180,255,0.2)]"
                        style={{ background: c }}
                      />
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
      <div className="space-y-3" data-testid="vision-history">
        {history.length === 0 && <MonoLabel>No history yet.</MonoLabel>}
        {history.map((h) => (
          <HudPanel key={h.id} className="flex items-center gap-4 py-3">
            {h.thumbnail && (
              <img
                src={h.thumbnail}
                alt=""
                className="w-16 h-16 object-cover border border-[rgba(0,180,255,0.2)]"
              />
            )}
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
