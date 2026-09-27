import type { BodyPart } from '../data/balance';
import type { Hero } from '../data/heroes/types';
import { HERO_ASSET_KEYS, type HeroAssetKey, type HeroVisual } from './types';
import { getAssetUrl, getFallbackChain } from './resolve';
import { heroFrames } from './manifest';
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

/** Frame strip for a visual, in play order. Empty when the hero has none. */
export const heroFrameUrls = (hero: Hero, visual: HeroVisual): string[] => {
  const key: HeroAssetKey | null =
    visual.type === 'character'
      ? null
      : visual.type === 'attack'
        ? ATTACK_KEY[visual.part]
        : visual.type;
  if (!key) return [];
  const ids = heroFrames[hero.id]?.[key] ?? [];
  return ids.map(getAssetUrl).filter((url) => url.length > 0);
};

/** Warms the browser cache for every frame of a hero. Call on battle entry. */
export const prefetchHeroFrames = (hero: Hero): void => {
  const urls = new Set<string>();
  for (const key of HERO_ASSET_KEYS) {
    for (const id of heroFrames[hero.id]?.[key] ?? []) {
      const url = getAssetUrl(id);
      if (url) urls.add(url);
    }
  }
  for (const url of urls) {
    const image = new Image();
    image.src = url;
  }
};
