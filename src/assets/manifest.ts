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
): AssetId => {
  sequence += 1;
  const id = `${category}.${key}#${sequence}`;
  entries.push({ id, category, file, placeholder, label, fallback });
  return id;
};

const registerHero = (heroId: string, key: string, file: string, fallback?: AssetId): AssetId => {
  sequence += 1;
  const id = `heroes.${heroId}.${key}#${sequence}`;
  entries.push({
    id,
    category: 'heroes',
    file: `${heroId}/${file}`,
    placeholder: key === 'character' ? 'hero' : 'heroPose',
    label: `${heroId} ${key}`,
    fallback,
  });
  return id;
};

/* ---------------------------------------------------------------- fallback */

// Empty `file` = inline artwork only. These are the tail of every hero chain.
const PLACEHOLDER_HERO = register('heroes', '__placeholder_character', '', 'hero', 'Hero');
const PLACEHOLDER_POSE = register('heroes', '__placeholder_pose', '', 'heroPose', 'Pose');

/* ------------------------------------------------------------------ heroes */

const heroFiles: Record<HeroAssetKey, string> = {
  character: 'character.svg',
  idle: 'idle.svg',
  attackHead: 'attack_head.svg',
  attackBody: 'attack_body.svg',
  attackArm: 'attack_arm.svg',
  attackLeg: 'attack_leg.svg',
  defense: 'defense.svg',
  hit: 'hit.svg',
  victory: 'victory.svg',
  defeat: 'defeat.svg',
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

/* ------------------------------------------------------------ backgrounds */

export const backgroundIds = {
  battleArena: register('backgrounds', 'battle_arena', 'battle_arena.svg', 'background', 'Battle arena'),
  home: register('backgrounds', 'home', 'home.svg', 'background', 'Home'),
  menu: register('backgrounds', 'menu', 'menu.svg', 'background', 'Menu'),
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
  gold: icon('gold'),
  bwar: icon('bwar'),
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
