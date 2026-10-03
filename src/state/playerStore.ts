import { create } from 'zustand';
import type { StoreApi, UseBoundStore } from 'zustand';
import { STARTING_BWAR, STARTING_GOLD } from '../data/balance';
import { heroLevelOf, upgradeCost } from '../data/economy';
import { heroStarsOf, maxLevelForStars } from '../data/fusion';
import { getFreeHeroes, getHeroById } from '../data/heroes';
import { withEquippedHero, withHero } from '../repositories/heroRepository';
import type { GoldRef } from '../services/goldService';
import type { MiningSession } from '../storage/records';
import type { TradeCurrency, TradeOffer } from '../data/trade';
import { STORAGE_VERSION } from '../storage/keys';
import type { BattleRecord, GoldTransaction, PlayerProfile } from '../storage/records';
import type { RewardOutcome } from '../rewards';
import { runtime as defaultRuntime } from './runtime';
import type { AppRuntime } from './runtime';

/**
 * PLAYER STATE
 * ============
 * A write-through cache of the persisted player profile.
 *
 * This store is NOT the database. It mirrors what the repositories hold so the
 * UI can read them synchronously, and every action goes through a service that
 * persists BEFORE the state changes. A reload simply re-reads storage, which
 * is what makes identity, $GOLD, the roster and the equipped hero survive the
 * app being closed.
 *
 * The split below matters: `PlayerData` is what a save holds, `PlayerActions`
 * is what the UI may do to it. A wipe can reset the data because the two are
 * never mixed in the same object - zustand merges `set` shallowly, so
 * spreading a data snapshot in also has to leave the actions alone.
 *
 * Only player state lives here. Battles, rewards and navigation each have their
 * own store; nothing grows into one large blob.
 */

/** Everything a save holds. No behaviour. */
export type PlayerData = {
  /** False until the profile has been read back from storage. */
  hydrated: boolean;

  playerId: string;
  username: string;
  /** $GOLD balance. Never negative. */
  gold: number;
  /** Local BWAR moved by Mining claims and Trade; no chain or wallet exists. */
  bwar: number;
  ownedHeroIds: string[];
  equippedHeroId: string;
  /** Hero level per hero id. Missing heroes are Level 0. */
  heroLevels: Record<string, number>;
  /** Star tier per hero id. Missing heroes are 1 star. */
  heroStars: Record<string, number>;
  /** Spare same-hero copies per hero id, as unique serial numbers. */
  heroCopies: Record<string, number[]>;
  /** Unique serial of the roster instance per owned hero id. */
  heroSerials: Record<string, number>;
  tradeOffers: TradeOffer[];
  /** The single active mining session, or null before the first Equip. */
  mining: MiningSession | null;
  createdAt: number;
  updatedAt: number;

  /** Persisted $GOLD history, newest first. */
  goldTransactions: GoldTransaction[];
  /** `battleId::playerId` keys that have already been paid. */
  settledRewards: string[];
  /** The most recent payout, tagged with the battle that earned it. */
  lastReward: GoldTransaction | null;
  /** Archived finished battles, newest first. */
  battleHistory: BattleRecord[];
};

export type PlayerActions = {
  /** Re-reads the save. Safe to call more than once. */
  hydrate: () => void;
  equipHero: (heroId: string) => void;
  equipMiningHero: (heroId: string) => boolean;
  /** Credits a full session and starts its next cycle. Returns the amount paid. */
  claimMining: () => number;
  /** Claims accrued BWAR and removes the active mining hero. */
  unstackMining: () => number | null;
  createHeroOffer: (heroId: string, price: number, currency: TradeCurrency) => boolean;
  createGoldOffer: (goldAmount: number, price: number) => boolean;
  delistOffer: (offerId: string) => boolean;
  deliverOffer: (offerId: string) => boolean;
  grantHero: (heroId: string) => void;
  /** Saves a complete Gacha pull as roster entries and duplicate copies. */
  grantGachaHeroes: (heroIds: string[]) => boolean;
  /** Burns spare copies to lift a hero one star tier. False when refused. */
  fuseHero: (heroId: string) => boolean;
  /**
   * Buys the next level for a hero with $GOLD. Refused at max level or when
   * the balance cannot cover the linear price - the ledger is the only thing
   * that moves money, exactly like every other purchase.
   */
  upgradeHero: (heroId: string) => boolean;
  addGold: (amount: number, ref?: GoldRef) => boolean;
  debitGold: (amount: number, ref?: GoldRef) => boolean;
  /** Mirrors a reward the Reward Service has already paid. */
  applyReward: (outcome: RewardOutcome) => void;
  clearLastReward: () => void;
  resetProgress: () => void;
};

export type PlayerState = PlayerData & PlayerActions;

export type PlayerStore = UseBoundStore<StoreApi<PlayerState>>;

/**
 * A save that has never been read: the starting values the player gets before
 * hydration finishes. Data only - no actions - so a reset can never replace a
 * working action with a stub.
 */
const blankData = (): PlayerData => ({
  hydrated: false,
  playerId: '',
  username: '',
  gold: STARTING_GOLD,
  bwar: STARTING_BWAR,
  ownedHeroIds: getFreeHeroes().map((hero) => hero.id),
  equippedHeroId: getFreeHeroes()[0]?.id ?? 'durov',
  heroLevels: {},
  heroStars: {},
  heroCopies: {},
  heroSerials: {},
  tradeOffers: [],
  mining: null,
  createdAt: 0,
  updatedAt: 0,
  goldTransactions: [],
  settledRewards: [],
  lastReward: null,
  battleHistory: [],
});

export const createPlayerStore = (app: AppRuntime): PlayerStore => {
  /** Recovers a balance from the ledger when the stored one is unusable. */
  const rebuild = (playerId: string): number | null => app.gold.rebuildBalance(playerId);

  /** Re-reads the save and mirrors it into the store. */
  const commit = (set: (partial: Partial<PlayerState>) => void): PlayerProfile => {
    const profile = app.players.load(rebuild) ?? app.players.loadOrCreate(rebuild);
    set({
      hydrated: true,
      playerId: profile.playerId,
      username: profile.username,
      gold: profile.goldBalance,
      bwar: profile.bwarBalance,
      ownedHeroIds: profile.ownedHeroes,
      equippedHeroId: profile.equippedHeroId,
      heroLevels: profile.heroLevels,
      heroStars: profile.heroStars ?? {},
      heroCopies: profile.heroCopies ?? {},
      heroSerials: profile.heroSerials ?? {},
      tradeOffers: profile.tradeOffers ?? [],
      mining: profile.mining,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      goldTransactions: app.gold.list(profile.playerId),
      settledRewards: app.gold.settlementKeys(profile.playerId),
      battleHistory: app.battles.list(profile.playerId),
    });
    return profile;
  };

  return create<PlayerState>()((set, get) => ({
    ...blankData(),

    hydrate: () => {
      commit(set);
    },

    equipHero: (heroId) => {
      if (getHeroById(heroId) === undefined) return;
      const profile = withEquippedHero(currentProfile(app, get()), heroId);
      if (profile.equippedHeroId === get().equippedHeroId) return;
      app.players.save(profile);
      commit(set);
    },

    equipMiningHero: (heroId) => {
      const outcome = app.miningService.start(currentProfile(app, get()), heroId, Date.now());
      if (!outcome.ok) return false;
      commit(set);
      return true;
    },

    claimMining: () => {
      const outcome = app.miningService.claim(currentProfile(app, get()), Date.now());
      if (!outcome.ok) return 0;
      commit(set);
      return outcome.amount;
    },

    unstackMining: () => {
      const outcome = app.miningService.unstack(currentProfile(app, get()), Date.now());
      if (!outcome.ok) return null;
      commit(set);
      return outcome.amount;
    },

    createHeroOffer: (heroId, price, currency) => {
      const outcome = app.tradeService.createHeroOffer(
        currentProfile(app, get()),
        heroId,
        price,
        currency,
        Date.now(),
      );
      if (!outcome.ok) return false;
      commit(set);
      return true;
    },

    createGoldOffer: (goldAmount, price) => {
      const outcome = app.tradeService.createGoldOffer(
        currentProfile(app, get()),
        goldAmount,
        price,
        Date.now(),
      );
      if (!outcome.ok) return false;
      commit(set);
      return true;
    },

    delistOffer: (offerId) => {
      const outcome = app.tradeService.delistOffer(currentProfile(app, get()), offerId, Date.now());
      if (!outcome.ok) return false;
      commit(set);
      return true;
    },

    deliverOffer: (offerId) => {
      const outcome = app.tradeService.deliverOffer(currentProfile(app, get()), offerId, Date.now());
      if (!outcome.ok) return false;
      commit(set);
      return true;
    },

    grantHero: (heroId) => {
      if (getHeroById(heroId) === undefined) return;
      const profile = withHero(currentProfile(app, get()), heroId);
      if (profile.ownedHeroes.length === get().ownedHeroIds.length) return;
      app.players.save(profile);
      commit(set);
    },

    grantGachaHeroes: (heroIds) => {
      if (heroIds.length === 0) return false;
      const outcome = app.fusionService.grantCopies(currentProfile(app, get()), heroIds);
      if (!outcome.ok) return false;
      commit(set);
      return true;
    },

    fuseHero: (heroId) => {
      if (getHeroById(heroId) === undefined) return false;
      const outcome = app.fusionService.fuse(currentProfile(app, get()), heroId, Date.now());
      if (!outcome.ok) return false;
      commit(set);
      return true;
    },

    upgradeHero: (heroId) => {
      if (getHeroById(heroId) === undefined) return false;
      if (heroLevelOf(get().heroLevels, heroId) >= maxLevelForStars(heroStarsOf(get().heroStars, heroId))) {
        return false;
      }
      const cost = upgradeCost(heroLevelOf(get().heroLevels, heroId));
      if (cost === null) return false;
      const paid = app.goldService.debit(currentProfile(app, get()), cost, { kind: 'SPEND' }, Date.now());
      if (!paid.ok) return false;
      const profile = paid.profile;
      app.players.save({
        ...profile,
        heroLevels: { ...profile.heroLevels, [heroId]: heroLevelOf(profile.heroLevels, heroId) + 1 },
      });
      commit(set);
      return true;
    },

    addGold: (amount, ref = {}) => {
      const outcome = app.goldService.credit(currentProfile(app, get()), amount, ref, Date.now());
      if (!outcome.ok) return false;
      commit(set);
      return true;
    },

    /**
     * Takes $GOLD out. Refused when it would go below zero - the balance is
     * left untouched rather than clamped.
     */
    debitGold: (amount, ref = {}) => {
      const outcome = app.goldService.debit(currentProfile(app, get()), amount, ref, Date.now());
      if (!outcome.ok) return false;
      commit(set);
      return true;
    },

    /**
     * Shows a reward that the Reward Service has already paid.
     *
     * It moves no money: paying is the service's job, and it has already been
     * written to the ledger by the time this runs. All this does is re-read
     * the save and pick out the transaction belonging to this battle, so the
     * result card can never show a payout the ledger does not hold.
     */
    applyReward: (outcome) => {
      commit(set);
      const battleId = outcome.transaction.battleId;
      const recorded =
        battleId === null
          ? null
          : (get().goldTransactions.find((entry) => entry.battleId === battleId) ?? null);
      set({ lastReward: recorded });
    },

    /** Drops the payout on screen. The ledger keeps it. */
    clearLastReward: () => {
      set({ lastReward: null });
    },

    /**
     * Wipes the save and starts a new player. Used by Settings, and by checks
     * that want a clean slate.
     *
     * Only the DATA is reset. The actions belong to the store, not to the save,
     * so they survive the wipe - a reset that replaced them with stubs would
     * leave a store that can no longer save anything.
     */
    resetProgress: () => {
      app.gold.clear();
      app.battles.clear();
      app.players.clear();
      set(blankData());
      commit(set);
    },
  }));
};

/** Starts a store bound to a runtime and reads the save back immediately. */
export const createHydratedPlayerStore = (app: AppRuntime): PlayerStore => {
  const store = createPlayerStore(app);
  // Read the save back the moment the store exists, so nothing downstream can
  // ever observe a half-empty player.
  store.getState().hydrate();
  return store;
};

/** The live profile, preferring what is on disk. */
const currentProfile = (app: AppRuntime, state: PlayerState): PlayerProfile =>
  app.players.load((playerId) => app.gold.rebuildBalance(playerId)) ?? {
    version: STORAGE_VERSION,
    playerId: state.playerId,
    username: state.username,
    equippedHeroId: state.equippedHeroId,
    ownedHeroes: state.ownedHeroIds,
    heroLevels: state.heroLevels,
    heroStars: state.heroStars,
    heroCopies: state.heroCopies,
    heroSerials: state.heroSerials,
    tradeOffers: state.tradeOffers,
    mining: state.mining,
    goldBalance: state.gold,
    bwarBalance: state.bwar,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };

/** The store the game runs on. */
export const usePlayerStore = createHydratedPlayerStore(defaultRuntime);
