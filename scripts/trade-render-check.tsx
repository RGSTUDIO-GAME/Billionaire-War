/**
 * TRADE RENDER VERIFICATION
 * =========================
 * Renders the real entry points and checks the player-facing marketplace UI.
 */
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
check('render: Trade has category tabs', (trade.match(/role="tablist"/g) ?? []).length === 2);
check('render: Trade starts on Hero Buy', trade.includes('aria-selected="true"') && tradeWords.includes('Every hero is already owned.'));
check('render: Trade explains the mining lock', tradeWords.includes('Unstack a mining hero before selling it.'));

if (failures.length > 0) {
  console.error(`\n${failures.length} trade render check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} trade render checks passed.`);
