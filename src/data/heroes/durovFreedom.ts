import { durovFreedomAssetIds } from '../../assets/manifest';
import type { Hero } from './types';

export const DUROV_FREEDOM: Hero = {
  id: 'durov-freedom',
  name: 'DUROV FREEDOM',
  title: 'The Freedom Wing',
  bio: 'Unchained from fear, Pavel carries freedom’s blue flame into every battle.',
  hp: 1000,
  rarity: 'rare',
  free: true,
  priceInGold: null,
  skills: [],
  assets: durovFreedomAssetIds,
};
