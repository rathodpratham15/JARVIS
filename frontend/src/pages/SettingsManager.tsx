import { type ReactNode, useEffect, useState } from 'react';
import { Eye, EyeOff, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HudPanel, MonoLabel, SectionDivider } from '@/components/hud/Hud';
import { PageHeader } from '@/components/hud/PageHeader';
import { hudToast } from '@/lib/hudToast';

interface Settings {
  theme: string;
  default_language: string;
  voice_enabled: boolean;
  tts_voice: string;
  stt_engine: string;
  ha_url: string;
  ha_token: string;
  privacy_mode: boolean;
}

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-4 py-2">
    <MonoLabel>{label}</MonoLabel>
    {children}
  </div>
);

export default function SettingsManager() {
  const [s, setS] = useState<Settings | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/settings')
      .then((r) => r.json())
      .then(setS)
      .catch(() => {});
  }, []);

  const set = (key: keyof Settings, value: Settings[keyof Settings]) =>
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      await fetch('/api/dashboard/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      });
      hudToast.success('SETTINGS SAVED');
    } catch {
      hudToast.error('ERROR');
    } finally {
      setSaving(false);
    }
  };

  if (!s) return null;

  return (
    <div data-testid="settings-page">
      <PageHeader overline="Configuration" title="SETTINGS" />

      <div className="space-y-5 max-w-3xl">
        <HudPanel data-testid="settings-general">
          <SectionDivider label="General" />
          <Row label="Dark Theme">
            <Switch
              checked={s.theme === 'dark'}
              onCheckedChange={(v) => set('theme', v ? 'dark' : 'light')}
              data-testid="setting-theme"
              className="data-[state=checked]:bg-[#00b4d8]"
            />
          </Row>
          <Row label="Default Language">
            <Select value={s.default_language} onValueChange={(v) => set('default_language', v)}>
              <SelectTrigger
                className="w-44 bg-[#03101f] border-[rgba(0,180,255,0.2)] font-hud-mono text-xs"
                data-testid="setting-language"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#071228] border-[rgba(0,180,255,0.2)] text-[#cae8ff]">
                <SelectItem value="en-US">English (US)</SelectItem>
                <SelectItem value="en-GB">English (UK)</SelectItem>
                <SelectItem value="es-ES">Español</SelectItem>
                <SelectItem value="fr-FR">Français</SelectItem>
                <SelectItem value="de-DE">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </HudPanel>

        <HudPanel data-testid="settings-voice">
          <SectionDivider label="Voice" />
          <Row label="Voice Enabled">
            <Switch
              checked={s.voice_enabled}
              onCheckedChange={(v) => set('voice_enabled', v)}
              data-testid="setting-voice-enabled"
              className="data-[state=checked]:bg-[#00b4d8]"
            />
          </Row>
          <Row label="TTS Voice Name">
            <Input
              value={s.tts_voice}
              onChange={(e) => set('tts_voice', e.target.value)}
              data-testid="setting-tts-voice"
              className="w-56 bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] font-hud-mono text-xs"
            />
          </Row>
          <Row label="STT Engine">
            <Select value={s.stt_engine} onValueChange={(v) => set('stt_engine', v)}>
              <SelectTrigger
                className="w-44 bg-[#03101f] border-[rgba(0,180,255,0.2)] font-hud-mono text-xs"
                data-testid="setting-stt-engine"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#071228] border-[rgba(0,180,255,0.2)] text-[#cae8ff]">
                <SelectItem value="whisper">Whisper</SelectItem>
                <SelectItem value="google">Google STT</SelectItem>
                <SelectItem value="vosk">Vosk (offline)</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </HudPanel>

        <HudPanel data-testid="settings-smarthome">
          <SectionDivider label="Smart Home" />
          <Row label="Home Assistant URL">
            <Input
              value={s.ha_url}
              onChange={(e) => set('ha_url', e.target.value)}
              data-testid="setting-ha-url"
              className="w-64 bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] font-hud-mono text-xs"
            />
          </Row>
          <Row label="Home Assistant Token">
            <div className="flex items-center gap-2">
              <Input
                type={showToken ? 'text' : 'password'}
                value={s.ha_token}
                onChange={(e) => set('ha_token', e.target.value)}
                placeholder="••••••••"
                data-testid="setting-ha-token"
                className="w-52 bg-[#03101f] border-[rgba(0,180,255,0.2)] text-[#cae8ff] font-hud-mono text-xs"
              />
              <button
                onClick={() => setShowToken((v) => !v)}
                data-testid="toggle-token-visibility"
                className="text-[#4a7fa0] hover:text-[#00d4ff]"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Row>
        </HudPanel>

        <HudPanel data-testid="settings-privacy">
          <SectionDivider label="Privacy" />
          <Row label="Privacy Mode">
            <Switch
              checked={s.privacy_mode}
              onCheckedChange={(v) => set('privacy_mode', v)}
              data-testid="setting-privacy"
              className="data-[state=checked]:bg-[#00b4d8]"
            />
          </Row>
        </HudPanel>

        <button
          onClick={save}
          disabled={saving}
          data-testid="settings-save-button"
          className="flex items-center gap-2 px-6 py-3 bg-[rgba(0,180,255,0.12)] border border-[#00b4d8] text-[#00d4ff] font-hud-mono text-xs tracking-widest hover:bg-[rgba(0,180,255,0.22)] disabled:opacity-40"
        >
          <Save className="w-4 h-4" /> SAVE SETTINGS
        </button>
      </div>
    </div>
  );
}
