import { useEffect, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { HudPanel, MonoLabel, ScanLoader } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';

const EMOTION_COLORS: Record<string, string> = {
  Happy: '#22c55e',
  Calm: '#00d4ff',
  Excited: '#fbbf24',
  Sad: '#3b82f6',
  Angry: '#ef4444',
  Anxious: '#a855f7',
  Neutral: '#4a7fa0',
};

interface EmotionResult {
  emotion: string;
  sentiment: string;
  confidence: number;
  scores: Record<string, number>;
  text: string;
  timestamp: string;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString();

export default function EmotionAnalysis() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmotionResult | null>(null);
  const [history, setHistory] = useState<EmotionResult[]>([]);

  const loadHistory = () => {
    fetch('/api/analyze-emotion')
      .then((r) => r.json())
      .then((r) => setHistory(r.history ?? []))
      .catch(() => {});
  };

  useEffect(() => { loadHistory(); }, []);

  const analyze = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/analyze-emotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data: EmotionResult = await res.json();
      setResult(data);
      loadHistory();
    } finally {
      setLoading(false);
    }
  };

  const dominantColor = result ? EMOTION_COLORS[result.emotion] || '#00d4ff' : '#00d4ff';
  const sortedScores = result ? Object.entries(result.scores).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div data-testid="emotion-page">
      <PageHeader overline="Sentiment Engine" title="EMOTION ANALYSIS" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <HudPanel data-testid="emotion-input-panel">
          <MonoLabel className="block mb-3">Input Text</MonoLabel>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Enter text to analyze emotional tone..."
            data-testid="emotion-input"
            className="bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] placeholder:text-[#4a7fa0] resize-none"
          />
          <button
            onClick={analyze}
            disabled={loading}
            data-testid="emotion-analyze-button"
            className="mt-3 px-5 py-2 bg-[rgba(0,180,255,0.1)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.2)] disabled:opacity-40"
          >
            ANALYZE
          </button>
        </HudPanel>

        <HudPanel active={!!result} data-testid="emotion-result-panel">
          <MonoLabel className="block mb-3">Result</MonoLabel>
          {loading && <ScanLoader />}
          {!loading && !result && (
            <p className="text-sm text-[#4a7fa0]">Enter text and run analysis.</p>
          )}
          {result && !loading && (
            <div className="jv-fadeup">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="font-orbitron text-4xl jv-glow" style={{ color: dominantColor }}>
                  {result.emotion}
                </span>
                <span
                  className="font-hud-mono text-[10px] tracking-widest px-2 py-0.5 border"
                  style={{ color: dominantColor, borderColor: dominantColor }}
                >
                  {result.sentiment.toUpperCase()}
                </span>
              </div>
              <MonoLabel className="block mb-1">
                Confidence — {Math.round(result.confidence * 100)}%
              </MonoLabel>
              <div className="h-2 bg-[rgba(0,180,255,0.1)] w-full mb-5">
                <div
                  className="h-2"
                  style={{
                    width: `${result.confidence * 100}%`,
                    background: dominantColor,
                    boxShadow: `0 0 8px ${dominantColor}`,
                  }}
                />
              </div>
              <MonoLabel className="block mb-3">Emotion Spectrum</MonoLabel>
              <div className="space-y-2">
                {sortedScores.map(([emo, val]) => (
                  <div key={emo} className="flex items-center gap-3">
                    <span className="font-hud-mono text-[10px] w-16 text-[#9fc4e0]">{emo}</span>
                    <div className="flex-1 h-1.5 bg-[rgba(0,180,255,0.08)]">
                      <div
                        className="h-1.5"
                        style={{ width: `${val * 100}%`, background: EMOTION_COLORS[emo] || '#4a7fa0' }}
                      />
                    </div>
                    <span className="font-hud-mono text-[10px] w-8 text-right text-[#4a7fa0]">
                      {Math.round(val * 100)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </HudPanel>
      </div>

      <MonoLabel className="block mb-3">Recent Analyses</MonoLabel>
      <div className="space-y-3" data-testid="emotion-history">
        {history.length === 0 && <MonoLabel>No analyses yet.</MonoLabel>}
        {history.map((h, i) => (
          <HudPanel key={i} className="flex items-center justify-between gap-4 py-3">
            <p className="text-sm text-[#9fc4e0] truncate flex-1">{h.text}</p>
            <span
              className="font-orbitron text-sm shrink-0"
              style={{ color: EMOTION_COLORS[h.emotion] || '#00d4ff' }}
            >
              {h.emotion}
            </span>
            <span className="font-hud-mono text-[10px] text-[#4a7fa0] shrink-0">
              {fmtTime(h.timestamp)}
            </span>
          </HudPanel>
        ))}
      </div>
    </div>
  );
}
