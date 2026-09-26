/**
 * Generates the default placeholder art and audio for Billionaire War.
 *
 * These files are REAL files in /public/assets so that the game looks alive
 * on day one, and so that swapping them is literally "drop a file with the
 * same name in the same folder". Re-run with:
 *   node scripts/generate-placeholder-assets.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');

const C = {
  gold: '#F5C542',
  goldLight: '#FFE9A8',
  crimson: '#E2483C',
  crimsonDark: '#8E241C',
  steel: '#39435C',
  steelLight: '#5A678A',
  ink: '#0B0E15',
  steelMid: '#222A3B',
};

const write = (relPath, content) => {
  const full = join(OUT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return relPath;
};

/* ------------------------------------------------------------------ heroes */

const HEAD = (cx, cy, r = 46) => `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#skin)" stroke="#0B0E15" stroke-width="5"/>`;

const TORSO = (x, y, w, h) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="url(#suit)" stroke="#0B0E15" stroke-width="5"/>`;

const LIMB = (x, y, w, h, fill = 'url(#limb)', rotate = 0) => `
    <g transform="rotate(${rotate} ${x + w / 2} ${y + h / 2})">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="${fill}" stroke="#0B0E15" stroke-width="5"/>
    </g>`;

const FIGURE_DEFS = `
  <defs>
    <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.steelLight}"/>
      <stop offset="100%" stop-color="${C.steel}"/>
    </linearGradient>
    <linearGradient id="limb" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4C5877"/>
      <stop offset="100%" stop-color="#2C3448"/>
    </linearGradient>
    <radialGradient id="skin" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#F3D6BC"/>
      <stop offset="100%" stop-color="#C89A79"/>
    </radialGradient>
  </defs>`;

const GROUND = `
  <ellipse cx="256" cy="688" rx="168" ry="26" fill="#0B0E15" opacity="0.45"/>`;

/** Base hero body, shared by every hero pose. */
const body = ({ lean = 0, armLeft = 0, armRight = 0, tone = C.gold }) => `
  <g transform="translate(256 360) rotate(${lean}) translate(-256 -360)">
    ${HEAD(256, 118)}
    ${TORSO(196, 172, 120, 196)}
    ${LIMB(126, 186, 62, 176, 'url(#limb)', armLeft)}
    ${LIMB(324, 186, 62, 176, 'url(#limb)', armRight)}
    ${LIMB(204, 372, 54, 250, 'url(#limb)', 2)}
    ${LIMB(254, 372, 54, 250, 'url(#limb)', -2)}
    <path d="M228 372 L256 430 L284 372" fill="none" stroke="${tone}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

const ZONES = `
  <g fill="none" stroke="${C.gold}" stroke-width="4" stroke-dasharray="12 10" opacity="0.85">
    <circle cx="256" cy="118" r="54"/>
    <rect x="192" y="168" width="128" height="204" rx="30"/>
    <rect x="120" y="180" width="74" height="188" rx="34"/>
    <rect x="318" y="180" width="74" height="188" rx="34"/>
  </g>`;

const svg = (bodyContent, extraDefs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 768" width="512" height="768" role="img">
  ${FIGURE_DEFS}
  <defs>${extraDefs}</defs>
  ${GROUND}
  ${bodyContent}
</svg>
`;

const MOTION = `
  <g stroke="${C.goldLight}" stroke-width="7" stroke-linecap="round" opacity="0.8">
    <line x1="40" y1="300" x2="150" y2="300"/>
    <line x1="20" y1="360" x2="130" y2="360"/>
    <line x1="44" y1="420" x2="150" y2="420"/>
  </g>`;

const HERO_FILES = {
  'idle.svg': svg(`${body({ tone: C.gold })}`),
  'character.svg': svg(`${body({ tone: C.gold })}${ZONES}`),
  'attack_head.svg': svg(`${body({ lean: -6, armRight: -34, tone: C.crimson })}${MOTION}
    <path d="M300 150 L470 70" stroke="${C.crimson}" stroke-width="12" stroke-linecap="round"/>
    <path d="M470 70 l-40 -6 l16 34 z" fill="${C.crimson}"/>`),
  'attack_body.svg': svg(`${body({ lean: -4, armRight: -20, tone: C.crimson })}${MOTION}
    <path d="M330 250 L500 260" stroke="${C.crimson}" stroke-width="14" stroke-linecap="round"/>
    <path d="M500 260 l-44 -14 l12 32 z" fill="${C.crimson}"/>`),
  'attack_arm.svg': svg(`${body({ lean: 6, armRight: -60, tone: C.crimson })}${MOTION}
    <path d="M360 300 L492 330" stroke="${C.crimson}" stroke-width="12" stroke-linecap="round"/>`),
  'attack_leg.svg': svg(`${body({ lean: 10, tone: C.crimson })}${MOTION}
    <path d="M300 560 L470 600" stroke="${C.crimson}" stroke-width="12" stroke-linecap="round"/>`),
  'defense.svg': svg(`<g>${body({ tone: C.steelLight })}</g>
    <path d="M256 150 L392 214 L392 384 Q392 486 256 546 Q120 486 120 384 L120 214 Z"
      fill="${C.steel}" opacity="0.72" stroke="${C.gold}" stroke-width="7"/>`),
  'hit.svg': svg(`${body({ lean: 14, armLeft: 26, armRight: -20, tone: C.crimson })}
    <g stroke="${C.crimson}" stroke-width="9" stroke-linecap="round">
      <line x1="120" y1="90" x2="180" y2="150"/>
      <line x1="180" y1="90" x2="120" y2="150"/>
      <line x1="330" y1="120" x2="390" y2="180"/>
      <line x1="390" y1="120" x2="330" y2="180"/>
    </g>`),
  'victory.svg': svg(`${body({ armLeft: -150, armRight: -150, tone: C.gold })}
    <circle cx="256" cy="96" r="52" fill="none" stroke="${C.gold}" stroke-width="8" opacity="0.9"/>
    <g stroke="${C.goldLight}" stroke-width="6" stroke-linecap="round" opacity="0.85">
      <line x1="120" y1="700" x2="392" y2="700"/>
    </g>`),
  'defeat.svg': svg(`${body({ lean: 62, armLeft: 44, armRight: -34, tone: C.steelLight })}`),
};

for (const [file, content] of Object.entries(HERO_FILES)) {
  write(`heroes/durov/${file}`, content);
}

/* ------------------------------------------------------------- backgrounds */

const arenaBg = (skyA, skyB, floor) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${skyA}"/>
      <stop offset="100%" stop-color="${skyB}"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="8%" r="70%">
      <stop offset="0%" stop-color="${C.gold}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#sky)"/>
  <rect width="1280" height="720" fill="url(#spot)"/>
  <g fill="#0B0E15" opacity="0.55">
    <rect x="90" y="250" width="120" height="290"/>
    <rect x="270" y="180" width="90" height="360"/>
    <rect x="920" y="200" width="100" height="340"/>
    <rect x="1080" y="280" width="130" height="260"/>
  </g>
  <rect y="520" width="1280" height="200" fill="${floor}"/>
  <g stroke="${C.gold}" stroke-opacity="0.18" stroke-width="2">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${-200 + i * 200}" y1="520" x2="${260 + i * 260}" y2="720"/>`).join('\n    ')}
    ${Array.from({ length: 4 }, (_, i) => `<line x1="0" y1="${540 + i * 50}" x2="1280" y2="${540 + i * 50}"/>`).join('\n    ')}
  </g>
</svg>
`;

write('backgrounds/battle_arena.svg', arenaBg('#1A2136', '#0A0D16', '#12172A'));
write('backgrounds/home.svg', arenaBg('#221A2E', '#0A0D16', '#171226'));
write('backgrounds/menu.svg', arenaBg('#16202F', '#080B12', '#101724'));

/* -------------------------------------------------------------------- ui */

write('ui/panel.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="2" y="2" width="60" height="60" rx="14" fill="#141A28" fill-opacity="0.92" stroke="${C.gold}" stroke-opacity="0.5" stroke-width="2"/>
  <path d="M10 10 L54 10" stroke="${C.gold}" stroke-opacity="0.7" stroke-width="3" stroke-linecap="round"/>
</svg>
`);

write('ui/divider.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 8" width="200" height="8">
  <defs>
    <linearGradient id="d" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.gold}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${C.gold}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${C.gold}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="200" height="2" y="3" fill="url(#d)"/>
</svg>
`);

write('ui/button_glow.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 64" width="200" height="64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.crimsonDark}"/>
      <stop offset="50%" stop-color="${C.crimson}"/>
      <stop offset="100%" stop-color="${C.crimsonDark}"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="198" height="62" rx="14" fill="url(#g)" stroke="${C.gold}" stroke-width="2"/>
</svg>
`);

/* ---------------------------------------------------------------- effects */

write('effects/hit_spark.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <g stroke="${C.goldLight}" stroke-width="7" stroke-linecap="round">
    ${Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      const x1 = 64 + Math.cos(a) * 26;
      const y1 = 64 + Math.sin(a) * 26;
      const x2 = 64 + Math.cos(a) * 58;
      const y2 = 64 + Math.sin(a) * 58;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }).join('\n    ')}
  </g>
  <circle cx="64" cy="64" r="18" fill="${C.goldLight}" opacity="0.9"/>
</svg>
`);

write('effects/block_shield.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <path d="M64 8 L114 28 L114 66 Q114 100 64 120 Q14 100 14 66 L14 28 Z"
    fill="${C.steel}" fill-opacity="0.6" stroke="${C.gold}" stroke-width="6"/>
  <path d="M40 64 L58 84 L90 46" fill="none" stroke="${C.goldLight}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

write('effects/damage_number.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 96" width="160" height="96">
  <text x="80" y="66" text-anchor="middle" font-family="Impact, Haettenschweiler, sans-serif"
    font-size="58" fill="${C.crimson}" stroke="${C.gold}" stroke-width="3" paint-order="stroke">-200</text>
</svg>
`);

/* ------------------------------------------------------------------ icons */

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  quest: '<path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M14 4v5h5"/><path d="M7 13h8M7 17h5"/>',
  inventory: '<path d="M3 7h18v13H3z"/><path d="M3 7 5 3h14l2 4"/><path d="M10 11h4v4h-4z"/>',
  hero: '<circle cx="12" cy="7" r="3.4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/><path d="M10 14h4v4h-4z"/><path d="M7.5 20h9"/>',
  swords: '<path d="M4 4h3l9 9-3 3-9-9z"/><path d="M20 4h-3l-9 9 3 3 9-9z"/><path d="M4 20l3.5-3.5M20 20l-3.5-3.5"/>',
  heart: '<path d="M12 20s-7.5-4.7-7.5-9.5A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.5C19.5 15.3 12 20 12 20z"/>',
  shield: '<path d="M12 3l8 3v6c0 4.7-3.4 8.3-8 9.5C7.4 20.3 4 16.7 4 12V6z"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5h4a1.8 1.8 0 0 1 0 3.6h-4"/>',
  star: '<path d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  robot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4"/><circle cx="9" cy="14" r="1.4"/><circle cx="15" cy="14" r="1.4"/>',
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
  gold: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v9c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 11.5c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  bwar: '<path d="M12 2.5 20 9l-8 12.5L4 9z"/><path d="M4 9h16M12 2.5 8.5 9 12 21.5 15.5 9z"/>',
  part_head: '<circle cx="12" cy="9" r="5"/><path d="M8 13.5h8"/>',
  part_body: '<path d="M9 3h6l1.5 4v9h-9V7z"/><path d="M9 3 6 6M15 3l3 3"/>',
  part_arm: '<path d="M8 3v18"/><path d="M8 7h5a3 3 0 0 1 0 6H8"/><circle cx="8" cy="3" r="1.6"/>',
  part_leg: '<path d="M9 3v9a4 4 0 0 0 8 0V3"/><path d="M6 3h14"/>',
};

for (const [name, pathData] of Object.entries(ICONS)) {
  write(
    `icons/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none"
  stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${pathData}</svg>\n`,
  );
}

/* ------------------------------------------------------------------ audio */

const SAMPLE_RATE = 22050;

const writeWav = (relPath, samples) => {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32000), 44 + i * 2);
  }
  write(relPath, buffer);
};

const tone = ({ freq, ms, type = 'sine', decay = 6, sweep = 0, gain = 0.5 }) => {
  const length = Math.floor((SAMPLE_RATE * ms) / 1000);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const progress = i / length;
    const current = freq + sweep * progress;
    const wave =
      type === 'square'
        ? Math.sign(Math.sin(2 * Math.PI * current * t))
        : type === 'saw'
          ? 2 * (t * current - Math.floor(0.5 + t * current))
          : Math.sin(2 * Math.PI * current * t);
    out[i] = wave * gain * Math.exp(-decay * progress);
  }
  return out;
};

const concat = (...parts) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

writeWav('sounds/ui_select.wav', tone({ freq: 880, ms: 90, type: 'square', decay: 9, gain: 0.25 }));
writeWav('sounds/ui_confirm.wav', concat(tone({ freq: 660, ms: 90, decay: 8, gain: 0.3 }), tone({ freq: 990, ms: 140, decay: 7, gain: 0.3 })));
writeWav('sounds/countdown_tick.wav', tone({ freq: 520, ms: 160, type: 'square', decay: 10, gain: 0.28 }));
writeWav('sounds/attack_whoosh.wav', tone({ freq: 320, ms: 260, type: 'saw', decay: 4, sweep: 420, gain: 0.35 }));
writeWav('sounds/hit.wav', concat(tone({ freq: 180, ms: 300, type: 'square', decay: 7, sweep: -110, gain: 0.45 })));
writeWav('sounds/block.wav', concat(tone({ freq: 1200, ms: 120, decay: 14, gain: 0.22 }), tone({ freq: 700, ms: 200, decay: 8, gain: 0.2 })));
writeWav('sounds/victory.wav', concat(tone({ freq: 523, ms: 130, decay: 2.5, gain: 0.35 }), tone({ freq: 659, ms: 130, decay: 2.5, gain: 0.35 }), tone({ freq: 784, ms: 130, decay: 2.5, gain: 0.35 }), tone({ freq: 1046, ms: 420, decay: 2.2, gain: 0.38 })));
writeWav('sounds/defeat.wav', concat(tone({ freq: 392, ms: 220, decay: 2, gain: 0.32 }), tone({ freq: 311, ms: 220, decay: 2, gain: 0.32 }), tone({ freq: 233, ms: 520, decay: 1.6, gain: 0.32 })));
writeWav('music/battle_theme.wav', concat(
  tone({ freq: 262, ms: 340, type: 'saw', decay: 1.4, gain: 0.16 }),
  tone({ freq: 330, ms: 340, type: 'saw', decay: 1.4, gain: 0.16 }),
  tone({ freq: 392, ms: 340, type: 'saw', decay: 1.4, gain: 0.16 }),
  tone({ freq: 330, ms: 340, type: 'saw', decay: 1.4, gain: 0.16 }),
  tone({ freq: 262, ms: 340, type: 'saw', decay: 1.4, gain: 0.16 }),
  tone({ freq: 294, ms: 340, type: 'saw', decay: 1.4, gain: 0.16 }),
  tone({ freq: 349, ms: 340, type: 'saw', decay: 1.4, gain: 0.16 }),
  tone({ freq: 262, ms: 460, type: 'saw', decay: 1.2, gain: 0.16 }),
));

console.log('Placeholder assets written to public/assets');
