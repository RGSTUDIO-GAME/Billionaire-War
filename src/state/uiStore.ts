import { create } from 'zustand';

export type Screen =
  | 'home'
  | 'quest'
  | 'inventory'
  | 'hero'
  | 'settings'
  | 'leaderboard'
  | 'war-entry'
  | 'battle'
  | 'mining-select'
  | 'mining'
  | 'trade';

export type NavParams = Record<string, string>;

type NavEntry = { screen: Screen; params?: NavParams };

export type UiState = {
  stack: NavEntry[];
  navigate: (screen: Screen, params?: NavParams) => void;
  back: () => void;
  reset: () => void;
};

const ROOT_NAV: NavEntry = { screen: 'home' };

/** Simple stack router - Telegram's own back button is wired to `back()`. */
export const useUiStore = create<UiState>()((set) => ({
  stack: [ROOT_NAV],

  navigate: (screen, params) =>
    set((state) => {
      const current = state.stack[state.stack.length - 1];
      if (current?.screen === screen) return state;
      return { stack: [...state.stack, { screen, params }] };
    }),

  back: () =>
    set((state) => (state.stack.length > 1 ? { stack: state.stack.slice(0, -1) } : state)),

  reset: () => set({ stack: [ROOT_NAV] }),
}));
