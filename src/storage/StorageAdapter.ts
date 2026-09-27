/**
 * STORAGE ADAPTER
 * ===============
 * The only thing the game knows about persistence. Everything above it -
 * repositories, services, stores, UI - talks to this interface and never to
 * `localStorage` directly.
 *
 * That is what makes the storage replaceable: swapping localStorage for a
 * server sync, an IndexedDB cache or a test double is a one-line change here,
 * and nothing above has to be rewritten.
 */
export interface StorageAdapter {
  read(key: string): string | null;
  /** Returns false when the write could not be persisted. */
  write(key: string, value: string): boolean;
  remove(key: string): void;
  keys(): string[];
}

/** In-memory storage. Used by tests to model a device's localStorage. */
export const memoryStorage = (seed: Record<string, string> = {}): StorageAdapter => {
  const cells = new Map(Object.entries(seed));
  return {
    read: (key) => (cells.has(key) ? (cells.get(key) as string) : null),
    write: (key, value) => {
      cells.set(key, value);
      return true;
    },
    remove: (key) => void cells.delete(key),
    keys: () => [...cells.keys()],
  };
};

/**
 * Browser storage, degrading to memory when it is unavailable - private mode,
 * a blocked third-party context, or plain Node during a test run. A save that
 * fails is reported, never thrown: losing persistence must not end the game.
 */
export const browserStorage = (): StorageAdapter => {
  const backing = (() => {
    try {
      const probe = '__bwar_probe__';
      globalThis.localStorage?.setItem(probe, '1');
      globalThis.localStorage?.removeItem(probe);
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  })();

  if (!backing) return memoryStorage();

  return {
    read: (key) => {
      try {
        return backing.getItem(key);
      } catch {
        return null;
      }
    },
    write: (key, value) => {
      try {
        backing.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove: (key) => {
      try {
        backing.removeItem(key);
      } catch {
        /* nothing useful to do */
      }
    },
    keys: () => {
      try {
        const found: string[] = [];
        for (let index = 0; index < backing.length; index += 1) {
          const key = backing.key(index);
          if (key !== null) found.push(key);
        }
        return found;
      } catch {
        return [];
      }
    },
  };
};

/** What the running game uses. */
export const resolveStorage = (): StorageAdapter => browserStorage();
