/**
 * Minimal, dependency-free Telegram Web App bridge.
 *
 * Every call is optional and fails silently so the app also runs in a plain
 * browser during development. No wallet, no chain, no auth - presentation only.
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type HapticNotification = 'error' | 'success' | 'warning';

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  disableVerticalSwipes?: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void;
    notificationOccurred: (type: HapticNotification) => void;
    selectionChanged: () => void;
  };
  colorScheme?: 'light' | 'dark';
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const getApp = (): TelegramWebApp | undefined =>
  typeof window === 'undefined' ? undefined : window.Telegram?.WebApp;

/** Call once on boot. */
export const initTelegram = (): void => {
  const app = getApp();
  if (!app) return;
  try {
    app.ready?.();
    app.expand?.();
    app.setHeaderColor?.('#080B12');
    app.setBackgroundColor?.('#080B12');
    app.disableVerticalSwipes?.();
  } catch {
    /* never let the host app break the game */
  }
};

/** Wires Telegram's native back button to a callback. Returns a cleanup fn. */
export const bindBackButton = (onBack: () => void, enabled: boolean): (() => void) => {
  const back = getApp()?.BackButton;
  if (!back) return () => undefined;
  try {
    if (enabled) {
      back.onClick(onBack);
      back.show();
    } else {
      back.offClick(onBack);
      back.hide();
    }
  } catch {
    /* ignore */
  }
  return () => {
    try {
      back.offClick(onBack);
    } catch {
      /* ignore */
    }
  };
};

export const haptic = {
  select: () => {
    try {
      getApp()?.HapticFeedback?.selectionChanged();
    } catch {
      /* ignore */
    }
  },
  impact: (style: HapticStyle = 'medium') => {
    try {
      getApp()?.HapticFeedback?.impactOccurred(style);
    } catch {
      /* ignore */
    }
  },
  notify: (type: HapticNotification = 'success') => {
    try {
      getApp()?.HapticFeedback?.notificationOccurred(type);
    } catch {
      /* ignore */
    }
  },
};
