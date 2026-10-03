/**
 * TRADE RENDER VERIFICATION
 * =========================
 * Renders the real entry points and checks the player-facing marketplace UI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeScreen } from '../src/screens/HomeScreen';
import { InventoryScreen } from '../src/screens/InventoryScreen';
import { TradeScreen } from '../src/screens/TradeScreen';

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

const home = renderToStaticMarkup(
  <HomeScreen onWar={() => {}} onMining={() => {}} onTrade={() => {}} />,
);
const inventory = renderToStaticMarkup(
  <InventoryScreen onBack={() => {}} onBwarPress={() => {}} onTrade={() => {}} />,
);
const trade = renderToStaticMarkup(<TradeScreen onBack={() => {}} />);
const tradeWords = readable(trade);

check('render: Home offers Trade', readable(home).includes('Trade'));
check('render: Home no longer says Trade is not built', !home.includes('not built yet'));
check('render: Inventory links to Trade', readable(inventory).includes('Character trading Open'));
check('render: Trade screen is mounted', trade.includes('trade-screen'));
check(
  'render: Trade has Offer, Deliver and Request tabs',
  (trade.match(/role="tablist"/g) ?? []).length === 2 &&
    tradeWords.includes('Offer Deliver Request'),
);
check(
  'render: Trade starts on custom-price Offer',
  trade.includes('aria-selected="true"') &&
    readFileSync(join(process.cwd(), 'src', 'screens', 'TradeScreen.tsx'), 'utf8').includes('Custom price'),
);
check('render: Trade explains the instance mining lock', tradeWords.includes('Mining locks only the roster instance.'));
check('render: Trade exposes no direct Buy button', !trade.includes('>Buy<'));

const tradeSource = readFileSync(join(process.cwd(), 'src', 'screens', 'TradeScreen.tsx'), 'utf8');
check(
  'render: Trade groups equal Hero levels into one stack',
  tradeSource.includes('groupHeroInstances') &&
    tradeSource.includes('×{group.instances.length}'),
);
check(
  'render: Trade exposes level-specific offers',
  tradeSource.includes('Choose level') &&
    tradeSource.includes('createHeroOffer(heroId, price, offerCurrency, instanceSerial)'),
);
check(
  'render: Trade exposes Hero and Gold buy requests',
  tradeSource.includes('Place a buy request') &&
    tradeSource.includes('createHeroRequest') &&
    tradeSource.includes('createGoldRequest'),
);
check(
  'render: Trade fills the highest request through Instant Sell',
  tradeSource.includes('Instant Sell') &&
    tradeSource.includes('Requests · highest first'),
);

if (failures.length > 0) {
  console.error(`\n${failures.length} trade render check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} trade render checks passed.`);
