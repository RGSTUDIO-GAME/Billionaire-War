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
  free: false,
  priceInGold: 10000,
  skills: [],
  assets: elonmuskAssetIds,
};
