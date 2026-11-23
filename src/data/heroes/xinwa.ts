import { xinwaAssetIds } from '../../assets/manifest';
import type { Hero } from './types';

export const XINWA: Hero = { id: 'xinwa', name: 'XINWA', title: 'The Common Warrior', bio: 'A determined warrior who never backs down from a challenge.', hp: 1000, rarity: 'common', free: true, priceInGold: null, skills: [], spriteScale: 1, idleIntervalMs: 180, assets: xinwaAssetIds };
