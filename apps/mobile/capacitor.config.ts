import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'dev.eplus.onair',
  appName: 'ePlus OnAir',
  webDir: '../../dist/web',
  bundledWebRuntime: false,
  ios: { contentInset: 'automatic' },
  android: { allowMixedContent: false }
};
export default config;
