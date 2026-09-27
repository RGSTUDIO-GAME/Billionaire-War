/**
 * STORAGE KEYS
 * ============
 * One place that knows where each record lives. The version suffix is what a
 * future migration hangs off: a v2 loader can read `…:v2` while an installed
 * `…:v1` build keeps reading its own key.
 */
export const STORAGE_VERSION = 1;

export const STORAGE_KEYS = {
  player: `billionaire-war:player:v${STORAGE_VERSION}`,
  goldLedger: `billionaire-war:gold-ledger:v${STORAGE_VERSION}`,
  battleHistory: `billionaire-war:battle-history:v${STORAGE_VERSION}`,
} as const;
