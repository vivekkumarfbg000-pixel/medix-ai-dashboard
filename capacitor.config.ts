import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pharmaassist.app',
  appName: 'PharmaAssist',
  webDir: 'dist',
  server: {
    // url: 'https://your-production-url.com', // UNCOMMENT AND SET THIS FOR LIVE UPDATES
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;
