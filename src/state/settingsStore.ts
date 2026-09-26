import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { audio } from '../audio/audioManager';
import { isDebugEnabled, setDebugEnabled } from '../engine/debug';

export type SettingsState = {
  sfx: boolean;
  music: boolean;
  /** Battle engine debug logging + the in-battle debug panel. */
  debug: boolean;
  toggleSfx: () => void;
  toggleMusic: () => void;
  toggleDebug: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      sfx: true,
      music: true,
      // Defaults to on in development builds, off in production.
      debug: isDebugEnabled(),

      toggleSfx: () => {
        const next = !get().sfx;
        audio.setMuted(!next);
        set({ sfx: next });
      },

      toggleMusic: () => {
        const next = !get().music;
        audio.setMusicEnabled(next);
        set({ music: next });
      },

      toggleDebug: () => {
        const next = !get().debug;
        setDebugEnabled(next);
        set({ debug: next });
      },
    }),
    { name: 'billionaire-war:settings', version: 1 },
  ),
);
