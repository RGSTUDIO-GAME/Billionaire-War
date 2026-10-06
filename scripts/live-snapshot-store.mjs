/**
 * Test-only stand-in for `zustand/vanilla`, injected by scripts/verify.mjs
 * into the React render-check bundles only.
 *
 * React's static renderer reads a store's `getInitialState()` as its server
 * snapshot. A battle lives in `getState()`, so a static render would always
 * see the empty starting state and the screen would render nothing. Pointing
 * the snapshot at the live state lets the render checks assert the real screens.
 *
 * The game bundle is untouched: this file is never part of `npm run build`.
 */
import { createStore as createVanillaStore } from '../node_modules/zustand/esm/vanilla.mjs';

export const createStore = (createState) => {
  const api = createVanillaStore(createState);
  api.getInitialState = api.getState;
  return api;
};
