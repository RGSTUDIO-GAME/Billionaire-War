import { BATTLE_STATUS } from '../engine/types';
import type { BattleState } from '../engine/types';
import { RewardEngine } from '../rewards';
import type { BattleRepository } from '../repositories/battleRepository';
import type { BattleRecord } from '../storage/records';

/** A short token for this run of the game. Randomness is fine here: an id. */
const newSessionToken = (): string => {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') return source.randomUUID().slice(0, 4);
  return Math.random().toString(36).slice(2, 6);
};

/**
 * BATTLE SERVICE
 * ==============
 * Battle identity and history.
 *
 * Ids are minted here rather than in the store or the engine, so a new battle
 * always gets a new id and a rematch can never inherit the previous battle's
 * reward settlement.
 */
export class BattleService {
  private readonly battles: BattleRepository;
  private sequence = 0;
  /**
   * Identifies this run of the game, so a battle id minted after a reload can
   * never repeat one that is already in the history. A repeated id would make
   * a NEW battle look like a settlement that has already been paid, and the
   * player would silently never be paid for it.
   */
  private readonly session = newSessionToken();

  constructor(battles: BattleRepository) {
    this.battles = battles;
  }

  get history(): BattleRepository {
    return this.battles;
  }

  /** A fresh id for every battle, including a rematch. */
  nextId(seed: number): string {
    this.sequence += 1;
    return `btl-${this.session}-${this.sequence.toString(36)}-${seed.toString(36)}`;
  }

  /**
   * Archives a finished battle. Returns null unless the battle has actually
   * produced a result, so an abandoned battle leaves nothing behind.
   */
  archive(battle: BattleState, playerId: string, now: number): BattleRecord | null {
    if (battle.status !== BATTLE_STATUS.BATTLE_RESULT) return null;
    const result = RewardEngine.resultFor(battle.winner);
    if (result === null) return null;

    const record: BattleRecord = {
      battleId: battle.battleId,
      playerId,
      mode: battle.mode,
      result,
      finalHp: battle.playerA.currentHp,
      opponentFinalHp: battle.playerB.currentHp,
      roundsPlayed: battle.result?.roundsPlayed ?? battle.currentRound,
      completedAt: now,
    };

    this.battles.append(record);
    return record;
  }
}
