import type { BodyPart } from '../data/balance';

export type AssetCategory = 'heroes' | 'backgrounds' | 'ui' | 'icons' | 'effects' | 'sounds' | 'music';

/** Logical id of a single registered asset. */
export type AssetId = string;

export type PlaceholderKind =
  | 'hero'
  | 'heroPose'
  | 'background'
  | 'icon'
  | 'ui'
  | 'effect'
  | 'audio';

export type AssetEntry = {
  id: AssetId;
  category: AssetCategory;
  /** File name inside /public/assets/<category>/. Swap the file, keep the id. */
  file: string;
  /** Used when the primary file is missing. */
  fallback?: AssetId;
  /** Inline artwork used when every file in the chain is missing. */
  placeholder: PlaceholderKind;
  label: string;
  /** False skips the entry in the startup prefetch (heavy frame strips). */
  preload?: boolean;
};

/** Semantic keys every hero must provide. */
export const HERO_ASSET_KEYS = [
  'character',
  'idle',
  'attackHead',
  'attackBody',
  'attackArm',
  'attackLeg',
  'defense',
  'hit',
  'victory',
  'defeat',
] as const;

export type HeroAssetKey = (typeof HERO_ASSET_KEYS)[number];

/** What the presentation layer is currently asking a hero to show. */
export type HeroVisual =
  | { type: 'character' }
  | { type: 'idle' }
  | { type: 'attack'; part: BodyPart }
  | { type: 'defense' }
  | { type: 'hit' }
  | { type: 'victory' }
  | { type: 'defeat' };
