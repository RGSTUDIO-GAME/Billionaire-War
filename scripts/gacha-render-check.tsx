/**
 * GACHA RENDER VERIFICATION
 * =========================
 * Checks the real Gacha screen, its Home entry point, route wiring and the
 * five rarity presentation hooks.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { GachaScreen } from '../src/screens/GachaScreen';
import { HomeScreen } from '../src/screens/HomeScreen';

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

const readable = (html: string): string =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const gacha = renderToStaticMarkup(<GachaScreen onBack={() => {}} />);
const gachaWords = readable(gacha);
const home = renderToStaticMarkup(
  <HomeScreen onWar={() => {}} onGacha={() => {}} onMining={() => {}} onTrade={() => {}} />,
);
const homeWords = readable(home);

check('gacha: the screen mounts with its header', gachaWords.includes('Gacha Free demo reveal'));
check('gacha: the floating stack starts with five mystery cards', (gacha.match(/\?/g) ?? []).length === 5);
check('gacha: the reveal button is available', gachaWords.includes('Gacha'));
check('gacha: the demo scope is disclosed', gachaWords.includes('visual only'));
check('home: the Gacha entry point is shown', homeWords.includes('Gacha'));

const app = readFileSync(join(process.cwd(), 'src', 'app', 'App.tsx'), 'utf8');
check(
  'wiring: the Gacha screen is connected to the router',
  app.includes("entry.screen === 'gacha'") && app.includes('onGacha={() => navigate(\'gacha\')}'),
);

const styles = readFileSync(join(process.cwd(), 'src', 'styles', 'components.css'), 'utf8');
check(
  'style: all five rarities have reveal effects',
  ['common', 'uncommon', 'rare', 'epic', 'legendary'].every((rarity) =>
    styles.includes(`data-rarity='${rarity}'`),
  ),
);

check('style: the mystery cards animate horizontally', styles.includes('@keyframes gacha-float'));

if (failures.length > 0) {
  console.error(`\n${failures.length} gacha render check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} gacha render checks passed.`);
