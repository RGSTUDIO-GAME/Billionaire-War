import type { RewardConfig } from './types';

/**
 * REWARD CONFIGURATION
 * ====================
 * The single place reward amounts live. Every $GOLD payout reads from here and
 * from nowhere else - changing a number below is the only edit needed to
 * re-price the game.
 *
 *   vsBot.victory / pvp.victory -> 1000  (a win is worth 1000 GOLD)
 *   defeat / draw               -> 0     (not priced yet)
 *
 * Losing or drawing currently pays nothing. That is a deliberate placeholder,
 * not a rule: set a number here and the game pays it with no code change.
 * $BWAR is deliberately absent.
 */
export const rewardConfig: RewardConfig = {
  vsBot: {
    victory: 1000,
    defeat: 0,
    draw: 0,
  },
  pvp: {
    victory: 1000,
    defeat: 0,
    draw: 0,
  },
};
