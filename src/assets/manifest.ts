import type { AssetCategory, AssetEntry, AssetId, HeroAssetKey, PlaceholderKind } from './types';

/**
 * GLOBAL ASSET CONFIGURATION
 * =========================
 * The single place in the codebase where asset file paths live.
 *
 * To replace art: drop a file with the same name into
 *   /public/assets/<category>/
 * To change the format (png / webp / spritesheet): change only `file` here.
 *
 * Nothing in the Battle Engine or in hero data references a file path.
 */
const entries: AssetEntry[] = [];
let sequence = 0;

const register = (
  category: AssetCategory,
  key: string,
  file: string,
  placeholder: PlaceholderKind,
  label: string,
  fallback?: AssetId,
  preload = true,
): AssetId => {
  sequence += 1;
  const id = `${category}.${key}#${sequence}`;
  entries.push({ id, category, file, placeholder, label, fallback, preload });
  return id;
};

const registerHero = (heroId: string, key: string, file: string, fallback?: AssetId, preload = true): AssetId => {
  sequence += 1;
  const id = `heroes.${heroId}.${key}#${sequence}`;
  entries.push({
    id,
    category: 'heroes',
    file: `${heroId}/${file}`,
    placeholder: key === 'character' ? 'hero' : 'heroPose',
    label: `${heroId} ${key}`,
    fallback,
    preload,
  });
  return id;
};

/* ---------------------------------------------------------------- fallback */

// Empty `file` = inline artwork only. These are the tail of every hero chain.
const PLACEHOLDER_HERO = register('heroes', '__placeholder_character', '', 'hero', 'Hero');
const PLACEHOLDER_POSE = register('heroes', '__placeholder_pose', '', 'heroPose', 'Pose');

/* ------------------------------------------------------------------ heroes */

const heroFiles: Record<HeroAssetKey, string> = {
  character: 'character.png',
  idle: 'idle/frame_01.png',
  attackHead: 'attack_head/frame_04.png',
  attackBody: 'attack_body/frame_05.png',
  attackArm: 'attack_arm/frame_05.png',
  attackLeg: 'attack_leg/frame_05.png',
  defense: 'defense/frame_04.png',
  hit: 'hit/frame_04.png',
  victory: 'victory/frame_08.png',
  defeat: 'defeat/frame_08.png',
};

/** Builds the asset id set for a hero folder. Missing files fall back gracefully. */
export const registerHeroAssets = (heroId: string): Record<HeroAssetKey, AssetId> => ({
  character: registerHero(heroId, 'character', heroFiles.character, PLACEHOLDER_HERO),
  idle: registerHero(heroId, 'idle', heroFiles.idle, PLACEHOLDER_POSE),
  attackHead: registerHero(heroId, 'attack_head', heroFiles.attackHead, PLACEHOLDER_POSE),
  attackBody: registerHero(heroId, 'attack_body', heroFiles.attackBody, PLACEHOLDER_POSE),
  attackArm: registerHero(heroId, 'attack_arm', heroFiles.attackArm, PLACEHOLDER_POSE),
  attackLeg: registerHero(heroId, 'attack_leg', heroFiles.attackLeg, PLACEHOLDER_POSE),
  defense: registerHero(heroId, 'defense', heroFiles.defense, PLACEHOLDER_POSE),
  hit: registerHero(heroId, 'hit', heroFiles.hit, PLACEHOLDER_POSE),
  victory: registerHero(heroId, 'victory', heroFiles.victory, PLACEHOLDER_POSE),
  defeat: registerHero(heroId, 'defeat', heroFiles.defeat, PLACEHOLDER_POSE),
});

export const heroAssetIds = registerHeroAssets('durov');

/* ------------------------------------------------------- animation frames */

export const HERO_FRAME_COUNT = 8;

const heroFrameFolder: Record<HeroAssetKey, string | null> = {
  character: null,
  idle: 'idle',
  attackHead: 'attack_head',
  attackBody: 'attack_body',
  attackArm: 'attack_arm',
  attackLeg: 'attack_leg',
  defense: 'defense',
  hit: 'hit',
  victory: 'victory',
  defeat: 'defeat',
};

const frameFile = (index: number): string => `frame_${String(index).padStart(2, '0')}.png`;

/**
 * Every animation frame of a pose, in play order. Stills stay the single
 * source of truth for the battle controller contract - frames are a
 * presentation-only layer on top, so a hero without frames still renders.
 */
const registerHeroFrames = (heroId: string): Record<HeroAssetKey, AssetId[]> => {
  const out = {} as Record<HeroAssetKey, AssetId[]>;
  (Object.keys(heroFrameFolder) as HeroAssetKey[]).forEach((key) => {
    const folder = heroFrameFolder[key];
    out[key] = folder
      ? Array.from({ length: HERO_FRAME_COUNT }, (_, i) =>
          registerHero(heroId, `${key}_frame_${i + 1}`, `${folder}/${frameFile(i + 1)}`, PLACEHOLDER_POSE, false),
        )
      : [];
  });
  return out;
};

export const heroFrames: Record<string, Record<HeroAssetKey, AssetId[]>> = {
  durov: registerHeroFrames('durov'),
};

/* ------------------------------------------------------- attack fx frames */

/**
 * Per-hero attack cinema: a projectile strip plus an impact strip.
 * Kept outside hero.assets (like portraits and frame strips) so the 10-key
 * contract holds - a hero without these folders simply has no cinema.
 */
export type HeroFxKind = 'projectile' | 'explosion';

const heroFxCount: Record<HeroFxKind, number> = {
  projectile: 4,
  explosion: 3,
};

const registerHeroFx = (heroId: string, kind: HeroFxKind): AssetId[] =>
  Array.from({ length: heroFxCount[kind] }, (_, index) =>
    registerHero(
      heroId,
      `${kind}_frame_${index + 1}`,
      `${kind}/frame_${String(index + 1).padStart(2, '0')}.png`,
      PLACEHOLDER_POSE,
      false,
    ),
  );

export const heroFxFrames: Record<string, Record<HeroFxKind, AssetId[]>> = {
  durov: {
    projectile: registerHeroFx('durov', 'projectile'),
    explosion: registerHeroFx('durov', 'explosion'),
  },
};

/** Display portrait per hero. Outside hero.assets so the 10-key contract holds. */
export const heroPortraitIds: Record<string, AssetId> = {
  durov: register('heroes', 'durov_portrait', 'durov/portrait.jpg', 'hero', 'Durov portrait'),
};

/* ------------------------------------------------------------ backgrounds */

export const backgroundIds = {
  battleArena: register('backgrounds', 'battle_arena', 'battle_arena.jpg', 'background', 'Battle arena throne hall'),
  home: register('backgrounds', 'home', 'home.png', 'background', 'Home'),
  menu: register('backgrounds', 'menu', 'menu.png', 'background', 'Menu'),
} satisfies Record<string, AssetId>;

/* --------------------------------------------------------------------- ui */

export const uiIds = {
  panel: register('ui', 'panel', 'panel.svg', 'ui', 'Panel'),
  divider: register('ui', 'divider', 'divider.svg', 'ui', 'Divider'),
  buttonGlow: register('ui', 'button_glow', 'button_glow.svg', 'ui', 'Button'),
} satisfies Record<string, AssetId>;

/* ------------------------------------------------------------------ icons */

const icon = (name: string, ext = 'svg') => register('icons', name, `${name}.${ext}`, 'icon', name);

export const iconIds = {
  home: icon('home', 'png'),
  quest: icon('quest', 'png'),
  inventory: icon('inventory', 'png'),
  hero: icon('hero', 'png'),
  settings: icon('settings', 'png'),
  trophy: icon('trophy'),
  swords: icon('swords'),
  heart: icon('heart'),
  shield: icon('shield'),
  target: icon('target'),
  lock: icon('lock'),
  clock: icon('clock'),
  coin: icon('coin'),
  star: icon('star'),
  back: icon('back'),
  bolt: icon('bolt'),
  robot: icon('robot'),
  user: icon('user'),
  gold: icon('gold', 'png'),
  bwar: icon('bwar', 'png'),
  logo: icon('logo', 'png'),
  partHead: icon('part_head'),
  partBody: icon('part_body'),
  partArm: icon('part_arm'),
  partLeg: icon('part_leg'),
} satisfies Record<string, AssetId>;

/* ---------------------------------------------------------------- effects */

export const effectIds = {
  hitSpark: register('effects', 'hit_spark', 'hit_spark.svg', 'effect', 'Hit spark'),
  blockShield: register('effects', 'block_shield', 'block_shield.svg', 'effect', 'Block shield'),
  damageNumber: register('effects', 'damage_number', 'damage_number.svg', 'effect', 'Damage number'),
} satisfies Record<string, AssetId>;

/* ----------------------------------------------------------------- sounds */

const sound = (name: string) => register('sounds', name, `${name}.wav`, 'audio', name);

export const soundIds = {
  uiSelect: sound('ui_select'),
  uiConfirm: sound('ui_confirm'),
  countdownTick: sound('countdown_tick'),
  attackWhoosh: sound('attack_whoosh'),
  hit: sound('hit'),
  block: sound('block'),
  victory: sound('victory'),
  defeat: sound('defeat'),
} satisfies Record<string, AssetId>;

export const musicIds = {
  battleTheme: register('music', 'battle_theme', 'battle_theme.wav', 'audio', 'Battle theme'),
} satisfies Record<string, AssetId>;

export const ASSET_ENTRIES: readonly AssetEntry[] = entries;
