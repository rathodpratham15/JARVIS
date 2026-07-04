import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, User } from 'lucide-react';
import { HudPanel, MonoLabel, ScanLoader, StatBlock } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { UploadZone } from '@/components/hud/UploadZone';

interface FacePerson {
  name: string;
  relationship: string;
  notes?: string;
}

interface FaceResult {
  person: FacePerson | null;
  confidence: number;
  formatted_result: string;
}

interface FaceStats {
  total_people?: number;
  matches?: number;
  accuracy?: number;
}

export default function FaceRecognition() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FaceResult | null>(null);
  const [stats, setStats] = useState<FaceStats | null>(null);

  useEffect(() => {
    fetch('/api/face/statistics')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const onFile = async (file: File, url: string) => {
    setPreview(url);
    setResult(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/face/identify', { method: 'POST', body: formData });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  const matched = result?.person;
  const conf = result ? Math.round((result.confidence || 0) * 100) : 0;

  return (
    <div data-testid="face-page">
      <PageHeader overline="Biometric Identification" title="FACE RECOGNITION" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {!preview ? (
            <UploadZone onFile={onFile} label="Drop a face image to identify" testid="face-upload" />
          ) : (
            <HudPanel className="p-0 overflow-hidden">
              <img src={preview} alt="subject" className="w-full max-h-80 object-cover" />
            </HudPanel>
          )}
          {preview && (
            <button
              onClick={() => { setPreview(null); setResult(null); }}
              className="font-hud-mono text-xs tracking-widest text-[#4a7fa0] hover:text-[#00d4ff]"
              data-testid="face-reset"
            >
              ‹ UPLOAD ANOTHER
            </button>
          )}

          {loading && (
            <HudPanel>
              <MonoLabel className="block mb-3">Scanning facial geometry...</MonoLabel>
              <ScanLoader />
            </HudPanel>
          )}

          {result && !loading && (
            matched ? (
              <HudPanel active className="jv-fadeup" data-testid="face-result-match">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
                  <span className="font-hud-mono text-xs tracking-widest text-[#22c55e]">MATCH FOUND</span>
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 border border-[#00b4d8] flex items-center justify-center bg-[rgba(0,180,255,0.08)]">
                    <User className="w-7 h-7 text-[#00d4ff]" />
                  </div>
                  <div>
                    <div className="font-orbitron text-xl text-[#cae8ff]">{matched.name}</div>
                    <MonoLabel>{matched.relationship}</MonoLabel>
                  </div>
                </div>
                <MonoLabel className="block mb-1">Confidence — {conf}%</MonoLabel>
                <div className="h-2 bg-[rgba(0,180,255,0.1)] w-full">
                  <div
                    className="h-2 bg-[#00d4ff]"
                    style={{ width: `${conf}%`, boxShadow: '0 0 8px #00d4ff' }}
                  />
                </div>
                <div className="mt-4 font-hud-mono text-[11px] text-[#4a7fa0]">{matched.notes}</div>
              </HudPanel>
            ) : (
              <HudPanel
                className="jv-fadeup"
                style={{ borderColor: '#ef4444' }}
                data-testid="face-result-nomatch"
              >
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-[#ef4444]" />
                  <span className="font-hud-mono text-xs tracking-widest text-[#ef4444]">
                    NO MATCH IN DATABASE
                  </span>
                </div>
                <p className="text-sm text-[#cae8ff] mt-3">{result.formatted_result}</p>
              </HudPanel>
            )
          )}
        </div>

        <div className="space-y-4">
          <MonoLabel className="block">Database Stats</MonoLabel>
          <StatBlock value={stats?.total_people ?? '—'} label="Known People" testid="face-stat-people" />
          <StatBlock
            value={stats?.matches ?? '—'}
            label="Total Matches"
            accent="#fbbf24"
            testid="face-stat-matches"
          />
          <StatBlock
            value={stats ? `${Math.round((stats.accuracy ?? 0) * 100)}%` : '—'}
            label="Accuracy"
            testid="face-stat-accuracy"
          />
        </div>
      </div>
    </div>
  );
}
