/**
 * Seeded PRNG (mulberry32).
 *
 * The Battle Engine itself never rolls dice. This exists so that anything
 * non-deterministic (today: the bot's pick) can still be replayed exactly
 * from a stored seed.
 */
export const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Picks one item deterministically from a list. */
export const pickOne = <T,>(rng: () => number, items: readonly T[]): T => {
  if (items.length === 0) throw new Error('pickOne: empty list');
  return items[Math.floor(rng() * items.length) % items.length];
};
