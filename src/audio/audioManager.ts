import { getAssetUrl } from '../assets/resolve';
import type { AssetId } from '../assets/types';

/**
 * Tiny SFX / music player built on the global asset registry.
 * A missing audio file degrades to silence instead of throwing.
 */
class AudioManager {
  private currentMusic: HTMLAudioElement | null = null;
  private muted = false;
  private musicEnabled = true;
  private lastMusic: AssetId | null = null;

  setMuted = (muted: boolean): void => {
    this.muted = muted;
    if (muted) this.stopMusic();
  };

  isMuted = (): boolean => this.muted;

  setMusicEnabled = (enabled: boolean): void => {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else if (this.lastMusic && !this.muted) {
      this.playMusic(this.lastMusic);
    }
  };

  playSfx = (assetId: AssetId, volume = 0.6): void => {
    if (this.muted || typeof Audio === 'undefined') return;
    try {
      const audio = new Audio(getAssetUrl(assetId));
      audio.volume = volume;
      void audio.play().catch(() => undefined);
    } catch {
      /* ignore */
    }
  };

  playMusic = (assetId: AssetId, volume = 0.25): void => {
    this.lastMusic = assetId;
    if (this.muted || !this.musicEnabled || typeof Audio === 'undefined') return;
    try {
      this.stopMusic();
      const audio = new Audio(getAssetUrl(assetId));
      audio.loop = true;
      audio.volume = volume;
      void audio.play().catch(() => undefined);
      this.currentMusic = audio;
    } catch {
      /* ignore */
    }
  };

  stopMusic = (): void => {
    try {
      this.currentMusic?.pause();
      this.currentMusic = null;
    } catch {
      /* ignore */
    }
  };
}

export const audio = new AudioManager();
