/**
 * Central balance configuration.
 *
 * Every tunable rule of the game lives here so that the Battle Engine never
 * hardcodes a number. Change a value in this file and the whole game follows.
 */

export const BODY_PARTS = ['head', 'body', 'arm', 'leg'] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

/** Human readable labels for each body part. Presentation only. */
export const BODY_PART_LABELS: Record<BodyPart, string> = {
  head: 'HEAD',
  body: 'BODY',
  arm: 'ARM',
  leg: 'LEG',
};

/** Maximum number of rounds in a single battle. */
export const MAX_ROUNDS = 3;

/** Seconds available to pick one attack + one defense and confirm. */
export const SELECTION_TIME_SECONDS = 30;

/** Seconds for the 3 -> 2 -> 1 -> FIGHT countdown. */
export const COUNTDOWN_SECONDS = 3;

/** Damage of a successful attack, indexed by round number. */
export const ROUND_DAMAGE: Record<number, number> = {
  1: 200,
  2: 300,
  3: 500,
};

/** Starting currency for a brand new player. */
export const STARTING_GOLD = 1000;
export const STARTING_BWAR = 0;

/** One BWAR Mining cycle fills after exactly 24 hours. */
export const MINING_DURATION_MS = 24 * 60 * 60 * 1000;

/** Mining credits one character hashrate after each completed 10-minute block. */
export const HASHRATE_PERIOD_MS = 10 * 60 * 1000;

/**
 * Presentation timing only - none of these can change a result. They exist so
 * each beat of the battle is readable rather than instant.
 */
export const EXECUTION_BEAT_MS = 1400;
/** How long the round summary is held before the battle moves on. */
export const ROUND_SUMMARY_MS = 1800;
/** How long the "ROUND n / 3" banner is held before the pickers return. */
export const ROUND_BANNER_MS = 1400;
