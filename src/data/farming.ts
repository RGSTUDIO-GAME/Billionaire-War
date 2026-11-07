export type FarmTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type FarmSeed = {
  tier: FarmTier;
  label: string;
  symbol: string;
  harvestXp: number;
  harvestGold: number;
  price: number;
  growingHours: number;
  /** Optional short growth override for tutorial/early-game seeds. */
  growingMinutes?: number;
  color: string;
};
export type FarmPlot = { seed: FarmTier; plantedAt: number } | null;

export const FARM_SEEDS: FarmSeed[] = [
  { tier: 'common', label: '$GRAM', symbol: '🌱', harvestXp: 10, harvestGold: 1100, price: 1000, growingHours: 4, growingMinutes: 2, color: '#a7e06f' },
  { tier: 'uncommon', label: '$DOGE', symbol: '🌿', harvestXp: 20, harvestGold: 2500, price: 2000, growingHours: 8, growingMinutes: 10, color: '#71d7a0' },
  { tier: 'rare', label: '$SOLANA', symbol: '🌷', harvestXp: 40, harvestGold: 6000, price: 4000, growingHours: 12, color: '#65b7ff' },
  { tier: 'epic', label: '$BNB', symbol: '🌻', harvestXp: 80, harvestGold: 12000, price: 8000, growingHours: 16, color: '#bf91ff' },
  { tier: 'legendary', label: '$ETH', symbol: '🌳', harvestXp: 160, harvestGold: 24000, price: 16000, growingHours: 20, color: '#ffb15e' },
  { tier: 'mythic', label: '$BITCOIN', symbol: '🌲', harvestXp: 320, harvestGold: 48000, price: 32000, growingHours: 24, color: '#ffcf4c' },
];

export const FARM_PLOT_COUNT = 50;

export const farmSeed = (tier: FarmTier) => FARM_SEEDS.find((seed) => seed.tier === tier) ?? FARM_SEEDS[0];
