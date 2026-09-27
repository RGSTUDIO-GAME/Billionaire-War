import { STARTING_BWAR, STARTING_GOLD } from '../data/balance';
import { getFreeHeroes, getHeroById, HEROES } from '../data/heroes';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS, STORAGE_VERSION } from '../storage/keys';
import type { PlayerProfile } from '../storage/records';

/**
 * PLAYER REPOSITORY
 * =================
 * Reads and writes the player profile, and validates whatever it finds.
 *
 * Nothing above this layer is allowed to trust storage. Every read goes
 * through `parseProfile`, so a truncated write, a hand-edited value or a
 * future schema change can never crash the game - it can only produce a
 * sanitised profile, or null when the record is unusable.
 */

const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A non-negative whole number, or null. Rejects NaN, Infinity, negatives, floats. */
export const asGold = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && Number.isInteger(value)
    ? value
    : null;

const asTimestamp = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

/** Hero ids that actually exist in the registry. */
const knownHeroIds = (value: unknown): string[] => {
  const ids = Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  return [...new Set(ids.filter((id) => getHeroById(id) !== undefined))];
};

/** Free heroes are always available, so a new player can always fight. */
const withFreeHeroes = (ids: string[]): string[] => {
  const free = getFreeHeroes().map((hero) => hero.id);
  return [...new Set([...ids, ...free])];
};

const mintPlayerId = (): string => {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') return `player_${source.randomUUID().slice(0, 8)}`;
  return `player_${Math.random().toString(36).slice(2, 10)}`;
};

export const usernameFor = (playerId: string): string => `PLAYER-${playerId.replace(/^player_/, '').toUpperCase().slice(0, 6)}`;

/** A brand new profile. DUROV is free, so it is owned from the first second. */
export const newProfile = (now: number): PlayerProfile => {
  const playerId = mintPlayerId();
  return {
    version: STORAGE_VERSION,
    playerId,
    username: usernameFor(playerId),
    equippedHeroId: getFreeHeroes()[0]?.id ?? HEROES[0]?.id ?? 'durov',
    ownedHeroes: withFreeHeroes([]),
    goldBalance: STARTING_GOLD,
    bwarBalance: STARTING_BWAR,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Sanitises anything that claims to be a profile.
 *
 * Each field is repaired independently, so one bad value cannot take the whole
 * save down with it. `rebuildGold` lets the caller recover a balance from the
 * transaction ledger when the stored number is unusable - the ledger exists
 * precisely so a corrupted balance is recoverable rather than lost.
 */
export const parseProfile = (
  raw: unknown,
  options: { now: number; rebuildGold?: (playerId: string) => number | null } = { now: Date.now() },
): PlayerProfile | null => {
  if (!isPlainObject(raw)) return null;

  const { now, rebuildGold } = options;
  const playerId = typeof raw.playerId === 'string' && PLAYER_ID_PATTERN.test(raw.playerId) ? raw.playerId : null;
  const ownedHeroes = withFreeHeroes(knownHeroIds(raw.ownedHeroes));

  const equipped = typeof raw.equippedHeroId === 'string' ? raw.equippedHeroId : '';
  const equippedHeroId =
    getHeroById(equipped) !== undefined && ownedHeroes.includes(equipped)
      ? equipped
      : (getFreeHeroes()[0]?.id ?? ownedHeroes[0] ?? 'durov');

  const storedGold = asGold(raw.goldBalance);
  const rebuilt = playerId && rebuildGold ? rebuildGold(playerId) : null;
  // A balance that cannot be read is recovered from the ledger. With no ledger
  // to recover from either, the player starts over rather than at zero - zero
  // would read as "spent everything", which is a different story.
  const goldBalance = storedGold ?? rebuilt ?? STARTING_GOLD;

  const createdAt = asTimestamp(raw.createdAt, now);
  // A record whose identity is unreadable cannot be repaired into a real
  // player, so a new identity is minted and the rest of the data is kept.
  const resolvedId = playerId ?? mintPlayerId();

  return {
    version: STORAGE_VERSION,
    playerId: resolvedId,
    username:
      typeof raw.username === 'string' && raw.username.trim().length > 0 && raw.username.length <= 24
        ? raw.username.trim()
        : usernameFor(resolvedId),
    equippedHeroId,
    ownedHeroes,
    goldBalance,
    bwarBalance: asGold(raw.bwarBalance) ?? STARTING_BWAR,
    createdAt,
    updatedAt: asTimestamp(raw.updatedAt, createdAt),
  };
};

export class PlayerRepository {
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  /** The stored profile, repaired. Null when nothing usable is stored. */
  load(rebuildGold?: (playerId: string) => number | null): PlayerProfile | null {
    const raw = this.storage.read(STORAGE_KEYS.player);
    if (raw === null) return null;
    try {
      return parseProfile(JSON.parse(raw), { now: Date.now(), rebuildGold });
    } catch {
      // Corrupt JSON is not an error worth crashing over.
      return null;
    }
  }

  loadOrCreate(rebuildGold?: (playerId: string) => number | null): PlayerProfile {
    const existing = this.load(rebuildGold);
    if (existing) return existing;
    const fresh = newProfile(Date.now());
    this.save(fresh);
    return fresh;
  }

  save(profile: PlayerProfile): boolean {
    try {
      return this.storage.write(STORAGE_KEYS.player, JSON.stringify({ ...profile, updatedAt: Date.now() }));
    } catch {
      return false;
    }
  }

  clear(): void {
    this.storage.remove(STORAGE_KEYS.player);
  }
}
