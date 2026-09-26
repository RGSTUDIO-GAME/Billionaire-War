import type { BodyPart } from '../data/balance';
import type { Hero } from '../data/heroes/types';
import type { HeroVisual } from './types';
import { getFallbackChain } from './resolve';
import type { AssetId } from './types';

const ATTACK_KEY: Record<BodyPart, 'attackHead' | 'attackBody' | 'attackArm' | 'attackLeg'> = {
  head: 'attackHead',
  body: 'attackBody',
  arm: 'attackArm',
  leg: 'attackLeg',
};

/**
 * Maps a hero visual request to a registered asset id.
 * Hero data only ever stores asset ids, never file paths.
 */
export const resolveHeroAssetId = (hero: Hero, visual: HeroVisual): AssetId => {
  switch (visual.type) {
    case 'character':
      return hero.assets.character;
    case 'idle':
      return hero.assets.idle;
    case 'attack':
      return hero.assets[ATTACK_KEY[visual.part]];
    case 'defense':
      return hero.assets.defense;
    case 'hit':
      return hero.assets.hit;
    case 'victory':
      return hero.assets.victory;
    case 'defeat':
      return hero.assets.defeat;
  }
};

/** Full fallback chain (file -> fallbacks -> inline placeholder). */
export const heroAssetChain = (hero: Hero, visual: HeroVisual): string[] =>
  getFallbackChain(resolveHeroAssetId(hero, visual));
