import { MINING_DURATION_MS, STARTING_BWAR, STARTING_GOLD } from '../data/balance';
import { clampHeroLevel } from '../data/economy';
import { clampStars } from '../data/fusion';
import { getFreeHeroes, getHeroById, HEROES } from '../data/heroes';
import { isValidTradePrice, MAX_TRADE_OFFERS } from '../data/trade';
import type { TradeCurrency, TradeOffer, TradeOfferKind, TradeOfferStatus } from '../data/trade';
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

/** Star tiers that survived sanitising: known heroes only, clamped to 1..6. */
const knownHeroStars = (value: unknown): Record<string, number> => {
  if (!isPlainObject(value)) return {};
  const stars: Record<string, number> = {};
  for (const [heroId, tier] of Object.entries(value)) {
    if (getHeroById(heroId) === undefined) continue;
    if (typeof tier !== 'number' || !Number.isInteger(tier)) continue;
    stars[heroId] = clampStars(tier);
  }
  return stars;
};

/** Spare-copy serials that survived sanitising: known heroes, positive ids. */
const knownHeroCopies = (value: unknown): Record<string, number[]> => {
  if (!isPlainObject(value)) return {};
  const copies: Record<string, number[]> = {};
  for (const [heroId, serials] of Object.entries(value)) {
    if (getHeroById(heroId) === undefined || !Array.isArray(serials)) continue;
    const ids = [...new Set(serials.filter(
      (serial): serial is number => typeof serial === 'number' && Number.isInteger(serial) && serial > 0,
    ))].slice(0, 200_000);
    if (ids.length > 0) copies[heroId] = ids;
  }
  return copies;
};

/** Roster serials that survived sanitising: owned known heroes, positive ids. */
const knownHeroSerials = (value: unknown, ownedHeroes: readonly string[]): Record<string, number> => {
  if (!isPlainObject(value)) return {};
  const serials: Record<string, number> = {};
  for (const [heroId, serial] of Object.entries(value)) {
    if (!ownedHeroes.includes(heroId) || getHeroById(heroId) === undefined) continue;
    if (typeof serial !== 'number' || !Number.isInteger(serial) || serial <= 0) continue;
    serials[heroId] = serial;
  }
  return serials;
};

/** Every owned hero instance carries its own unique serial number. */
export const ensureHeroIdentity = (profile: PlayerProfile): PlayerProfile => {
  const serials: Record<string, number> = { ...(profile.heroSerials ?? {}) };
  const used = new Set<number>([
    ...Object.values(serials),
    ...Object.values(profile.heroCopies ?? {}).flat(),
  ]);
  let counter = typeof profile.heroSerialCounter === 'number' && Number.isInteger(profile.heroSerialCounter)
    ? Math.max(profile.heroSerialCounter, 0)
    : 0;
  for (const usedSerial of used) {
    if (usedSerial > counter) counter = usedSerial;
  }
  let changed = false;
  for (const heroId of profile.ownedHeroes) {
    if (getHeroById(heroId) === undefined) continue;
    const current = serials[heroId];
    if (typeof current === 'number' && Number.isInteger(current) && current > 0 && !used.has(current)) {
      used.add(current);
      if (current > counter) counter = current;
      continue;
    }
    counter += 1;
    serials[heroId] = counter;
    used.add(counter);
    changed = true;
  }
  if (!changed && counter === (profile.heroSerialCounter ?? 0)) return profile;
  return { ...profile, heroSerials: serials, heroSerialCounter: counter };
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

const knownCurrency = (value: unknown): TradeCurrency | null =>
  value === 'gold' || value === 'bwar' ? value : null;

const knownOfferKind = (value: unknown): TradeOfferKind | null =>
  value === 'hero' || value === 'gold' ? value : null;

const knownOfferStatus = (value: unknown): TradeOfferStatus | null =>
  value === 'active' || value === 'delivered' || value === 'delisted' ? value : null;

const knownOfferId = (value: unknown): string | null =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{4,100}$/.test(value) ? value : null;

const parseTradeOffers = (
  value: unknown,
  ownedHeroes: readonly string[],
  playerId: string,
): TradeOffer[] => {
  if (!Array.isArray(value)) return [];
  const offers: TradeOffer[] = [];
  const activeAssets = new Set<string>();

  for (const raw of value) {
    if (!isPlainObject(raw) || offers.length >= MAX_TRADE_OFFERS) continue;
    const offerId = knownOfferId(raw.offerId);
    const sellerId = typeof raw.sellerId === 'string' && raw.sellerId.length > 0 && raw.sellerId.length <= 100
      ? raw.sellerId
      : playerId;
    const kind = knownOfferKind(raw.kind);
    const currency = knownCurrency(raw.currency);
    const storedStatus = knownOfferStatus(raw.status);
    const price = typeof raw.price === 'number' ? raw.price : Number.NaN;
    const createdAt = asTimestamp(raw.createdAt, 0);
    const updatedAt = asTimestamp(raw.updatedAt, createdAt);
    if (offerId === null || kind === null || currency === null || storedStatus === null) continue;
    if (createdAt === 0 || !isValidTradePrice(price, currency)) continue;

    let status = storedStatus;
    let offer: TradeOffer;
    if (kind === 'hero') {
      const heroId = typeof raw.heroId === 'string' && getHeroById(raw.heroId) !== undefined ? raw.heroId : null;
      const heroLevel = typeof raw.heroLevel === 'number' && Number.isInteger(raw.heroLevel)
        ? clampHeroLevel(raw.heroLevel)
        : 0;
      const heroStars = typeof raw.heroStars === 'number' && Number.isInteger(raw.heroStars)
        ? clampStars(raw.heroStars)
        : 1;
      if (heroId === null) continue;
      const activeKey = `hero:${heroId}`;
      if (status === 'active' && (ownedHeroes.includes(heroId) || activeAssets.has(activeKey))) {
        status = 'delisted';
      }
      if (status === 'active') activeAssets.add(activeKey);
      const heroCopies = Array.isArray(raw.heroCopies)
        ? raw.heroCopies.filter((serial): serial is number => typeof serial === 'number' && Number.isInteger(serial) && serial > 0)
        : [];
      const heroSerial =
        typeof raw.heroSerial === 'number' && Number.isInteger(raw.heroSerial) && raw.heroSerial > 0
          ? raw.heroSerial
          : null;
      offer = {
        offerId,
        sellerId,
        kind: 'hero',
        heroId,
        heroLevel,
        heroStars,
        heroCopies,
        heroSerial,
        wasEquipped: raw.wasEquipped === true,
        currency,
        price,
        status,
        createdAt,
        updatedAt,
      };
    } else {
      const goldAmount = typeof raw.goldAmount === 'number' && Number.isInteger(raw.goldAmount) && raw.goldAmount > 0
        ? raw.goldAmount
        : null;
      if (goldAmount === null) continue;
      const activeKey = 'gold';
      if (status === 'active' && activeAssets.has(activeKey)) status = 'delisted';
      if (status === 'active') activeAssets.add(activeKey);
      offer = {
        offerId,
        sellerId,
        kind: 'gold',
        goldAmount,
        currency,
        price,
        status,
        createdAt,
        updatedAt,
      };
    }
    offers.push(offer);
  }
  return offers;
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
    heroStars: {},
    heroCopies: {},
    heroSerials: Object.fromEntries(withFreeHeroes([]).map((heroId, index) => [heroId, index + 1])),
    heroSerialCounter: withFreeHeroes([]).length,
    tradeOffers: [],
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

  return ensureHeroIdentity({
    version: STORAGE_VERSION,
    playerId: resolvedId,
    username:
      typeof raw.username === 'string' && raw.username.trim().length > 0 && raw.username.length <= 24
        ? raw.username.trim()
        : usernameFor(resolvedId),
    equippedHeroId,
    ownedHeroes,
    heroLevels: knownHeroLevels(raw.heroLevels),
    heroStars: knownHeroStars(raw.heroStars),
    heroCopies: knownHeroCopies(raw.heroCopies),
    heroSerials: knownHeroSerials(raw.heroSerials, ownedHeroes),
    heroSerialCounter: typeof raw.heroSerialCounter === 'number' && Number.isInteger(raw.heroSerialCounter) && raw.heroSerialCounter >= 0
      ? raw.heroSerialCounter
      : 0,
    goldBalance,
    bwarBalance: asNonNegativeNumber(raw.bwarBalance) ?? STARTING_BWAR,
    mining: parseMiningSession(raw.mining, ownedHeroes, now),
    tradeOffers: parseTradeOffers(raw.tradeOffers, ownedHeroes, resolvedId),
    createdAt,
    updatedAt: asTimestamp(raw.updatedAt, createdAt),
  });
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
      const identified = ensureHeroIdentity(profile);
      return this.storage.write(STORAGE_KEYS.player, JSON.stringify({ ...identified, updatedAt: Date.now() }));
    } catch {
      return false;
    }
  }

  clear(): void {
    this.storage.remove(STORAGE_KEYS.player);
  }
}
