import { BATTLE_STATUS } from '../engine/types';
import type { BattleState } from '../engine/types';
import { RewardEngine } from '../rewards';
import type { RewardConfig, RewardOutcome } from '../rewards';
import type { PlayerRepository } from '../repositories/playerRepository';
import type { GoldTransaction } from '../storage/records';
import type { BattleService } from './battleService';
import type { GoldService } from './goldService';

/**
 * REWARD SERVICE
 * ==============
 * The bridge from a finished battle to a persisted player.
 *
 *   BATTLE_RESULT -> Reward Engine -> $GOLD -> ledger -> battle history
 *
 * It is the only caller allowed to pay out, and it is safe to call as often as
 * you like: the settlement is keyed on battle + player and recorded in the
 * ledger, so a second call resolves to ALREADY_SETTLED and moves nothing.
 *
 * Refuses anything that is not a finished battle. A reload mid-battle leaves no
 * battle object at all, so there is nothing here that could pay for one.
 */
export class RewardService {
  private readonly players: PlayerRepository;
  private readonly gold: GoldService;
  private readonly battles: BattleService;

  constructor(players: PlayerRepository, gold: GoldService, battles: BattleService) {
    this.players = players;
    this.gold = gold;
    this.battles = battles;
  }

  /** The profile a settlement would pay, or null when there is no player. */
  private profile(): ReturnType<PlayerRepository['load']> {
    return this.players.load((playerId) => this.gold.transactions.rebuildBalance(playerId));
  }

  /**
   * `options.config` is injectable only so a check can prove that the amount
   * really is read from configuration. The running game never passes it.
   */
  settle(
    battle: BattleState | null,
    now: number = Date.now(),
    options: { config?: RewardConfig } = {},
  ): RewardOutcome | null {
    if (!battle || battle.status !== BATTLE_STATUS.BATTLE_RESULT) return null;

    const result = RewardEngine.resultFor(battle.winner);
    if (result === null) return null;

    const profile = this.profile();
    if (!profile) return null;

    const outcome = RewardEngine.settle(
      {
        battleId: battle.battleId,
        playerId: profile.playerId,
        mode: battle.mode,
        result,
        createdAt: now,
      },
      // The LEDGER decides what has been paid, not this process's memory: the
      // keys are derived from the persisted transactions, so a reload cannot
      // forget a settlement and pay for the same battle twice.
      this.gold.transactions.settlementKeys(profile.playerId),
      { balance: profile.goldBalance, config: options.config },
    );

    if (outcome.status === 'GRANTED') {
      const credited = this.gold.credit(
        profile,
        outcome.amount,
        { kind: 'BATTLE_REWARD', battleId: battle.battleId, mode: battle.mode, result },
        now,
      );
      // A refused credit means nothing was paid, so there is nothing to
      // report. Returning the outcome anyway would show a payout the ledger
      // does not hold.
      if (!credited.ok) return null;
      outcome.transaction = credited.transaction;
    } else {
      // A refused settlement reports what was ACTUALLY paid, read back from
      // the ledger, rather than the plan the engine has just built. A caller
      // told "already settled" must be able to show the real payout.
      const recorded = this.paidFor(battle.battleId, profile.playerId);
      if (recorded) outcome.transaction = recorded;
    }

    // The battle is archived either way - a finished battle is history even
    // when the reward for it was already paid, and `append` ignores an id it
    // already holds.
    this.battles.archive(battle, profile.playerId, now);

    return outcome;
  }

  /** The recorded payout for one battle, or null when it was never paid. */
  private paidFor(battleId: string, playerId: string): GoldTransaction | null {
    return (
      this.gold.transactions
        .list(playerId)
        .find((entry) => entry.kind === 'BATTLE_REWARD' && entry.battleId === battleId) ?? null
    );
  }
}
