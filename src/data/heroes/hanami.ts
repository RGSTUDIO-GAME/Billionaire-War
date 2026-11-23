import { hanamiAssetIds } from '../../assets/manifest';
import type { Hero } from './types';

export const HANAMI: Hero = { id: 'hanami', name: 'HANAMI', title: 'The Blossom Fighter', bio: 'A graceful fighter who turns delicate beauty into focused strength.', hp: 1000, rarity: 'common', free: true, priceInGold: null, skills: [], spriteScale: 1, idleIntervalMs: 180, assets: hanamiAssetIds };
