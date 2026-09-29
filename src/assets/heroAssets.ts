import type { BodyPart } from '../data/balance';
import type { Hero } from '../data/heroes/types';
import { HERO_ASSET_KEYS, type HeroAssetKey, type HeroVisual } from './types';
import { getAssetUrl, getFallbackChain } from './resolve';
import { heroFrames, heroFxFrames, type HeroFxKind } from './manifest';
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

/* ------------------------------------------------------- attack cinema */

const fxUrls = (hero: Hero, kind: HeroFxKind): string[] => {
  const ids = heroFxFrames[hero.id]?.[kind] ?? [];
  return ids.map(getAssetUrl).filter((url) => url.length > 0);
};

/** The paper plane strip, in flight order. Empty when the hero has none. */
export const heroProjectileUrls = (hero: Hero): string[] => fxUrls(hero, 'projectile');

/** The impact burst strip, in blast order. Empty when the hero has none. */
export const heroExplosionUrls = (hero: Hero): string[] => fxUrls(hero, 'explosion');

/** True when the hero ships its own attack projectile plus impact. */
export const hasAttackFx = (hero: Hero): boolean =>
  heroProjectileUrls(hero).length > 0 && heroExplosionUrls(hero).length > 0;

/** Warms the browser cache for a hero's attack cinema. Call on battle entry. */
export const prefetchHeroFx = (hero: Hero): void => {
  for (const url of [...heroProjectileUrls(hero), ...heroExplosionUrls(hero)]) {
    const image = new Image();
    image.src = url;
  }
};

/**
 * Render scale for a hero visual.
 * Flat poses (victory, defeat) fill little of a square sprite box, so they
 * get a boost on top of the hero's own scale. Feet stay grounded through
 * `transform-origin: 50% 100%` in CSS.
 */
const POSE_SCALE: Partial<Record<HeroVisual['type'], number>> = {
  victory: 1.25,
  defeat: 1.35,
};

export const heroSpriteScale = (hero: Hero, visual: HeroVisual): number =>
  (hero.spriteScale ?? 1) * (POSE_SCALE[visual.type] ?? 1);

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
