import { DUROV } from './durov';
import { ELONMUSK } from './elonmusk';
import type { Hero, HeroOwnership } from './types';

/**
 * HERO REGISTRY
 * =============
 * To add a hero:
 *   1. add /public/assets/heroes/<hero_id>/*.svg (or .png, see docs/ASSETS.md)
 *   2. call registerHeroAssets('<hero_id>') in src/assets/manifest.ts
 *   3. add a data file in src/data/heroes/<hero_id>.ts and list it below
 * The Battle Engine does not change.
 */
export const HEROES: readonly Hero[] = [DUROV, ELONMUSK];

export const getHeroById = (id: string): Hero | undefined =>
  HEROES.find((hero) => hero.id === id);

export const getFreeHeroes = (): Hero[] => HEROES.filter((hero) => hero.free);

export const getOwnedState = (hero: Hero, ownedIds: readonly string[], equippedId: string | null): HeroOwnership => {
  if (equippedId === hero.id) return 'equipped';
  return ownedIds.includes(hero.id) ? 'owned' : 'locked';
};

export type { Hero, HeroOwnership, HeroSkill, HeroRarity } from './types';
