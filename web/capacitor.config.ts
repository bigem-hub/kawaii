import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kawaiilife.app',
  appName: 'KawaiiLife',
  webDir: 'dist',
  // Load the live Vercel deployment in the native WebView. This keeps all
  // API calls same-origin (https://kawaiilife.vercel.app/api/...) so auth,
  // CORS, and cookies behave exactly like the browser app — no app-code
  // changes needed. Requires network; the deployed SPA is the source of truth.
  server: {
    url: 'https://kawaiilife.vercel.app',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
  },
  android: {
    // allowBackup + network security handled by the generated manifest
  },
};

export default config;