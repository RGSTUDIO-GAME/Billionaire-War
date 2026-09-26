import { audio } from '../audio/audioManager';
import { musicIds, soundIds } from '../assets/manifest';
import type { AssetId } from '../assets/types';
import type { BattleEventType } from '../engine/events';

/**
 * AUDIO LAYER
 * ===========
 * Maps engine events to registered sound assets.
 *
 * Nothing outside this file names a sound. The battle flow hook only reports
 * what the engine did; this layer decides what that sounds like. If an asset
 * is missing the audio manager simply plays nothing, so a build without audio
 * degrades to silence instead of throwing.
 */
export type SoundCue = { asset: AssetId; volume: number };

const CUES: Record<string, SoundCue> = {
  FIGHT: { asset: soundIds.uiConfirm, volume: 0.6 },
  COUNTDOWN: { asset: soundIds.countdownTick, volume: 0.4 },
  ATTACK: { asset: soundIds.attackWhoosh, volume: 0.45 },
  HIT: { asset: soundIds.hit, volume: 0.55 },
  BLOCK: { asset: soundIds.block, volume: 0.5 },
  NO_ACTION: { asset: soundIds.uiSelect, volume: 0.25 },
  VICTORY: { asset: soundIds.victory, volume: 0.6 },
  DEFEAT: { asset: soundIds.defeat, volume: 0.6 },
  DRAW: { asset: soundIds.block, volume: 0.4 },
  CONFIRM: { asset: soundIds.uiConfirm, volume: 0.5 },
};

const isBlock = (type: string): boolean => type === 'BLOCK' || type.startsWith('BLOCK_');
const isAttack = (type: string): boolean => type.startsWith('ATTACK_');

/** The sound an event should play, or null when it is silent by design. */
export const soundForEvent = (type: BattleEventType): SoundCue | null => {
  if (isBlock(type)) return CUES.BLOCK;
  if (isAttack(type)) return CUES.ATTACK;
  return CUES[type] ?? null;
};

/**
 * Plays the cue for an event. Safe to call with null - states that have no
 * sound of their own stay silent instead of guessing.
 */
export const playEventCue = (type: BattleEventType | null): void => {
  if (!type) return;
  const cue = soundForEvent(type);
  if (cue) audio.playSfx(cue.asset, cue.volume);
};

/** The looping battle theme, started when a battle begins. */
export const BATTLE_MUSIC = musicIds.battleTheme;
