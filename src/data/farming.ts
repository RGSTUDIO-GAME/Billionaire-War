export type FarmTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type FarmCurrency = 'GOLD' | 'BWAR';

export type FarmSeed = {
  tier: FarmTier;
  label: string;
  symbol: string;
  harvestXp: number;
  harvestBwar: number;
  price: number;
  currency: FarmCurrency;
  color: string;
};

export const FARM_SEEDS: FarmSeed[] = [
  { tier: 'common', label: '$GRAM', symbol: '🌱', harvestXp: 10, harvestBwar: 0, price: 1000, currency: 'GOLD', color: '#a7e06f' },
  { tier: 'uncommon', label: '$DOGE', symbol: '🌿', harvestXp: 20, harvestBwar: 10, price: 9, currency: 'BWAR', color: '#71d7a0' },
  { tier: 'rare', label: '$SOLANA', symbol: '🌷', harvestXp: 40, harvestBwar: 20, price: 18, currency: 'BWAR', color: '#65b7ff' },
  { tier: 'epic', label: '$BNB', symbol: '🌻', harvestXp: 80, harvestBwar: 40, price: 36, currency: 'BWAR', color: '#bf91ff' },
  { tier: 'legendary', label: '$ETH', symbol: '🌳', harvestXp: 160, harvestBwar: 80, price: 72, currency: 'BWAR', color: '#ffb15e' },
  { tier: 'mythic', label: '$BITCOIN', symbol: '🌲', harvestXp: 320, harvestBwar: 160, price: 144, currency: 'BWAR', color: '#ffcf4c' },
];

export const FARM_PLOT_COUNT = 50;
export const FARM_GROWTH_MS = 12_000;

export const farmSeed = (tier: FarmTier) => FARM_SEEDS.find((seed) => seed.tier === tier) ?? FARM_SEEDS[0];

