import { effectIds } from './manifest';
import type { AssetId } from './types';
import type { Hero } from '../data/heroes/types';
import type { BattleEvent, BattleEventType } from '../engine/events';
import type { HeroVisual } from './types';

/**
 * ANIMATION CONTROLLER
 * ===================
 * The Battle Engine emits events such as ATTACK_HEAD. This module decides what
 * those events LOOK like.
 *
 * The engine never names a hero, a file or an asset id, so a new hero can have
 * completely different art without touching a line of engine code. Every
 * lookup goes through hero data, and every result comes from the registered
 * asset chain, so a missing file falls back instead of crashing.
 */

/** Battle event -> hero visual. */
export const eventToVisual = (event: BattleEvent): HeroVisual => {
  switch (event.type) {
    case 'ATTACK_HEAD':
      return { type: 'attack', part: 'head' };
    case 'ATTACK_BODY':
      return { type: 'attack', part: 'body' };
    case 'ATTACK_ARM':
      return { type: 'attack', part: 'arm' };
    case 'ATTACK_LEG':
      return { type: 'attack', part: 'leg' };
    case 'BLOCK_HEAD':
    case 'BLOCK_BODY':
    case 'BLOCK_ARM':
    case 'BLOCK_LEG':
    case 'BLOCK':
      return { type: 'defense' };
    case 'HIT':
      return { type: 'hit' };
    case 'DEFEAT':
      return { type: 'defeat' };
    case 'VICTORY':
      return { type: 'victory' };
    default:
      return { type: 'idle' };
  }
};

/** Battle event -> registered asset id, via hero data only. */
export const eventToAsset = (hero: Hero, event: BattleEvent): AssetId => {
  switch (event.type) {
    case 'ATTACK_HEAD':
      return hero.assets.attackHead;
    case 'ATTACK_BODY':
      return hero.assets.attackBody;
    case 'ATTACK_ARM':
      return hero.assets.attackArm;
    case 'ATTACK_LEG':
      return hero.assets.attackLeg;
    case 'BLOCK_HEAD':
    case 'BLOCK_BODY':
    case 'BLOCK_ARM':
    case 'BLOCK_LEG':
    case 'BLOCK':
      return hero.assets.defense;
    case 'HIT':
      return hero.assets.hit;
    case 'DEFEAT':
      return hero.assets.defeat;
    case 'VICTORY':
      return hero.assets.victory;
    case 'NO_ACTION':
    case 'DRAW':
      return hero.assets.idle;
    default:
      return hero.assets.idle;
  }
};

/** Battle event -> effect asset, or null when the event has no effect. */
export const eventToEffect = (event: BattleEvent): AssetId | null => {
  switch (event.type) {
    case 'HIT':
      return effectIds.hitSpark;
    case 'BLOCK_HEAD':
    case 'BLOCK_BODY':
    case 'BLOCK_ARM':
    case 'BLOCK_LEG':
    case 'BLOCK':
      return effectIds.blockShield;
    default:
      return null;
  }
};

/** Damage popup content. */
export const eventToLabel = (event: BattleEvent): string | null => {
  switch (event.type) {
    case 'HIT':
      return event.damage > 0 ? `HIT -${event.damage}` : 'HIT 0';
    case 'BLOCK_HEAD':
    case 'BLOCK_BODY':
    case 'BLOCK_ARM':
    case 'BLOCK_LEG':
    case 'BLOCK':
      return 'BLOCK 0';
    case 'NO_ACTION':
      return 'NO ACTION';
    default:
      return null;
  }
};

export type AnimationCue = {
  visual: HeroVisual;
  asset: AssetId;
  effect: AssetId | null;
  label: string | null;
  /** Drives the shake / lunce animation class. */
  motion: 'attack' | 'hit' | 'block' | 'none';
};

/** The complete visual instruction for one engine event. */
export const resolveCue = (hero: Hero, event: BattleEvent): AnimationCue => {
  const motion: AnimationCue['motion'] =
    event.type.startsWith('ATTACK')
      ? 'attack'
      : event.type === 'HIT'
        ? 'hit'
        : event.type.startsWith('BLOCK')
          ? 'block'
          : 'none';

  return {
    visual: eventToVisual(event),
    asset: eventToAsset(hero, event),
    effect: eventToEffect(event),
    label: eventToLabel(event),
    motion,
  };
};

/**
 * The pose a combatant holds between events. Uses hero data only, so a hero
 * without a dedicated idle asset still renders through the fallback chain.
 */
export const idleCue = (hero: Hero): AnimationCue => ({
  visual: { type: 'idle' },
  asset: hero.assets.idle,
  effect: null,
  label: null,
  motion: 'none',
});

/** Sanity list used by the docs and tests. */
export const ANIMATION_EVENTS: readonly BattleEventType[] = [
  'ATTACK_HEAD', 'ATTACK_BODY', 'ATTACK_ARM', 'ATTACK_LEG',
  'BLOCK_HEAD', 'BLOCK_BODY', 'BLOCK_ARM', 'BLOCK_LEG',
  'HIT', 'DEFEAT', 'VICTORY',
];
