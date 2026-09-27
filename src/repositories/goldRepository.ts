import type { StorageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS } from '../storage/keys';
import { MAX_LEDGER_ENTRIES } from '../storage/records';
import type { GoldTransaction } from '../storage/records';

/**
 * GOLD LEDGER REPOSITORY
 * ======================
 * An append-only record of every $GOLD movement.
 *
 * It is both the audit trail the spec asks for and the recovery path: a
 * corrupted balance can be rebuilt by summing this list, which is why each
 * entry carries its own before and after figures.
 */

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asNonNegative = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : null;

const asSigned = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) ? value : null;

const KINDS = new Set(['BATTLE_REWARD', 'GRANT', 'SPEND']);

/** Drops anything that is not a usable transaction. */
export const parseTransaction = (raw: unknown): GoldTransaction | null => {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.transactionId !== 'string' || raw.transactionId.length === 0) return null;
  if (typeof raw.playerId !== 'string' || raw.playerId.length === 0) return null;
  if (typeof raw.kind !== 'string' || !KINDS.has(raw.kind)) return null;

  const amount = asSigned(raw.amount);
  const balanceBefore = asNonNegative(raw.balanceBefore);
  const balanceAfter = asNonNegative(raw.balanceAfter);
  if (amount === null || balanceBefore === null || balanceAfter === null) return null;
  // A ledger that does not add up is not worth trusting.
  if (balanceBefore + amount !== balanceAfter) return null;

  return {
    transactionId: raw.transactionId,
    playerId: raw.playerId,
    kind: raw.kind as GoldTransaction['kind'],
    battleId: typeof raw.battleId === 'string' ? raw.battleId : null,
    mode: raw.mode === 'bot' || raw.mode === 'pvp' ? raw.mode : null,
    result:
      raw.result === 'VICTORY' || raw.result === 'DEFEAT' || raw.result === 'DRAW' ? raw.result : null,
    amount,
    balanceBefore,
    balanceAfter,
    createdAt: typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : 0,
  };
};

export const parseLedger = (raw: unknown): GoldTransaction[] =>
  Array.isArray(raw) ? raw.map(parseTransaction).filter((entry): entry is GoldTransaction => entry !== null) : [];

export class GoldRepository {
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /** Newest first, already repaired. */
  list(playerId?: string): GoldTransaction[] {
    const raw = this.storage.read(STORAGE_KEYS.goldLedger);
    if (raw === null) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
    const entries = parseLedger(parsed);
    return playerId ? entries.filter((entry) => entry.playerId === playerId) : entries;
  }

  /** Adds an entry at the head and trims to the retention limit. */
  append(transaction: GoldTransaction): boolean {
    const entries = [transaction, ...this.list()].slice(0, MAX_LEDGER_ENTRIES);
    try {
      return this.storage.write(STORAGE_KEYS.goldLedger, JSON.stringify(entries));
    } catch {
      return false;
    }
  }

  /** The balance implied by the ledger, for recovering a corrupted value. */
  rebuildBalance(playerId: string): number | null {
    const entries = this.list(playerId);
    if (entries.length === 0) return null;
    // Newest first, so the newest entry's balanceAfter is the live figure.
    return entries[0].balanceAfter;
  }

  /** True when this battle has already paid this player. */
  hasSettledBattle(battleId: string, playerId: string): boolean {
    return this.list(playerId).some(
      (entry) => entry.kind === 'BATTLE_REWARD' && entry.battleId === battleId,
    );
  }

  /** The battle ids this player has already been paid for. */
  settledBattleIds(playerId: string): string[] {
    return [
      ...new Set(
        this.list(playerId)
          .filter((entry) => entry.kind === 'BATTLE_REWARD' && entry.battleId !== null)
          .map((entry) => entry.battleId as string),
      ),
    ];
  }

  /**
   * The anti-duplicate keys - `battleId::playerId`, exactly what
   * `RewardEngine.settlementKey` derives.
   *
   * The ledger is the record of what has actually been paid, so these keys
   * are what decides whether a battle is still owed. Deriving them from the
   * ledger rather than from memory is what stops a reload from forgetting a
   * settlement and paying for the same battle a second time.
   */
  settlementKeys(playerId: string): string[] {
    return [
      ...new Set(
        this.list(playerId)
          .filter((entry) => entry.kind === 'BATTLE_REWARD' && entry.battleId !== null)
          .map((entry) => `${entry.battleId}::${entry.playerId}`),
      ),
    ];
  }

  clear(): void {
    this.storage.remove(STORAGE_KEYS.goldLedger);
  }
}
