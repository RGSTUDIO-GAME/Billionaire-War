import { MAX_ROUNDS } from '../data/balance';
import type { BattleMode } from '../engine/types';
import type { RewardResult } from '../rewards/types';

/**
 * PERSISTED RECORDS
 * =================
 * The shapes that survive a reload. These are the game database; the UI only
 * ever reads them.
 */

/** The player profile: the single source of truth for who the player is. */
export type PlayerProfile = {
  /** Bumped when the shape changes, so a migration can be told apart from corruption. */
  version: number;
  playerId: string;
  username: string;
  equippedHeroId: string;
  ownedHeroes: string[];
  /** Hero level per hero id. Missing heroes are Level 0. */
  heroLevels: Record<string, number>;
  goldBalance: number;
  /** Display-only utility counter. No transaction ever moves it. */
  bwarBalance: number;
  createdAt: number;
  updatedAt: number;
};

/**
 * One $GOLD movement. Balances are recorded on the entry itself so the ledger
 * can be audited - and so a corrupted balance can be rebuilt from history.
 */
export type GoldTransaction = {
  transactionId: string;
  playerId: string;
  /** GRANT pays out, SPEND takes out, BATTLE_REWARD is the payout from a battle. */
  kind: 'BATTLE_REWARD' | 'GRANT' | 'SPEND';
  /** The battle this money came from. Null for anything not earned in battle. */
  battleId: string | null;
  mode: BattleMode | null;
  result: RewardResult | null;
  /** Signed: +1000 for a reward, -200 for a purchase. */
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: number;
};

/** The archived outcome of a finished battle. */
export type BattleRecord = {
  battleId: string;
  playerId: string;
  mode: BattleMode;
  result: RewardResult;
  finalHp: number;
  opponentFinalHp: number;
  roundsPlayed: number;
  completedAt: number;
};

export const MAX_LEDGER_ENTRIES = 200;
export const MAX_BATTLE_RECORDS = 50;
export const MAX_ROUNDS_PLAYED = MAX_ROUNDS;
