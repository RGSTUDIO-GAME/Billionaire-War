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

/**
 * How long a single attack / block animation is shown before the next
 * combatant acts. Presentation timing only, never affects the result.
 */
export const EXECUTION_BEAT_MS = 1400;
export const ROUND_SUMMARY_MS = 1800;
