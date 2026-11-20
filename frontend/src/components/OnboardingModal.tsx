import React, { useState } from 'react';
import { apiFetch, storeTokens } from '../lib/api';

interface Props {
  onComplete: (displayName: string) => void;
}

const USE_CASES = ['Work', 'Personal', 'Both'];

const CAPABILITIES = [
  'Send emails and manage your calendar',
  'Answer questions and search the web',
  'Set reminders, timers, and take notes',
];

const STEPS = 4;

export function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [useCase, setUseCase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const goNext = () => setStep((s) => s + 1);

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    setError('');
    goNext();
  };

  const saveProfile = async () => {
    const res = await apiFetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        use_case: useCase,
      }),
    });
    const data = await res.json() as { access_token?: string; refresh_token?: string };
    if (data.access_token) {
      storeTokens(data.access_token, data.refresh_token ?? '');
    }
    return data;
  };

  const handleConnectGoogle = () => {
    void saveProfile().then(() => {
      void apiFetch('/api/google/connect').then(async (r) => {
        const d = await r.json() as { auth_url?: string };
        if (d.auth_url) window.location.href = d.auth_url;
      });
    });
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');
    try {
      await saveProfile();
      const display = `${firstName.trim()} ${lastName.trim()}`.trim();
      onComplete(display);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141414]">
      <div className="w-full max-w-md px-6">

        <div className="flex justify-center gap-2 mb-10">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-6 h-2 bg-white'
                  : i < step
                  ? 'w-2 h-2 bg-white/60'
                  : 'w-2 h-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <form onSubmit={handleStep1} className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#A1A1AA] mb-3">Step 1 of 4</p>
              <h1 className="text-2xl font-semibold text-white mb-2">What's your name?</h1>
              <p className="text-sm text-[#71717A]">
                JARVIS will use this to personalise responses and sign emails on your behalf.
              </p>
            </div>
            <div className="space-y-3">
              <input
                autoFocus
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setError(''); }}
                placeholder="First name"
                className="w-full bg-[#1C1C1C] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-white/30 text-sm"
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name (optional)"
                className="w-full bg-[#1C1C1C] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-[#555] focus:outline-none focus:border-white/30 text-sm"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              className="w-full bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-white/90 transition-colors"
            >
              Continue
            </button>
          </form>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#A1A1AA] mb-3">Step 2 of 4</p>
              <h1 className="text-2xl font-semibold text-white mb-2">How will you use JARVIS?</h1>
              <p className="text-sm text-[#71717A]">This helps JARVIS tailor its tone and suggestions.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {USE_CASES.map((uc) => (
                <button
                  key={uc}
                  type="button"
                  onClick={() => setUseCase(uc === useCase ? '' : uc)}
                  className={`px-5 py-2.5 rounded-full border text-sm font-medium transition-all ${
                    useCase === uc
                      ? 'bg-white text-black border-white'
                      : 'bg-transparent text-white border-white/20 hover:border-white/40'
                  }`}
                >
                  {uc}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={goNext}
                className="w-full bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-white/90 transition-colors"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={goNext}
                className="w-full text-[#71717A] text-sm hover:text-white transition-colors py-1"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#A1A1AA] mb-3">Step 3 of 4</p>
              <h1 className="text-2xl font-semibold text-white mb-2">Connect Google</h1>
              <p className="text-sm text-[#71717A]">
                Give JARVIS access to Gmail, Calendar and Drive so it can send emails, manage events and find files.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-white/90 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                <path fill="#4285F4" d="M43.6 20H24v8h11.3C33.9 32.7 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
              </svg>
              Connect Google Account
            </button>
            <button
              type="button"
              onClick={goNext}
              className="w-full text-[#71717A] text-sm hover:text-white transition-colors py-1"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#A1A1AA] mb-3">All set</p>
              <h1 className="text-2xl font-semibold text-white mb-2">
                JARVIS is ready{firstName ? `, ${firstName}` : ''}.
              </h1>
              <p className="text-sm text-[#71717A] mb-6">Here's what you can do right now:</p>
              <ul className="space-y-3">
                {CAPABILITIES.map((cap) => (
                  <li key={cap} className="flex items-start gap-3 text-sm text-[#A1A1AA]">
                    <span className="text-white mt-0.5">✦</span>
                    {cap}
                  </li>
                ))}
              </ul>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="button"
              onClick={() => { void handleFinish(); }}
              disabled={loading}
              className="w-full bg-white text-black font-semibold rounded-xl py-3 text-sm hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Setting up…' : 'Start chatting →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
