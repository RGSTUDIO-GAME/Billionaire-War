import { getPlaceholder } from './placeholders';
import { ASSET_ENTRIES } from './manifest';
import type { AssetEntry, AssetId } from './types';

const BASE_PATH = '/assets';

const byId = new Map<AssetId, AssetEntry>(ASSET_ENTRIES.map((entry) => [entry.id, entry]));

/** Public URL of an asset file. Empty string when the id is unknown. */
export const getAssetUrl = (id: AssetId): string => {
  const entry = byId.get(id);
  if (!entry || !entry.file) return '';
  return `${BASE_PATH}/${entry.category}/${entry.file}`;
};

/**
 * Ordered list of sources to try for an asset id:
 * the file itself, then its declared fallbacks, then inline artwork.
 * This is what stops a missing file from ever crashing or breaking the UI.
 */
export const getFallbackChain = (id: AssetId): string[] => {
  const chain: string[] = [];
  const seen = new Set<AssetId>();
  let current: AssetId | undefined = id;

  while (current && !seen.has(current)) {
    seen.add(current);
    const url = getAssetUrl(current);
    if (url) chain.push(url);
    current = byId.get(current)?.fallback;
  }

  const entry = byId.get(id);
  const inline = entry ? getPlaceholder(entry.placeholder, entry.label) : '';
  if (inline) chain.push(inline);

  return chain.length > 0 ? chain : [getPlaceholder('icon', 'missing')];
};

/** True when the asset id is registered in the global manifest. */
export const isRegistered = (id: AssetId): boolean => byId.has(id);

/** Warms the browser cache for every image asset in the manifest. */
export const prefetchAllAssets = (): void => {
  for (const entry of ASSET_ENTRIES) {
    if (entry.category === 'sounds' || entry.category === 'music') continue;
    const url = getAssetUrl(entry.id);
    if (!url) continue;
    const image = new Image();
    image.src = url;
  }
};
