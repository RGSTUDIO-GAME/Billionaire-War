import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { audio } from '../audio/audioManager';

export type SettingsState = {
  sfx: boolean;
  music: boolean;
  toggleSfx: () => void;
  toggleMusic: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      sfx: true,
      music: true,

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
    }),
    { name: 'billionaire-war:settings', version: 1 },
  ),
);
