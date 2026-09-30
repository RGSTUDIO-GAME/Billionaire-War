import { useState } from 'react';
import { HeroAvatar } from '../components/hero/HeroAvatar';
import { RarityBadge } from '../components/hero/RarityBadge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CurrencyPill } from '../components/ui/CurrencyPill';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { iconIds } from '../assets/manifest';
import { AssetImg } from '../assets/AssetImg';
import { heroLevelOf } from '../data/economy';
import { HEROES } from '../data/heroes';
import { formatTradeAmount, goldItemPrice, heroTradePrice } from '../data/trade';
import type { TradeCurrency } from '../data/trade';
import { usePlayerStore } from '../state/playerStore';

type TradeScreenProps = { onBack: () => void };
type TradeCategory = 'hero' | 'item';
type TradeAction = 'buy' | 'sell';

const parseAmount = (value: string): number => {
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : 0;
};

const categoryTabs: Array<{ value: TradeCategory; label: string }> = [
  { value: 'hero', label: 'Hero' },
  { value: 'item', label: 'Item' },
];

const actionTabs: Array<{ value: TradeAction; label: string }> = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
];

export const TradeScreen = ({ onBack }: TradeScreenProps) => {
  const gold = usePlayerStore((state) => state.gold);
  const bwar = usePlayerStore((state) => state.bwar);
  const ownedHeroIds = usePlayerStore((state) => state.ownedHeroIds);
  const equippedHeroId = usePlayerStore((state) => state.equippedHeroId);
  const heroLevels = usePlayerStore((state) => state.heroLevels);
  const mining = usePlayerStore((state) => state.mining);
  const buyHero = usePlayerStore((state) => state.buyHero);
  const sellHero = usePlayerStore((state) => state.sellHero);
  const buyGold = usePlayerStore((state) => state.buyGold);
  const sellGold = usePlayerStore((state) => state.sellGold);

  const [category, setCategory] = useState<TradeCategory>('hero');
  const [action, setAction] = useState<TradeAction>('buy');
  const [buyCurrency, setBuyCurrency] = useState<TradeCurrency>('gold');
  const [sellCurrency, setSellCurrency] = useState<TradeCurrency>('bwar');
  const [goldToBuy, setGoldToBuy] = useState('100');
  const [goldToSell, setGoldToSell] = useState('100');
  const [notice, setNotice] = useState<string | null>(null);

  const buyAmount = parseAmount(goldToBuy);
  const sellAmount = parseAmount(goldToSell);
  const buyCost = goldItemPrice(buyAmount);
  const sellProceeds = goldItemPrice(sellAmount);
  const maximumGoldBuy = Math.max(0, Math.floor(bwar * 100));

  const report = (success: boolean, successMessage: string) => {
    setNotice(
      success
        ? successMessage
        : 'Trade refused. Check your balance, ownership and mining status.',
    );
  };

  const pickCategory = (value: TradeCategory) => {
    setCategory(value);
    setNotice(null);
  };

  const pickAction = (value: TradeAction) => {
    setAction(value);
    setNotice(null);
  };

  const heroBuyRows = HEROES.filter((hero) => !ownedHeroIds.includes(hero.id)).map((hero) => {
    const price = heroTradePrice(hero, 0, buyCurrency, 'buy');
    const affordable = buyCurrency === 'gold' ? price <= gold : price <= bwar + 1e-9;
    return (
      <Card className="trade-row" key={hero.id}>
        <HeroAvatar hero={hero} size="sm" />
        <div className="trade-row__main">
          <div className="trade-row__title">{hero.name}</div>
          <div className="trade-row__meta">
            <RarityBadge rarity={hero.rarity} height={16} />
            <span>Lv 0</span>
          </div>
          <div className="trade-row__price">{formatTradeAmount(price, buyCurrency)}</div>
        </div>
        <Button
          size="sm"
          variant="gold"
          disabled={!affordable}
          onClick={() => report(buyHero(hero.id, buyCurrency), `Bought ${hero.name}.`)}
        >
          Buy
        </Button>
      </Card>
    );
  });

  const heroSellRows = HEROES.filter((hero) => ownedHeroIds.includes(hero.id)).map((hero) => {
    const level = heroLevelOf(heroLevels, hero.id);
    const price = heroTradePrice(hero, level, sellCurrency, 'sell');
    const miningLocked = mining?.heroId === hero.id;
    const lastHero = ownedHeroIds.length <= 1;
    const equipped = equippedHeroId === hero.id;
    const locked = miningLocked || lastHero;
    return (
      <Card className="trade-row" key={hero.id}>
        <HeroAvatar hero={hero} size="sm" />
        <div className="trade-row__main">
          <div className="trade-row__title">
            {hero.name}
            {equipped ? <span className="trade-row__flag"> · equipped</span> : null}
          </div>
          <div className="trade-row__meta">
            <RarityBadge rarity={hero.rarity} height={16} />
            <span>Lv {level}</span>
            {miningLocked ? <Badge tone="danger">Mining</Badge> : null}
          </div>
          <div className="trade-row__price">{formatTradeAmount(price, sellCurrency)}</div>
        </div>
        <Button
          size="sm"
          variant="gold"
          disabled={locked}
          onClick={() => report(sellHero(hero.id, sellCurrency), `Sold ${hero.name}.`)}
        >
          {miningLocked ? 'Unstack first' : lastHero ? 'Last hero' : 'Sell'}
        </Button>
      </Card>
    );
  });

  return (
    <div className="trade-screen anim-fade">
      <ScreenHeader title="Trade" subtitle="Local hero and Gold marketplace" onBack={onBack} />

      <Card flat tight className="trade-wallet">
        <CurrencyPill kind="gold" value={gold} />
        <CurrencyPill kind="bwar" value={bwar} />
      </Card>

      <div className="trade-tabs" role="tablist" aria-label="Trade category">
        {categoryTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`tabs__btn${category === tab.value ? ' is-active' : ''}`}
            role="tab"
            aria-selected={category === tab.value}
            onClick={() => pickCategory(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="trade-tabs" role="tablist" aria-label="Trade action">
        {actionTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`tabs__btn${action === tab.value ? ' is-active' : ''}`}
            role="tab"
            aria-selected={action === tab.value}
            onClick={() => pickAction(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="trade-notice" role="status">
          {notice}
        </div>
      ) : null}

      <div className="stack">
        {category === 'hero' ? (
          <>
            <div className="trade-currency" aria-label="Hero trade currency">
              <span className="muted">{action === 'buy' ? 'Pay with' : 'Receive in'}</span>
              <div className="trade-currency__options" role="radiogroup">
                {(['gold', 'bwar'] as const).map((currency) => {
                  const value = action === 'buy' ? buyCurrency : sellCurrency;
                  const setCurrency = action === 'buy' ? setBuyCurrency : setSellCurrency;
                  return (
                    <button
                      key={currency}
                      type="button"
                      className={`trade-currency__btn${value === currency ? ' is-active' : ''}`}
                      role="radio"
                      aria-checked={value === currency}
                      onClick={() => setCurrency(currency)}
                    >
                      <AssetImg assetId={currency === 'gold' ? iconIds.gold : iconIds.bwar} alt="" />
                      {currency === 'gold' ? '$GOLD' : '$BWAR'}
                    </button>
                  );
                })}
              </div>
            </div>

            {action === 'buy' ? (
              heroBuyRows.length > 0 ? (
                heroBuyRows
              ) : (
                <div className="empty-state">Every hero is already owned.</div>
              )
            ) : (
              heroSellRows
            )}
          </>
        ) : action === 'buy' ? (
          <Card className="trade-item">
            <AssetImg assetId={iconIds.gold} alt="" className="trade-item__icon" />
            <div className="trade-row__main">
              <div className="trade-row__title">Gold</div>
              <div className="trade-row__meta">
                <Badge tone="gold">Buy for BWAR</Badge>
                <span>100 Gold = 1 BWAR</span>
              </div>
              <div className="trade-row__price">Cost {formatTradeAmount(buyCost, 'bwar')}</div>
              <div className="trade-amount">
                <input
                  className="trade-amount__input"
                  type="number"
                  min="1"
                  max={maximumGoldBuy || undefined}
                  step="100"
                  value={goldToBuy}
                  onChange={(event) => setGoldToBuy(event.target.value)}
                  aria-label="Gold amount to buy"
                />
                {[100, 500, 1000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="trade-quick"
                    disabled={amount > maximumGoldBuy}
                    onClick={() => setGoldToBuy(String(amount))}
                  >
                    {amount}
                  </button>
                ))}
                {maximumGoldBuy >= 1 ? (
                  <button
                    type="button"
                    className="trade-quick"
                    onClick={() => setGoldToBuy(String(maximumGoldBuy))}
                  >
                    Max
                  </button>
                ) : null}
              </div>
            </div>
            <Button
              size="sm"
              variant="gold"
              disabled={buyAmount <= 0 || buyCost > bwar + 1e-9}
              onClick={() =>
                report(buyGold(buyAmount), `Bought ${buyAmount.toLocaleString('en-US')} Gold.`)
              }
            >
              Buy
            </Button>
          </Card>
        ) : (
          <Card className="trade-item">
            <AssetImg assetId={iconIds.gold} alt="" className="trade-item__icon" />
            <div className="trade-row__main">
              <div className="trade-row__title">Gold</div>
              <div className="trade-row__meta">
                <Badge tone="gold">Sell for BWAR</Badge>
                <span>100 Gold = 1 BWAR</span>
              </div>
              <div className="trade-row__price">
                Receive {formatTradeAmount(sellProceeds, 'bwar')}
              </div>
              <div className="trade-amount">
                <input
                  className="trade-amount__input"
                  type="number"
                  min="1"
                  max={gold || undefined}
                  step="100"
                  value={goldToSell}
                  onChange={(event) => setGoldToSell(event.target.value)}
                  aria-label="Gold amount to sell"
                />
                {[100, 500].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="trade-quick"
                    disabled={amount > gold}
                    onClick={() => setGoldToSell(String(amount))}
                  >
                    {amount}
                  </button>
                ))}
                {gold >= 1 ? (
                  <button
                    type="button"
                    className="trade-quick"
                    onClick={() => setGoldToSell(String(gold))}
                  >
                    Max
                  </button>
                ) : null}
              </div>
            </div>
            <Button
              size="sm"
              variant="gold"
              disabled={sellAmount <= 0 || sellAmount > gold}
              onClick={() =>
                report(
                  sellGold(sellAmount),
                  `Sold ${sellAmount.toLocaleString('en-US')} Gold for BWAR.`,
                )
              }
            >
              Sell
            </Button>
          </Card>
        )}

        <Card flat tight className="trade-rules">
          Hero prices scale with level, and selling returns 60% of buy value. Gold trades use
          BWAR at 100 Gold = 1 BWAR. Unstack a mining hero before selling it.
        </Card>
      </div>
    </div>
  );
};
