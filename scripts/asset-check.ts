/**
 * ANIMATION CONTROLLER VERIFICATION
 * =================================
 * Proves the separation the specification demands: the engine emits events,
 * the controller decides what they look like, and nothing in that mapping
 * knows which hero it is drawing. Also proves the fallback chain never breaks.
 *
 * Run with: npm run verify
 */
import { DUROV } from '../src/data/heroes/durov';
import { AURELION } from '../src/data/heroes/aurelion';
import { getHeroById, HEROES } from '../src/data/heroes';
import { ANIMATION_EVENTS, eventToAsset, eventToEffect, eventToLabel, eventToVisual, resolveCue } from '../src/assets/animationController';
import { heroFrames, heroPortraitIds } from '../src/assets/manifest';
import { getAssetUrl, getFallbackChain, isRegistered } from '../src/assets/resolve';
import { hasAttackFx, heroExplosionUrls, heroProjectileUrls } from '../src/assets/heroAssets';
import { ALL_EVENT_TYPES } from '../src/engine/events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Project root: this file is bundled to a temp dir, so use the cwd. */
const ROOT = process.cwd();
const readSource = (...parts: string[]): string => readFileSync(join(ROOT, ...parts), 'utf8');

/** Comments may legitimately mention heroes; code may not. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

const event = (type: string) => ({
  type: type as never,
  round: 1 as const,
  actor: 'A' as const,
  target: 'B' as const,
  attackTarget: 'head' as const,
  defenseTarget: 'head' as const,
  outcome: 'HIT' as const,
  damage: 200,
});

/* ------------------------------------------- every event resolves to an asset */

for (const type of ALL_EVENT_TYPES) {
  const asset = eventToAsset(DUROV, event(type));
  check(`event ${type} resolves to a registered asset`, isRegistered(asset), asset);
  check(`event ${type} has a url or falls back to inline art`, typeof getAssetUrl(asset) === 'string');
  const chain = getFallbackChain(asset);
  check(`event ${type} has a non-empty fallback chain`, chain.length > 0);
  check(`event ${type} chain ends in something renderable`, typeof chain[chain.length - 1] === 'string' && chain[chain.length - 1].length > 0);
}

/* --------------------------------------- the documented animation contract */

for (const type of ANIMATION_EVENTS) {
  check(`contract: ${type} is a real event type`, ALL_EVENT_TYPES.includes(type));
  const cue = resolveCue(DUROV, event(type));
  check(`contract: ${type} produces a complete cue`, typeof cue.asset === 'string' && typeof cue.motion === 'string' && typeof cue.visual.type === 'string');
  check(`contract: ${type} renders through hero data only`, cue.asset === DUROV.assets.idle || Object.values(DUROV.assets).includes(cue.asset));
}

/* ------------------------------------------------- the documented mappings */

const attackTargets = [
  ['ATTACK_HEAD', 'attackHead'],
  ['ATTACK_BODY', 'attackBody'],
  ['ATTACK_ARM', 'attackArm'],
  ['ATTACK_LEG', 'attackLeg'],
] as const;

for (const [type, key] of attackTargets) {
  check(`${type} maps to hero.assets.${key}`, eventToAsset(DUROV, event(type)) === DUROV.assets[key]);
  check(`${type} resolves an attack visual`, eventToVisual(event(type)).type === 'attack');
}

const blockTargets = [
  ['BLOCK_HEAD', 'head'],
  ['BLOCK_BODY', 'body'],
  ['BLOCK_ARM', 'arm'],
  ['BLOCK_LEG', 'leg'],
] as const;

for (const [type, part] of blockTargets) {
  check(`${type} maps to the defense asset`, eventToAsset(DUROV, event(type)) === DUROV.assets.defense);
  check(`${type} resolves a defense visual`, eventToVisual(event(type)).type === 'defense');
  const cue = resolveCue(DUROV, event(type));
  check(`${type} has block motion`, cue.motion === 'block');
  check(`${type} carries a block effect`, cue.effect !== null);
  check(`${type} labels itself BLOCK 0`, cue.label === 'BLOCK 0', String(cue.label));
  void part;
}

check('HIT maps to the hit asset', eventToAsset(DUROV, event('HIT')) === DUROV.assets.hit);
check('HIT resolves a hit visual', eventToVisual(event('HIT')).type === 'hit');
check('HIT labels the damage', eventToLabel(event('HIT')) === 'HIT -200', String(eventToLabel(event('HIT'))));
check('HIT carries a hit effect', eventToEffect(event('HIT')) !== null);

check('DEFEAT maps to the defeat asset', eventToAsset(DUROV, event('DEFEAT')) === DUROV.assets.defeat);
check('VICTORY maps to the victory asset', eventToAsset(DUROV, event('VICTORY')) === DUROV.assets.victory);
check('NO_ACTION falls back to idle', eventToAsset(DUROV, event('NO_ACTION')) === DUROV.assets.idle);
check('a round-level event falls back to idle', eventToAsset(DUROV, event('ROUND_START')) === DUROV.assets.idle);
check('an unknown event never throws', (() => {
  try {
    return eventToAsset(DUROV, event('SOMETHING_NEW')) === DUROV.assets.idle;
  } catch {
    return false;
  }
})());

/* ------------------------------------------- the controller is hero-agnostic */

const source = readSource('src', 'assets', 'animationController.ts');
const controllerCode = stripComments(source);
check('the controller never names DUROV in code', !/durov/i.test(controllerCode));
check('the controller never names any hero id in code', !HEROES.some((hero) => new RegExp(hero.id, 'i').test(controllerCode)));

const engineSources = ['battle.ts', 'round.ts', 'damage.ts', 'types.ts', 'events.ts']
  .map((file) => readSource('src', 'engine', file))
  .join('\n');

const engineCode = stripComments(engineSources);
check('the engine imports nothing from the asset layer', !/from '\.\.\/assets/.test(engineCode));
check('the engine never references a file extension', !/\.(png|svg|webp|jpe?g|gif|mp3|wav)/i.test(engineCode));
check('the engine never references /assets', !/\/assets\//.test(engineCode));
check('the engine never names a hero in code', !/durov/i.test(engineCode));
check('the engine uses no Math.random', !/Math\.random/.test(engineCode));
check('the engine imports nothing from the UI or state layers', !/from '\.\.\/(components|state|screens|hooks|assets)/.test(engineCode));

/* ---------------------------------------------------------- hero replacement */

check('the hero registry resolves DUROV', getHeroById('durov') === DUROV);
check('a hero data object carries all ten asset ids', Object.keys(DUROV.assets).length === 10, String(Object.keys(DUROV.assets).length));
check('the hero registry resolves AURELION', getHeroById('aurelion') === AURELION);
check('AURELION is a rare hero with its signature skill',
  AURELION.rarity === 'rare' &&
    AURELION.skills.some((skill) => skill.name === 'Magic in My Blood'),
);
check('AURELION ships every pose strip',
  heroFrames.aurelion.idle.length === 5 &&
    heroFrames.aurelion.attackHead.length === 4 &&
    heroFrames.aurelion.attackBody.length === 4 &&
    heroFrames.aurelion.attackArm.length === 4 &&
    heroFrames.aurelion.attackLeg.length === 4 &&
    heroFrames.aurelion.defense.length === 4 &&
    heroFrames.aurelion.hit.length === 4 &&
    heroFrames.aurelion.victory.length === 4 &&
    heroFrames.aurelion.defeat.length === 6,
);
check('AURELION has a registered display portrait', isRegistered(heroPortraitIds.aurelion));

const everyHeroAssetRegistered = HEROES.every((hero) =>
  Object.values(hero.assets).every((asset) => isRegistered(asset)),
);
check('every registered hero asset id exists in the manifest', everyHeroAssetRegistered);

/* ------------------------------------------------------- attack cinema (fx) */

const plane = heroProjectileUrls(DUROV);
const blast = heroExplosionUrls(DUROV);
const laser = heroProjectileUrls(AURELION);
const laserBlast = heroExplosionUrls(AURELION);
check('durov ships a 4-frame paper plane strip', plane.length === 4, String(plane.length));
check('durov ships a 3-frame explosion strip', blast.length === 3, String(blast.length));
check('aurelion ships a 4-frame yellow laser strip', laser.length === 4, String(laser.length));
check('aurelion ships a 4-frame laser explosion strip', laserBlast.length === 4, String(laserBlast.length));
check('every fx frame has a url', [...plane, ...blast].every((url) => url.length > 0));
check('every aurelion fx frame has a url', [...laser, ...laserBlast].every((url) => url.length > 0));
check('durov has attack cinema', hasAttackFx(DUROV));
check('aurelion has attack cinema', hasAttackFx(AURELION));
check(
  'a hero without cinema renders nothing',
  !hasAttackFx({ id: 'ghost' } as never),
);

/* -------------------------------------------------------------- fallbacks */

const missing = getFallbackChain('heroes.durov.attack_head#1-does-not-exist');
check('an unknown asset id still returns a chain', missing.length > 0);
check('an unknown asset id ends in inline artwork', missing[missing.length - 1].startsWith('data:image/svg+xml'), missing[missing.length - 1]?.slice(0, 24));
check('an unknown asset id never returns undefined', missing.every((url) => typeof url === 'string'));

const chain = getFallbackChain(DUROV.assets.attackHead);
check('a real asset chain starts with the real file', chain[0].includes('durov/attack_head/frame_04.png'), chain[0]);
check('a real asset chain ends in inline artwork', chain[chain.length - 1].startsWith('data:image/svg+xml'));

/* ----------------------------------------------------------------- report */

if (failures.length > 0) {
  console.error(`\n${failures.length} animation check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} animation controller checks passed.`);
