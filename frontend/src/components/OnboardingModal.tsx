import { useState } from 'react';
import { apiFetch, storeTokens, getToken, getRefreshToken } from '../lib/api';

interface Props {
  onComplete: (displayName: string) => void;
}

export function OnboardingModal({ onComplete }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const display_name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!display_name) {
      setError('Please enter your name.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as any).error ?? 'Failed to save name.');
        return;
      }
      const data = await res.json();
      // Re-store new tokens so JWT contains the updated display_name
      const access = data.access_token ?? getToken() ?? '';
      const refresh = data.refresh_token ?? getRefreshToken() ?? '';
      if (access) storeTokens(access, refresh);
      onComplete(display_name);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1E] border border-[#3A3A3C] rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-semibold text-white mb-1">Welcome to JARVIS</h2>
        <p className="text-sm text-[#A1A1AA] mb-6">
          Tell us your name so JARVIS can personalise your experience and sign emails correctly.
        </p>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div>
            <label className="block text-xs text-[#A1A1AA] mb-1">First name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Pratham"
              autoFocus
              className="w-full bg-[#2C2C2E] text-white border border-[#3A3A3C] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6B6B6B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[#A1A1AA] mb-1">Last name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Rathod"
              className="w-full bg-[#2C2C2E] text-white border border-[#3A3A3C] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#6B6B6B] transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !firstName.trim()}
            className="w-full bg-white text-black font-medium py-2 rounded-lg text-sm hover:bg-[#E5E5E5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving…' : 'Get started'}
          </button>
        </form>
      </div>
    </div>
  );
}
