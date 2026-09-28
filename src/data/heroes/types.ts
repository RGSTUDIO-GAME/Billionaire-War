import type { AssetId } from '../../assets/types';

export type HeroRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type HeroSkill = {
  id: string;
  name: string;
  description: string;
};

/**
 * A hero is pure DATA.
 *
 * The Battle Engine only ever reads `id`, `name` and `hp`.
 * Everything visual lives in `assets` as registered asset ids, so swapping
 * DUROV for a brand new hero never requires touching the engine.
 */
export type Hero = {
  id: string;
  name: string;
  title: string;
  bio: string;
  hp: number;
  rarity: HeroRarity;
  /** null => free hero, granted to every new player. */
  priceInGold: number | null;
  free: boolean;
  /** Empty for now. The engine reads skills from here when they exist. */
  skills: HeroSkill[];
  /** Render scale for the fighter sprite. 1 (or omitted) = same box as everyone. */
  spriteScale?: number;
  /** Idle frame interval in ms. Omitted = the shared animation tempo. */
  idleIntervalMs?: number;
  assets: {
    character: AssetId;
    idle: AssetId;
    attackHead: AssetId;
    attackBody: AssetId;
    attackArm: AssetId;
    attackLeg: AssetId;
    defense: AssetId;
    hit: AssetId;
    victory: AssetId;
    defeat: AssetId;
  };
};

/** Ownership is player state, derived - never stored on the hero. */
export type HeroOwnership = 'locked' | 'owned' | 'equipped';
