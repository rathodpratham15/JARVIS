import { Capacitor } from '@capacitor/core';

// When running as a native APK, relative /api calls need to hit the backend
// directly. We patch window.fetch once at startup so every existing call works.
export function setupNativeApi(backendUrl: string) {
  if (!Capacitor.isNativePlatform()) return;

  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      return orig(backendUrl + input, init);
    }
    return orig(input, init);
  };
}
