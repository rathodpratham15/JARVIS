import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { api, storeTokens } from '../lib/api';
import { useJarvisStore } from '../store/useJarvisStore';

export function AuthScreen() {
  const { signIn } = useJarvisStore();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        if (!name.trim()) { setError('Name is required'); setSubmitting(false); return; }
        const { access_token, refresh_token, user } = await api.signup(name.trim(), email.trim(), password);
        storeTokens(access_token, refresh_token);
        // Trigger store update
        useJarvisStore.setState({ user });
        const [history, memories, contacts] = await Promise.all([
          api.getHistory(100),
          api.getMemories(),
          api.getContacts(),
        ]);
        useJarvisStore.setState({ history, memories, contacts });
      } else {
        await signIn(name, email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FFFFFF] dark:bg-[#212121] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#E5E5E5] dark:border-white/10 bg-[#F9F9F9] dark:bg-[#171717] p-7">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-[#6366f1] flex items-center justify-center text-white mb-4">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h1 className="font-display text-xl font-semibold text-[#171717] dark:text-[#F5F5F5]">
            {mode === 'login' ? 'Sign in to JARVIS' : 'Create your JARVIS account'}
          </h1>
          <p className="text-sm text-[#717171] dark:text-[#A1A1AA] mt-1">
            {mode === 'login'
              ? 'Access your conversations, memory, and contacts.'
              : 'Set up your personal assistant workspace.'}
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#717171] dark:text-[#A1A1AA] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder={mode === 'signup' ? 'Create a password' : 'Your password'}
              className="w-full rounded-xl border border-[#E5E5E5] dark:border-white/10 bg-[#FFFFFF] dark:bg-[#2A2A2A] px-3.5 py-2.5 text-sm text-[#171717] dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
            />
          </div>

          {error && (
            <div className="text-xs text-red-500 text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white font-medium text-sm py-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {submitting
              ? mode === 'login'
                ? 'Signing in…'
                : 'Creating account…'
              : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-[#717171] dark:text-[#A1A1AA]">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); }}
                className="text-[#6366f1] hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); }}
                className="text-[#6366f1] hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
