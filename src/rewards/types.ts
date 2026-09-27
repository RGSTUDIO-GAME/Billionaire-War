import type { BattleMode } from '../engine/types';
import type { GoldTransaction } from '../storage/records';

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

export type { GoldTransaction };

export type RewardOutcome = {
  /** GRANTED on the first call, ALREADY_SETTLED on every later one. */
  status: 'GRANTED' | 'ALREADY_SETTLED';
  /** `battleId + playerId`, the anti-duplicate key. */
  settlementKey: string;
  amount: number;
  /**
   * The payout. A bare `settle` returns the transaction it planned; the
   * coordinator replaces it with the one the ledger actually holds, so a
   * caller - granted or refused - always reads a real recorded entry.
   */
  transaction: GoldTransaction;
};

/** Overrides for tests and for callers that know the live balance. */
export type RewardSettleOptions = {
  config?: RewardConfig;
  /** The balance this payout is applied to, recorded on the transaction. */
  balance?: number;
};
