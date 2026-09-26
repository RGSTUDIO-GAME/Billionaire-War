import type { PlaceholderKind } from './types';

const INK = '#0B0E15';
const GOLD = '#F5C542';
const STEEL = '#39435C';

const encode = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const frame = (inner: string, label: string, tint = GOLD) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 768" width="512" height="768">
  <rect width="512" height="768" fill="${INK}"/>
  <rect x="16" y="16" width="480" height="736" rx="20" fill="none" stroke="${tint}" stroke-opacity="0.35" stroke-width="4" stroke-dasharray="14 12"/>
  ${inner}
  <text x="256" y="700" text-anchor="middle" font-family="system-ui, sans-serif" font-size="30" fill="${tint}" fill-opacity="0.8">${label}</text>
</svg>`;

const SILHOUETTE = `
  <g fill="${STEEL}" opacity="0.9">
    <circle cx="256" cy="200" r="62"/>
    <rect x="176" y="278" width="160" height="230" rx="34"/>
    <rect x="94" y="292" width="72" height="210" rx="34"/>
    <rect x="346" y="292" width="72" height="210" rx="34"/>
    <rect x="184" y="520" width="66" height="130" rx="30"/>
    <rect x="262" y="520" width="66" height="130" rx="30"/>
  </g>`;

const builders: Record<PlaceholderKind, (label: string) => string> = {
  hero: (label) => frame(SILHOUETTE, label),
  heroPose: (label) => frame(`${SILHOUETTE}<circle cx="256" cy="140" r="46" fill="${GOLD}" fill-opacity="0.25"/>`, label, GOLD),
  background: (label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
    <rect width="1280" height="720" fill="${INK}"/>
    <rect y="520" width="1280" height="200" fill="#141A28"/>
    <g stroke="${GOLD}" stroke-opacity="0.25" stroke-width="3">
      ${Array.from({ length: 7 }, (_, i) => `<line x1="${i * 200 - 200}" y1="520" x2="${i * 200 + 300}" y2="720"/>`).join('')}
    </g>
    <text x="640" y="360" text-anchor="middle" font-family="system-ui, sans-serif" font-size="46" fill="${GOLD}">${label}</text>
  </svg>`,
  icon: (_label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${GOLD}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>
  </svg>`,
  ui: (_label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect x="2" y="2" width="60" height="60" rx="14" fill="#141A28" stroke="${GOLD}" stroke-opacity="0.5" stroke-width="2"/>
  </svg>`,
  effect: (_label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
    <g stroke="${GOLD}" stroke-width="7" stroke-linecap="round">
      ${Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4;
        return `<line x1="${(64 + Math.cos(angle) * 24).toFixed(1)}" y1="${(64 + Math.sin(angle) * 24).toFixed(1)}" x2="${(64 + Math.cos(angle) * 52).toFixed(1)}" y2="${(64 + Math.sin(angle) * 52).toFixed(1)}"/>`;
      }).join('')}
    </g>
  </svg>`,
  audio: () => '',
};

const cache = new Map<string, string>();

/**
 * Inline artwork used when every file in an asset's fallback chain is missing.
 * Never returns undefined, so the UI always has something to render.
 */
export const getPlaceholder = (kind: PlaceholderKind, label: string): string => {
  const key = `${kind}:${label}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const built = encode(builders[kind](label));
  cache.set(key, built);
  return built;
};
