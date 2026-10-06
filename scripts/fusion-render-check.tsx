/**
 * FUSION RENDER VERIFICATION
 * ==========================
 * Renders the real Hero screen and checks the player-facing star system:
 * tiers, level caps, serials and the Fusion entry point.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { HEROES } from '../src/data/heroes';
import { HeroScreen } from '../src/screens/HeroScreen';
import { usePlayerStore } from '../src/state/playerStore';

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
check('render: Hero hides Instant Sell without a matching request', !hero.includes('Instant Sell'));

const previousRequests = usePlayerStore.getState().tradeRequests;
try {
  usePlayerStore.setState({
    tradeRequests: [
      {
        requestId: 'render-request',
        requesterId: 'another-player',
        kind: 'hero',
        heroId: HEROES[0].id,
        price: 17,
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  });
  const requestedHero = renderToStaticMarkup(<HeroScreen onBack={() => {}} />);
  check(
    'render: matching requests expose Instant Sell directly on Hero',
    requestedHero.includes('Instant Sell · 17 $BWAR'),
    `rendered=${readable(requestedHero).includes('Instant Sell')}; request=${readable(requestedHero).includes('17 $BWAR')}`,
  );
} finally {
  usePlayerStore.setState({ tradeRequests: previousRequests });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} fusion render check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} fusion render checks passed.`);
