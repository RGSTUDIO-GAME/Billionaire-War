import { gracychenAssetIds } from '../../assets/manifest';
import type { Hero } from './types';

/**
 * GRACYCHEN - the third hero, a premium Legendary fighter riding her dino.
 * Same engine, same rules as every hero; only data and art differ.
 */
export const GRACYCHEN: Hero = {
  id: 'gracychen',
  name: 'GRACY CHEN',
  title: 'The Dino Rider',
  bio: 'Building the future of Web3, one block at a time. - Gracy Chen, CEO of Bitget',
  hp: 1000,
  rarity: 'legendary',
  // TEST PHASE: free so the owner can equip it now, same as Elonmusk.
  free: true,
  priceInGold: null,
  skills: [],
  assets: gracychenAssetIds,
};
