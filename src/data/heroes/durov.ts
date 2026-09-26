import { heroAssetIds } from '../../assets/manifest';
import type { Hero } from './types';

/**
 * DUROV - the first hero, used to validate the battle system.
 * Nothing in the code base is specific to DUROV; he is data like any other.
 */
export const DUROV: Hero = {
  id: 'durov',
  name: 'DUROV',
  title: 'The Iron Heir',
  bio: 'A disciplined heavyweight who trades nothing he does not choose to give.',
  hp: 1000,
  rarity: 'common',
  free: true,
  priceInGold: null,
  skills: [],
  assets: heroAssetIds,
};
