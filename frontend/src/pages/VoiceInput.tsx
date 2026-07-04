import { useState } from 'react';
import { Mic, Volume2, Square } from 'lucide-react';
import { HudPanel, MonoLabel, ScanLoader } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

interface TranscriptEntry {
  text: string;
  time: string;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function VoiceInput() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [history, setHistory] = useState<TranscriptEntry[]>([]);
  const [speaking, setSpeaking] = useState(false);

  const toggleRecord = async () => {
    if (recording) {
      setRecording(false);
      setProcessing(true);
      try {
        // In a real implementation we'd pass the recorded blob.
        // For now send an empty multipart to trigger the endpoint.
        const formData = new FormData();
        const res = await fetch('/api/voice/transcribe', { method: 'POST', body: formData });
        const { text } = await res.json();
        setTranscript(text);
        setHistory((h) => [{ text, time: new Date().toISOString() }, ...h]);
        hudToast.success('TRANSCRIPTION COMPLETE');
      } finally {
        setProcessing(false);
      }
    } else {
      setRecording(true);
    }
  };

  const speak = async () => {
    if (!transcript || speaking) return;
    setSpeaking(true);
    try {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });
      const blob = await res.blob();
      const audio_url = URL.createObjectURL(blob);
      const audio = new Audio(audio_url);
      await audio.play().catch(() => {});
      hudToast.info('PLAYING RESPONSE');
    } finally {
      setTimeout(() => setSpeaking(false), 600);
    }
  };

  return (
    <div data-testid="voice-page">
      <PageHeader overline="Speech Processing" title="VOICE INPUT" />

      <div className="flex flex-col items-center justify-center py-12">
        <div className="relative w-40 h-40 flex items-center justify-center">
          {recording && (
            <>
              <span className="absolute inset-0 rounded-full border border-[#00d4ff] jv-ring" />
              <span
                className="absolute inset-0 rounded-full border border-[#00d4ff] jv-ring"
                style={{ animationDelay: '0.8s' }}
              />
            </>
          )}
          <button
            onClick={toggleRecord}
            disabled={processing}
            data-testid="mic-button"
            className="relative w-32 h-32 rounded-full flex items-center justify-center border-2 transition-all duration-300 disabled:opacity-50"
            style={{
              borderColor: recording ? '#ef4444' : '#00b4d8',
              background: recording ? 'rgba(239,68,68,0.1)' : 'rgba(0,180,255,0.08)',
              boxShadow: recording
                ? '0 0 30px rgba(239,68,68,0.4)'
                : '0 0 24px rgba(0,180,255,0.25)',
            }}
          >
            {recording ? (
              <Square className="w-10 h-10 text-[#ef4444]" />
            ) : (
              <Mic className="w-12 h-12 text-[#00d4ff]" />
            )}
          </button>
        </div>
        <MonoLabel className="mt-6">
          {processing
            ? 'PROCESSING AUDIO...'
            : recording
            ? 'LISTENING — TAP TO STOP'
            : 'TAP TO START RECORDING'}
        </MonoLabel>
        {processing && (
          <div className="w-64 mt-4">
            <ScanLoader />
          </div>
        )}
      </div>

      <HudPanel className="mb-6" data-testid="transcript-panel">
        <MonoLabel className="block mb-3">Transcript</MonoLabel>
        <p className="text-sm text-[#cae8ff] min-h-[2rem]">
          {transcript || <span className="text-[#4a7fa0]">No transcript yet.</span>}
        </p>
        <button
          onClick={speak}
          disabled={!transcript || speaking}
          data-testid="speak-button"
          className="mt-4 flex items-center gap-2 px-4 py-2 border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.1)] transition-colors disabled:opacity-40"
        >
          <Volume2 className="w-4 h-4" /> SPEAK RESPONSE
        </button>
      </HudPanel>

      <MonoLabel className="block mb-3">Transcript History</MonoLabel>
      <div className="space-y-3" data-testid="transcript-history">
        {history.length === 0 && <MonoLabel>No history recorded.</MonoLabel>}
        {history.map((h, i) => (
          <HudPanel key={i} className="flex items-start justify-between gap-4 py-3">
            <p className="text-sm text-[#cae8ff]">{h.text}</p>
            <span className="font-hud-mono text-[10px] text-[#4a7fa0] shrink-0">{fmtTime(h.time)}</span>
          </HudPanel>
        ))}
      </div>
    </div>
  );
}
