import type { BattleMode } from '../engine/types';

/**
 * REWARD SYSTEM TYPES
 * ===================
 * $GOLD only. No wallet, no chain, no token, no transfer - a reward is a
 * number added to a local balance and recorded in a local ledger.
 */

/** Which reward table to read. VS BOT and PvP are priced separately. */
export type RewardMode = 'vsBot' | 'pvp';

/** How the local player (combatant A) finished. */
export type RewardResult = 'VICTORY' | 'DEFEAT' | 'DRAW';

/** Reward table for one mode, keyed by the three possible outcomes. */
export type RewardTable = Record<'victory' | 'defeat' | 'draw', number>;

export type RewardConfig = Record<RewardMode, RewardTable>;

/** The settlement identity: one reward per battle per player, ever. */
export type RewardIdentity = {
  battleId: string;
  playerId: string;
};

/** Everything the Reward Engine needs. Nothing else. */
export type RewardRequest = RewardIdentity & {
  mode: BattleMode;
  result: RewardResult;
  /** Supplied by the caller so the engine itself stays free of a clock. */
  createdAt: number;
};

/** One recorded $GOLD payout. */
export type GoldTransaction = {
  transactionId: string;
  playerId: string;
  battleId: string;
  mode: BattleMode;
  result: RewardResult;
  amount: number;
  createdAt: number;
};

export type RewardOutcome = {
  /** GRANTED on the first call, ALREADY_SETTLED on every later one. */
  status: 'GRANTED' | 'ALREADY_SETTLED';
  /** `battleId + playerId`, the anti-duplicate key. */
  settlementKey: string;
  amount: number;
  transaction: GoldTransaction;
};
