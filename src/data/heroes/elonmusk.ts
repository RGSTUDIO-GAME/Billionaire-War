import { elonmuskAssetIds } from '../../assets/manifest';
import type { Hero } from './types';

/**
 * ELONMUSK - the second hero, a Legendary premium fighter.
 * Same engine, same rules as every hero; only data and art differ.
 */
export const ELONMUSK: Hero = {
  id: 'elonmusk',
  name: 'ELONMUSK',
  title: 'The Star Pioneer',
  bio: 'A relentless engineer taking humanity to the stars.',
  hp: 1000,
  rarity: 'legendary',
  // TEST PHASE: free so the owner can equip it now. Flip to event-only
  // (free: false, priceInGold: null) at launch if Trade should stop granting it.
  free: true,
  priceInGold: null,
  skills: [],
  assets: elonmuskAssetIds,
};
