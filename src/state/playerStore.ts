import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STARTING_BWAR, STARTING_GOLD } from '../data/balance';
import { getFreeHeroes } from '../data/heroes';
import type { GoldTransaction, RewardOutcome } from '../rewards';

/**
 * PLAYER STATE
 * ============
 * $GOLD balance, hero ownership, and the $GOLD reward ledger.
 * No wallet, no chain, no token transactions - purely local game data.
 */

const createPlayerId = (): string => {
  const source = globalThis.crypto;
  if (typeof source?.randomUUID === 'function') {
    return `player_${source.randomUUID().slice(0, 8)}`;
  }
  return `player_${Date.now().toString(36)}`;
};

export type PlayerState = {
  /** Stable local identity. Part of the reward settlement key. */
  playerId: string;
  /** $GOLD - internal game currency. */
  gold: number;
  /** $BWAR - utility token placeholder. Display only for now. */
  bwar: number;
  ownedHeroIds: string[];
  equippedHeroId: string;
  /** Every $GOLD payout, newest first. */
  goldTransactions: GoldTransaction[];
  /** Settlement keys already paid, so a battle can never pay twice. */
  settledRewards: string[];
  /** The most recent payout, tagged with the battle that earned it. */
  lastReward: GoldTransaction | null;

  equipHero: (heroId: string) => void;
  grantHero: (heroId: string) => void;
  addGold: (amount: number) => void;
  addBwar: (amount: number) => void;
  /**
   * Applies a settled reward. The guard is repeated here on purpose: the
   * Reward Engine already refuses a duplicate, and the balance refuses one
   * too even if something asks twice.
   */
  applyReward: (outcome: RewardOutcome) => void;
  clearLastReward: () => void;
  resetProgress: () => void;
};

const initialOwned = getFreeHeroes().map((hero) => hero.id);
const initialEquipped = initialOwned[0] ?? '';

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      playerId: createPlayerId(),
      gold: STARTING_GOLD,
      bwar: STARTING_BWAR,
      ownedHeroIds: initialOwned,
      equippedHeroId: initialEquipped,
      goldTransactions: [],
      settledRewards: [],
      lastReward: null,

      equipHero: (heroId) => set({ equippedHeroId: heroId }),

      grantHero: (heroId) =>
        set((state) =>
          state.ownedHeroIds.includes(heroId)
            ? state
            : { ownedHeroIds: [...state.ownedHeroIds, heroId] },
        ),

      addGold: (amount) => set((state) => ({ gold: Math.max(0, state.gold + amount) })),
      addBwar: (amount) => set((state) => ({ bwar: Math.max(0, state.bwar + amount) })),

      applyReward: (outcome) =>
        set((state) => {
          if (state.settledRewards.includes(outcome.settlementKey)) return state;
          return {
            gold: state.gold + outcome.amount,
            goldTransactions: [outcome.transaction, ...state.goldTransactions],
            settledRewards: [...state.settledRewards, outcome.settlementKey],
            lastReward: outcome.transaction,
          };
        }),

      clearLastReward: () => set({ lastReward: null }),

      resetProgress: () =>
        set({
          gold: STARTING_GOLD,
          bwar: STARTING_BWAR,
          ownedHeroIds: initialOwned,
          equippedHeroId: initialEquipped,
          goldTransactions: [],
          settledRewards: [],
          lastReward: null,
        }),
    }),
    { name: 'billionaire-war:player', version: 1 },
  ),
);
