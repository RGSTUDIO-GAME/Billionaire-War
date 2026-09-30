import { MINING_DURATION_MS, STARTING_BWAR, STARTING_GOLD } from '../data/balance';
import { clampHeroLevel } from '../data/economy';
import { getFreeHeroes, getHeroById, HEROES } from '../data/heroes';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { STORAGE_KEYS, STORAGE_VERSION } from '../storage/keys';
import type { MiningSession, PlayerProfile } from '../storage/records';

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

const asNonNegativeNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const asTimestamp = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

/** Hero ids that actually exist in the registry. */
const knownHeroIds = (value: unknown): string[] => {
  const ids = Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  return [...new Set(ids.filter((id) => getHeroById(id) !== undefined))];
};

/** Levels that survived sanitising: known heroes only, clamped to 0..MAX. */
const knownHeroLevels = (value: unknown): Record<string, number> => {
  if (!isPlainObject(value)) return {};
  const levels: Record<string, number> = {};
  for (const [heroId, level] of Object.entries(value)) {
    if (getHeroById(heroId) === undefined) continue;
    if (typeof level !== 'number' || !Number.isInteger(level)) continue;
    levels[heroId] = clampHeroLevel(level);
  }
  return levels;
};

/** Free heroes are granted only when a profile has no usable roster. */
const withFreeHeroes = (ids: string[]): string[] => {
  const free = getFreeHeroes().map((hero) => hero.id);
  return [...new Set([...ids, ...free])];
};

const parseMiningSession = (
  raw: unknown,
  ownedHeroes: readonly string[],
  now: number,
): MiningSession | null => {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.heroId !== 'string' || !ownedHeroes.includes(raw.heroId)) return null;
  if (getHeroById(raw.heroId) === undefined) return null;

  const hashrate = asNonNegativeNumber(raw.hashrate);
  const rewardAmount = asNonNegativeNumber(raw.rewardAmount);
  const startedAt = asTimestamp(raw.startedAt, 0);
  if (hashrate === null || rewardAmount === null || startedAt === 0 || hashrate === 0) return null;

  const expectedReward = (hashrate * MINING_DURATION_MS) / 1000;
  if (Math.abs(rewardAmount - expectedReward) > 1e-6) return null;

  return {
    heroId: raw.heroId,
    hashrate,
    rewardAmount,
    startedAt: startedAt > now ? now : startedAt,
  };
};

const mintPlayerId = (): string => {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') return `player_${source.randomUUID().slice(0, 8)}`;
  return `player_${Math.random().toString(36).slice(2, 10)}`;
};

export const usernameFor = (playerId: string): string => `PLAYER-${playerId.replace(/^player_/, '').toUpperCase().slice(0, 6)}`;

/** A brand new profile with the initial free-hero roster. */
export const newProfile = (now: number): PlayerProfile => {
  const playerId = mintPlayerId();
  return {
    version: STORAGE_VERSION,
    playerId,
    username: usernameFor(playerId),
    equippedHeroId: getFreeHeroes()[0]?.id ?? HEROES[0]?.id ?? 'durov',
    ownedHeroes: withFreeHeroes([]),
    heroLevels: {},
    goldBalance: STARTING_GOLD,
    bwarBalance: STARTING_BWAR,
    mining: null,
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
  const storedOwnedHeroes = knownHeroIds(raw.ownedHeroes);
  const ownedHeroes =
    Array.isArray(raw.ownedHeroes) && storedOwnedHeroes.length > 0
      ? storedOwnedHeroes
      : withFreeHeroes([]);

  const equipped = typeof raw.equippedHeroId === 'string' ? raw.equippedHeroId : '';
  const equippedHeroId =
    getHeroById(equipped) !== undefined && ownedHeroes.includes(equipped)
      ? equipped
      : (ownedHeroes[0] ?? getFreeHeroes()[0]?.id ?? HEROES[0]?.id ?? 'durov');

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
    heroLevels: knownHeroLevels(raw.heroLevels),
    goldBalance,
    bwarBalance: asNonNegativeNumber(raw.bwarBalance) ?? STARTING_BWAR,
    mining: parseMiningSession(raw.mining, ownedHeroes, now),
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
