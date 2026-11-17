import { akiraAssetIds } from '../../assets/manifest';
import type { Hero } from './types';

export const AKIRA: Hero = {
  id: 'akira',
  name: 'AKIRA',
  title: 'The Beach Volleyball Ace',
  bio: 'A fearless beach volleyball athlete who turns every serve into a crashing wave.',
  hp: 1000,
  rarity: 'legendary',
  free: true,
  priceInGold: null,
  skills: [],
  spriteScale: 1,
  idleIntervalMs: 180,
  assets: akiraAssetIds,
};
