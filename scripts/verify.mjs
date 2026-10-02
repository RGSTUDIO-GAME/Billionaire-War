/**
 * Bundles the TypeScript checks with esbuild and runs them on Node.
 *   scripts/engine-check.ts - battle engine rules
 *   scripts/flow-check.ts   - battle store / runtime flow
 *   scripts/view-check.ts   - presentation layer / what the screen draws
 *   scripts/asset-check.ts  - animation controller + asset resolution
 *   scripts/render-check.ts - the battle screen, rendered for real
 *   scripts/reward-check.ts - $GOLD rewards, ledger and anti-duplicate rules
 *   scripts/data-check.ts   - the data layer: storage, repositories, services
 *   scripts/trade-check.ts  - local hero and Gold marketplace rules
 *   scripts/fusion-check.ts - star tiers, serials, copies and fusion costs
 *   scripts/fusion-render-check.tsx - the Hero screen star and Fusion UI
 *   scripts/trade-render-check.tsx - the marketplace UI entry points
 *   scripts/gacha-render-check.tsx - the reveal screen and Home entry point
 */
import { build } from 'esbuild';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(join(tmpdir(), 'bwar-verify-'));
// CJS output: react-dom/server is CommonJS and still requires node builtins.
const require = createRequire(import.meta.url);

/**
 * The checks run on Node, which has no window or localStorage. zustand's
 * persist middleware defaults to `window.localStorage` and silently drops
 * every write without it, so give the checks a throwaway in-memory one.
 */
if (typeof globalThis.window === 'undefined') {
  const cells = new Map();
  const storage = {
    getItem: (key) => (cells.has(key) ? cells.get(key) : null),
    setItem: (key, value) => void cells.set(key, String(value)),
    removeItem: (key) => void cells.delete(key),
    clear: () => cells.clear(),
    key: (index) => [...cells.keys()][index] ?? null,
    get length() {
      return cells.size;
    },
  };
  globalThis.localStorage = storage;
  globalThis.window = { localStorage: storage };
}
const entries = [
  'engine-check',
  'flow-check',
  'view-check',
  'reward-check',
  'data-check',
  'asset-check',
  'render-check',
  'mining-check',
  'trade-check',
  'trade-render-check',
  'fusion-check',
  'fusion-render-check',
  'gacha-render-check',
];

/**
 * The render check renders real React, and React's static renderer takes a
 * store's server snapshot from getInitialState(). Swap in a store whose
 * snapshot is the live state so the screen renders the running battle.
 * Applied to the render check only - every other check is untouched.
 */
const liveSnapshot = {
  name: 'live-snapshot-store',
  setup(build) {
    build.onResolve({ filter: /^zustand\/vanilla$/ }, () => ({
      path: join(ROOT, 'scripts', 'live-snapshot-store.mjs'),
    }));
  },
};

/** Checks are .ts, except the render check, which needs JSX. */
const entryFor = (name) => {
  for (const extension of ['.ts', '.tsx']) {
    const candidate = join(ROOT, 'scripts', `${name}${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`No verification script found for ${name}`);
};

try {
  for (const name of entries) {
    const outFile = join(outDir, `${name}.cjs`);
    await build({
      entryPoints: [entryFor(name)],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node20',
      outfile: outFile,
      logLevel: 'warning',
      // The root tsconfig only references sub-projects, so JSX has to be
      // enabled here for the render check.
      jsx: 'automatic',
      plugins: name === 'render-check' ? [liveSnapshot] : [],
    });
    require(outFile);
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
