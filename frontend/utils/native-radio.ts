import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface NativeRadioState {
  id: string;
  playing: boolean;
  playWhenReady: boolean;
  state: number;
  suppression: number;
  error?: string;
  title?: string;
  artist?: string;
}

interface NativeRadioPlugin {
  playSource(options: { id: string; url: string; title: string; artist: string; artwork: string; isHls: boolean }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  setVolume(options: { volume: number }): Promise<void>;
  setSleep(options: { minutes: number }): Promise<void>;
  resolvePlaylist(options: { url: string }): Promise<{ url: string; isHls: boolean }>;
  getState(): Promise<NativeRadioState>;
  addListener(event: 'state', listener: (state: NativeRadioState) => void): Promise<PluginListenerHandle>;
}

export const isAndroidApp = () => Capacitor.getPlatform() === 'android';
export const NativeRadio = registerPlugin<NativeRadioPlugin>('RadioAudio');
