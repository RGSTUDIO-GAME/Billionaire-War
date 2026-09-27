import type { StorageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../storage/keys';
import { MAX_BATTLE_RECORDS, MAX_ROUNDS_PLAYED } from '../storage/records';
import type { BattleRecord } from '../storage/records';

/**
 * BATTLE REPOSITORY
 * =================
 * The archived history of finished battles.
 *
 * A battle is only ever written here once it has produced a result, which is
 * why a reload mid-battle cannot mint a record - and therefore cannot mint a
 * reward. Abandoned battles leave no trace by design.
 */

const RESULTS = new Set(['VICTORY', 'DEFEAT', 'DRAW']);

export const parseBattleRecord = (raw: unknown): BattleRecord | null => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;
  if (typeof entry.battleId !== 'string' || entry.battleId.length === 0) return null;
  if (typeof entry.playerId !== 'string' || entry.playerId.length === 0) return null;
  if (entry.mode !== 'bot' && entry.mode !== 'pvp') return null;
  if (typeof entry.result !== 'string' || !RESULTS.has(entry.result)) return null;

  const asHp = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const finalHp = asHp(entry.finalHp);
  const opponentFinalHp = asHp(entry.opponentFinalHp);
  if (finalHp === null || opponentFinalHp === null) return null;

  return {
    battleId: entry.battleId,
    playerId: entry.playerId,
    mode: entry.mode,
    result: entry.result as BattleRecord['result'],
    finalHp,
    opponentFinalHp,
    roundsPlayed:
      typeof entry.roundsPlayed === 'number' && entry.roundsPlayed > 0
        ? Math.min(Math.floor(entry.roundsPlayed), MAX_ROUNDS_PLAYED)
        : 1,
    completedAt: typeof entry.completedAt === 'number' && Number.isFinite(entry.completedAt) ? entry.completedAt : 0,
  };
};

export class BattleRepository {
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /** Newest first. */
  list(playerId?: string): BattleRecord[] {
    const raw = this.storage.read(STORAGE_KEYS.battleHistory);
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    const records = parsed
      .map(parseBattleRecord)
      .filter((record): record is BattleRecord => record !== null);
    return playerId ? records.filter((record) => record.playerId === playerId) : records;
  }

  findById(battleId: string): BattleRecord | null {
    return this.list().find((record) => record.battleId === battleId) ?? null;
  }

  append(record: BattleRecord): boolean {
    if (this.findById(record.battleId) !== null) return false;
    const entries = [record, ...this.list()].slice(0, MAX_BATTLE_RECORDS);
    try {
      return this.storage.write(STORAGE_KEYS.battleHistory, JSON.stringify(entries));
    } catch {
      return false;
    }
  }

  clear(): void {
    this.storage.remove(STORAGE_KEYS.battleHistory);
  }
}
