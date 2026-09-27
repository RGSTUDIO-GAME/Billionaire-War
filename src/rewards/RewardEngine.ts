import { rewardConfig } from './rewardConfig';
import type {
  GoldTransaction,
  RewardConfig,
  RewardMode,
  RewardOutcome,
  RewardRequest,
  RewardResult,
  RewardSettleOptions,
} from './types';
import type { BattleMode, BattleWinner } from '../engine/types';

/**
 * REWARD ENGINE
 * =============
 * Universal, pure and mode-aware. One engine serves both VS BOT and PvP; the
 * mode only selects which configured table is read.
 *
 *   mode + result -> config table -> amount -> transaction
 *
 * The engine never touches a balance, a store or the Battle Engine. It reads
 * the configuration, decides the amount, and reports what SHOULD be granted.
 * Applying it to the player is the coordinator's job.
 *
 * The Battle Engine knows nothing about this file: a battle cannot move a
 * balance, it can only produce a result.
 */

/** `bot` -> the vsBot table, `pvp` -> the pvp table. */
export const modeFor = (battleMode: BattleMode): RewardMode =>
  battleMode === 'bot' ? 'vsBot' : 'pvp';

/**
 * How combatant A - the local player - finished.
 * null means the battle has not produced a result yet, so there is nothing to
 * reward; the caller must not settle.
 */
export const resultFor = (winner: BattleWinner): RewardResult | null => {
  if (winner === 'A') return 'VICTORY';
  if (winner === 'B') return 'DEFEAT';
  if (winner === 'DRAW') return 'DRAW';
  return null;
};

/** The configured amount for one mode and one outcome. */
export const amountFor = (
  mode: RewardMode,
  result: RewardResult,
  config: RewardConfig = rewardConfig,
): number => {
  const table = config[mode];
  const key = result === 'VICTORY' ? 'victory' : result === 'DEFEAT' ? 'defeat' : 'draw';
  return table[key];
};

/**
 * The anti-duplicate key. One reward per battle per player, for good: the key
 * is derived, stored, and never reused, so replaying a finished battle cannot
 * pay twice.
 */
export const settlementKey = ({ battleId, playerId }: RewardRequest): string =>
  `${battleId}::${playerId}`;

export const transactionId = ({ battleId, playerId }: RewardRequest): string =>
  `txn-${battleId}-${playerId}`;

/**
 * Resolves a finished battle into the reward it owes.
 *
 * `settledKeys` is the player's existing ledger of settlement keys. When this
 * battle is already in it, the same transaction is returned again with status
 * ALREADY_SETTLED - and the caller must apply nothing.
 *
 * `config` is injectable only so tests can prove the arithmetic without
 * inventing real amounts. Production always reads `rewardConfig`.
 */
export const settle = (
  request: RewardRequest,
  settledKeys: readonly string[] = [],
  options: RewardSettleOptions = {},
): RewardOutcome => {
  const { config = rewardConfig, balance = 0 } = options;
  const key = settlementKey(request);
  const amount = amountFor(modeFor(request.mode), request.result, config);

  // The balance is an INPUT, not something the engine reads: the engine stays
  // pure, and the caller passes the figure it is about to apply the payout to.
  const transaction: GoldTransaction = {
    transactionId: transactionId(request),
    playerId: request.playerId,
    kind: 'BATTLE_REWARD',
    battleId: request.battleId,
    mode: request.mode,
    result: request.result,
    amount,
    balanceBefore: balance,
    balanceAfter: balance + amount,
    createdAt: request.createdAt,
  };

  return {
    status: settledKeys.includes(key) ? 'ALREADY_SETTLED' : 'GRANTED',
    settlementKey: key,
    amount,
    transaction,
  };
};

export const RewardEngine = Object.freeze({
  modeFor,
  resultFor,
  amountFor,
  settlementKey,
  transactionId,
  settle,
  config: rewardConfig,
});
