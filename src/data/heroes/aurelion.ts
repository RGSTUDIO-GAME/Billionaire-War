import { aurelionAssetIds } from '../../assets/manifest';
import type { Hero } from './types';

export const AURELION: Hero = {
  id: 'aurelion',
  name: 'AURELION',
  title: 'The Bloodbound Mage',
  bio: 'Ancient magic flows through Aurelion’s veins.',
  hp: 1000,
  rarity: 'rare',
  free: true,
  priceInGold: null,
  skills: [
    {
      id: 'magic-in-my-blood',
      name: 'Magic in My Blood',
      description: 'Arcane magic stirs with every heartbeat.',
    },
  ],
  assets: aurelionAssetIds,
};
