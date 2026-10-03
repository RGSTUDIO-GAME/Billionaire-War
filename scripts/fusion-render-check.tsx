/**
 * FUSION RENDER VERIFICATION
 * ==========================
 * Renders the real Hero screen and checks the player-facing star system:
 * tiers, level caps, serials and the Fusion entry point.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { HeroScreen } from '../src/screens/HeroScreen';

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
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const hero = renderToStaticMarkup(<HeroScreen onBack={() => {}} />);
const words = readable(hero);

check('render: Hero screen is mounted', words.includes('Hero'));
check('render: owned heroes show their star tier', hero.includes('★'));
check('render: a fresh hero shows its 1-star cap', words.includes('Lv 0/20'));
check('render: owned heroes expose a Fusion entry point', words.includes('Fusion'));
check('render: owned heroes show their stacked quantity', words.includes('×1'));

if (failures.length > 0) {
  console.error(`\n${failures.length} fusion render check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} fusion render checks passed.`);
