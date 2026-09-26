import type { RewardConfig } from './types';

/**
 * REWARD CONFIGURATION
 * ====================
 * The single place reward amounts live. Every value is a PLACEHOLDER of 0 on
 * purpose: the amounts are a product decision, not a code decision.
 *
 * Changing a number here is the only edit needed to price the game - no logic
 * anywhere reads or hardcodes an amount. $BWAR is deliberately absent.
 */
export const rewardConfig: RewardConfig = {
  vsBot: {
    victory: 0,
    defeat: 0,
    draw: 0,
  },
  pvp: {
    victory: 0,
    defeat: 0,
    draw: 0,
  },
};
