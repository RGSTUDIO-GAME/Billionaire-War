import type { HeroRarity } from './heroes/types';

/**
 * HERO FUSION AND STARS
 * =====================
 * Pure math for the star system. No storage, no UI.
 *
 * - Every owned hero instance carries a unique serial number: the roster
 *   (main) copy and every spare copy each have their own identity.
 * - Fusion burns spare copies of the SAME hero to raise its star tier.
 *   Each step doubles the material: 1, 2, 4, 8, 16. Lifting one hero from
 *   1 star to 6 stars therefore consumes 31 spares + the main hero itself,
 *   i.e. 32 copies of the same 1-star hero.
 * - Stars gate upgrades: a hero can only be levelled up to its tier cap.
 * - Each hero id has its own mint supply from its rarity, so
 *   floor(supply / 32) is the most 6-star heroes that id can ever produce.
 */

/** Lowest and highest star tiers. Heroes are born at 1 star. */
export const MIN_STARS = 1;
export const MAX_STARS = 6;

/** Highest level each star tier can reach. */
export const STAR_MAX_LEVEL: Record<number, number> = {
  1: 20,
  2: 35,
  3: 50,
  4: 65,
  5: 80,
  6: 100,
};

/** Initial per-hero mint supply, by rarity. */
export const RARITY_SUPPLY: Record<HeroRarity, number> = {
  common: 160_000,
  uncommon: 80_000,
  rare: 40_000,
  epic: 20_000,
  legendary: 5_000,
};

/** Same-hero 1-star copies needed to forge one 6-star hero. */
export const COPIES_PER_SIX_STAR = 32;

/** Most 6-star heroes a single hero id can ever produce. */
export const maxSixStarCount = (rarity: HeroRarity): number =>
  Math.floor((RARITY_SUPPLY[rarity] ?? 0) / COPIES_PER_SIX_STAR);

/** Sanitises anything into a star tier inside 1..6. */
export const clampStars = (stars: unknown): number =>
  typeof stars === 'number' && Number.isInteger(stars)
    ? Math.min(Math.max(stars, MIN_STARS), MAX_STARS)
    : MIN_STARS;

/** Star tier of one hero inside a stored star map. Unknown heroes are 1 star. */
export const heroStarsOf = (
  stars: Record<string, number> | undefined,
  heroId: string,
): number => clampStars(stars?.[heroId]);

/** Highest level a star tier may reach. */
export const maxLevelForStars = (stars: number): number =>
  STAR_MAX_LEVEL[clampStars(stars)] ?? STAR_MAX_LEVEL[MIN_STARS];

/**
 * Spare same-hero copies burned to lift `stars` one tier higher.
 * Null when the hero is already at 6 stars.
 */
export const fusionCostCopies = (stars: number): number | null => {
  const current = clampStars(stars);
  if (current >= MAX_STARS) return null;
  return 2 ** (current - MIN_STARS);
};

/** Spare copies burned in total to lift a hero from 1 star to 6 stars. */
export const totalFusionCostToMax = (): number => {
  let total = 0;
  for (let stars = MIN_STARS; stars < MAX_STARS; stars += 1) {
    total += fusionCostCopies(stars) ?? 0;
  }
  return total;
};

/** Serial numbers of the spare copies of one hero. Unknown heroes have none. */
export const heroCopiesOf = (
  copies: Record<string, number[]> | undefined,
  heroId: string,
): number[] => {
  const stored = copies?.[heroId];
  return Array.isArray(stored) ? [...stored] : [];
};

/**
 * Total instances in one hero's stack: the roster copy plus every spare.
 * Callers should only use this for an owned hero.
 */
export const heroStackCountOf = (
  copies: Record<string, number[]> | undefined,
  heroId: string,
): number => 1 + heroCopiesOf(copies, heroId).length;

/** Serial number of the roster (main) instance of one hero. Null when unknown. */
export const heroSerialOf = (
  serials: Record<string, number> | undefined,
  heroId: string,
): number | null => {
  const stored = serials?.[heroId];
  return typeof stored === 'number' && Number.isInteger(stored) && stored > 0 ? stored : null;
};

/** Grouped thousands for supply figures: 160000 -> "160,000". */
export const formatSupply = (amount: number): string => amount.toLocaleString('en-US');

/** Compact star glyphs: 3 -> "★★★☆☆☆". */
export const formatStars = (stars: number): string => {
  const current = clampStars(stars);
  return '★'.repeat(current) + '☆'.repeat(MAX_STARS - current);
};
