import { MAX_ROUNDS } from '../data/balance';
import type { BattleMode } from '../engine/types';
import type { TradeOffer } from '../data/trade';
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
  /** Star tier per hero id (1-6). Missing heroes are 1 star. */
  heroStars?: Record<string, number>;
  /** Spare same-hero copies per hero id, as unique serial numbers. Fusion fuel. */
  heroCopies?: Record<string, number[]>;
  /** Unique serial number of the roster (main) instance per owned hero id. */
  heroSerials?: Record<string, number>;
  /** Monotonic counter that mints hero serial numbers. */
  heroSerialCounter?: number;
  goldBalance: number;
  /** Local BWAR balance moved by Mining and Trade; no chain or wallet exists. */
  bwarBalance: number;
  /** The single active mining hero and its immutable 24-hour session snapshot. */
  mining: MiningSession | null;
  /** Custom-price marketplace offers, including active and closed history. */
  tradeOffers?: TradeOffer[];
  createdAt: number;
  updatedAt: number;
};

/** One active 24-hour BWAR Mining session. Values are snapshotted on Equip. */
export type MiningSession = {
  heroId: string;
  hashrate: number;
  rewardAmount: number;
  startedAt: number;
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
