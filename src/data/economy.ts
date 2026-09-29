import type { HeroRarity } from './heroes/types';

/**
 * HERO ECONOMY
 * ===========
 * Level and hashrate rules. Pure math only - no storage, no UI.
 *
 * - Every hero starts at Level 0 with 0 hashrate, except Legendary starts at 0.001.
 * - Upgrading from Lv X to Lv X+1 costs 100,000 x (X+1) $GOLD (linear).
 * - Lv0 -> Lv100 costs 505,000,000 $GOLD in total.
 * - Hashrate = base hashrate of the rarity x level (linear, BWAR/second).
 */

/** No hero can pass this level. */
export const MAX_HERO_LEVEL = 100;

/** Hashrate every Legendary hero earns before its first upgrade. */
export const LEGENDARY_LEVEL_0_HASHRATE = 0.001;

/** Cost multiplier: Lv X -> Lv X+1 costs this times (X+1). */
export const UPGRADE_BASE_COST = 100_000;

/** BWAR per second granted by a single level, per rarity. */
export const BASE_HASHRATE: Record<HeroRarity, number> = {
  common: 0.000001,
  uncommon: 0.00001,
  rare: 0.0001,
  epic: 0.001,
  legendary: 0.01,
};

/** Sanitises anything into a usable level: an integer inside 0..MAX. */
export const clampHeroLevel = (level: unknown): number =>
  typeof level === 'number' && Number.isInteger(level)
    ? Math.min(Math.max(level, 0), MAX_HERO_LEVEL)
    : 0;

/** $GOLD price of going from `fromLevel` to the next level. Null at max. */
export const upgradeCost = (fromLevel: number): number | null =>
  !Number.isInteger(fromLevel) || fromLevel < 0 || fromLevel >= MAX_HERO_LEVEL
    ? null
    : UPGRADE_BASE_COST * (fromLevel + 1);

/** $GOLD price of climbing from `fromLevel` (inclusive) to `toLevel` (exclusive). */
export const totalUpgradeCost = (fromLevel: number, toLevel: number): number => {
  let total = 0;
  for (let level = Math.max(0, fromLevel); level < Math.min(toLevel, MAX_HERO_LEVEL); level += 1) {
    total += UPGRADE_BASE_COST * (level + 1);
  }
  return total;
};

/** BWAR per second a hero of this rarity and level mines. */
export const hashrateFor = (rarity: HeroRarity, level: number): number => {
  const currentLevel = clampHeroLevel(level);
  if (rarity === 'legendary' && currentLevel === 0) return LEGENDARY_LEVEL_0_HASHRATE;
  return (BASE_HASHRATE[rarity] ?? 0) * currentLevel;
};

/** Level of one hero inside a stored level map. Unknown heroes are Level 0. */
export const heroLevelOf = (levels: Record<string, number> | undefined, heroId: string): number =>
  clampHeroLevel(levels?.[heroId]);

/** Grouped thousands for $GOLD amounts: 1000000 -> "1,000,000". */
export const formatGold = (amount: number): string => amount.toLocaleString('en-US');

/** Compact rate without trailing noise: 0.01 -> "0.01", 0.000001 -> "0.000001". */
export const formatHashrate = (value: number): string => {
  if (value === 0) return '0';
  return String(Number(value.toFixed(6)));
};
