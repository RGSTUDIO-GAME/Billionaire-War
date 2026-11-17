import { pociManGoldAssetIds } from '../../assets/manifest';
import type { Hero } from './types';

export const POCI_MAN_GOLD: Hero = {
  id: 'poci-man-gold',
  name: 'POCI MAN GOLD',
  title: 'The Golden Spirit',
  bio: 'A golden spirit forged from wealth, fire and relentless ambition.',
  hp: 1000,
  rarity: 'common',
  free: true,
  priceInGold: null,
  skills: [],
  spriteScale: 1,
  idleIntervalMs: 180,
  assets: pociManGoldAssetIds,
};
