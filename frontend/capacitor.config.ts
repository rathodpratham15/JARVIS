import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jarvis.app',
  appName: 'JARVIS',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // Web client ID used as serverClientId so the idToken is verifiable
      // by the backend (same client the /api/auth/google endpoint already uses)
      serverClientId: '363737081592-hhjhi9lsu7u6mfg02pqu48ii113bmj3v.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
