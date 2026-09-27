import type { BattleMode } from '../engine/types';
import type { GoldRepository } from '../repositories/goldRepository';
import type { PlayerRepository } from '../repositories/playerRepository';
import type { GoldTransaction, PlayerProfile } from '../storage/records';
import type { RewardResult } from '../rewards/types';

/**
 * GOLD SERVICE
 * ============
 * The one place $GOLD is allowed to move.
 *
 * Two rules it enforces for the whole game:
 *   1. a balance is never negative - a debit that would go below zero is
 *      REFUSED, and the balance is left exactly as it was
 *   2. every movement is recorded, with its before and after balances, so the
 *      ledger can be audited and a corrupted balance rebuilt
 *
 * Every method writes through to storage, so the save and the in-memory state
 * can never disagree. Nothing above this layer writes a balance directly.
 *
 * A balance that has been damaged in storage is recovered by the ledger via
 * `GoldRepository.rebuildBalance`, which is what the player repository reads
 * through `load(rebuildGold)` - an append-only audit trail is only useful if
 * something actually reads it back.
 */
export type GoldRef = {
  kind?: GoldTransaction['kind'];
  battleId?: string | null;
  mode?: BattleMode | null;
  result?: RewardResult | null;
};

export type GoldOutcome =
  | { ok: true; profile: PlayerProfile; transaction: GoldTransaction }
  | { ok: false; reason: 'INVALID_AMOUNT' | 'INSUFFICIENT_FUNDS'; profile: PlayerProfile };

export class GoldService {
  private readonly players: PlayerRepository;
  private readonly ledger: GoldRepository;
  private sequence = 0;

  constructor(players: PlayerRepository, ledger: GoldRepository) {
    this.players = players;
    this.ledger = ledger;
  }

  get transactions(): GoldRepository {
    return this.ledger;
  }

  /** Pays in. Zero and above are fine; anything else is refused. */
  credit(profile: PlayerProfile, amount: number, ref: GoldRef, now: number): GoldOutcome {
    if (!Number.isInteger(amount) || amount < 0) return { ok: false, reason: 'INVALID_AMOUNT', profile };
    return this.move(profile, amount, ref, now);
  }

  /**
   * Takes out. A debit larger than the balance is refused outright - the
   * balance is never clamped silently, because a clamped debit looks like a
   * successful purchase that cost less than it should.
   */
  debit(profile: PlayerProfile, amount: number, ref: GoldRef, now: number): GoldOutcome {
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'INVALID_AMOUNT', profile };
    if (amount > profile.goldBalance) return { ok: false, reason: 'INSUFFICIENT_FUNDS', profile };
    return this.move(profile, -amount, ref, now);
  }

  private move(profile: PlayerProfile, amount: number, ref: GoldRef, now: number): GoldOutcome {
    const balanceBefore = profile.goldBalance;
    const balanceAfter = balanceBefore + amount;

    this.sequence += 1;
    const transaction: GoldTransaction = {
      transactionId: `${profile.playerId}_${ref.kind ?? 'GRANT'}_${now}_${this.sequence}`,
      playerId: profile.playerId,
      kind: ref.kind ?? (amount >= 0 ? 'GRANT' : 'SPEND'),
      battleId: ref.battleId ?? null,
      mode: ref.mode ?? null,
      result: ref.result ?? null,
      amount,
      balanceBefore,
      balanceAfter,
      createdAt: now,
    };

    const next: PlayerProfile = { ...profile, goldBalance: balanceAfter };
    this.players.save(next);
    this.ledger.append(transaction);

    return { ok: true, profile: next, transaction };
  }
}
