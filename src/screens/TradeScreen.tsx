import { useState } from 'react';
import type { ReactNode } from 'react';
import { AssetImg } from '../assets/AssetImg';
import { iconIds } from '../assets/manifest';
import { HeroAvatar } from '../components/hero/HeroAvatar';
import { RarityBadge } from '../components/hero/RarityBadge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CurrencyPill } from '../components/ui/CurrencyPill';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { heroLevelOf } from '../data/economy';
import { HEROES } from '../data/heroes';
import { formatTradeAmount, heroTradePrice, isValidTradePrice } from '../data/trade';
import type { TradeCurrency, TradeOffer } from '../data/trade';
import { usePlayerStore } from '../state/playerStore';

type TradeScreenProps = { onBack: () => void };
type TradeView = 'offer' | 'deliver';
type OfferKind = 'hero' | 'gold';

const parseAmount = (value: string): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const statusTone = {
  active: 'gold',
  delivered: 'success',
  delisted: 'muted',
} as const;

const OfferCard = ({ offer, actions }: { offer: TradeOffer; actions: ReactNode }) => (
  <Card className="trade-row">
    {offer.kind === 'hero' ? (
      (() => {
        const hero = HEROES.find((candidate) => candidate.id === offer.heroId);
        return hero ? <HeroAvatar hero={hero} size="sm" /> : null;
      })()
    ) : (
      <AssetImg assetId={iconIds.gold} alt="" className="trade-offer-icon" />
    )}
    <div className="trade-row__main">
      <div className="trade-row__title">
        {offer.kind === 'hero'
          ? HEROES.find((hero) => hero.id === offer.heroId)?.name ?? 'Unknown hero'
          : `${offer.goldAmount.toLocaleString('en-US')} Gold`}
      </div>
      <div className="trade-row__meta">
        <Badge tone={statusTone[offer.status]}>{offer.status}</Badge>
        {offer.kind === 'hero' ? (
          <>
            <RarityBadge rarity={HEROES.find((hero) => hero.id === offer.heroId)?.rarity ?? 'common'} height={16} />
            <span>Lv {offer.heroLevel}</span>
          </>
        ) : (
          <span>Gold offer</span>
        )}
      </div>
      <div className="trade-row__price">{formatTradeAmount(offer.price, offer.currency)}</div>
    </div>
    <div className="trade-offer-actions">{actions}</div>
  </Card>
);

export const TradeScreen = ({ onBack }: TradeScreenProps) => {
  const gold = usePlayerStore((state) => state.gold);
  const bwar = usePlayerStore((state) => state.bwar);
  const ownedHeroIds = usePlayerStore((state) => state.ownedHeroIds);
  const heroLevels = usePlayerStore((state) => state.heroLevels);
  const mining = usePlayerStore((state) => state.mining);
  const tradeOffers = usePlayerStore((state) => state.tradeOffers);
  const createHeroOffer = usePlayerStore((state) => state.createHeroOffer);
  const createGoldOffer = usePlayerStore((state) => state.createGoldOffer);
  const delistOffer = usePlayerStore((state) => state.delistOffer);
  const deliverOffer = usePlayerStore((state) => state.deliverOffer);

  const [view, setView] = useState<TradeView>('offer');
  const [kind, setKind] = useState<OfferKind>('hero');
  const [offerCurrency, setOfferCurrency] = useState<TradeCurrency>('gold');
  const [heroPriceDrafts, setHeroPriceDrafts] = useState<Record<string, string>>({});
  const [goldAmount, setGoldAmount] = useState('100');
  const [goldPrice, setGoldPrice] = useState('1');
  const [notice, setNotice] = useState<string | null>(null);

  const activeOffers = tradeOffers.filter((offer) => offer.status === 'active');
  const deliveredOffers = tradeOffers.filter((offer) => offer.status === 'delivered');
  const activeGoldOffer = activeOffers.some((offer) => offer.kind === 'gold');
  const offerAmount = parseAmount(goldAmount);
  const offerPrice = parseAmount(goldPrice);

  const report = (success: boolean, successMessage: string) => {
    setNotice(success ? successMessage : 'Offer refused. Check the price, balance, roster and mining status.');
  };

  const pickView = (value: TradeView) => {
    setView(value);
    setNotice(null);
  };

  const pickKind = (value: OfferKind) => {
    setKind(value);
    setNotice(null);
  };

  const pickCurrency = (value: TradeCurrency) => {
    setOfferCurrency(value);
    setHeroPriceDrafts({});
  };

  const updateHeroPrice = (heroId: string, value: string) => {
    setHeroPriceDrafts((current) => ({ ...current, [heroId]: value }));
  };

  const availableHeroes = HEROES.filter(
    (hero) =>
      ownedHeroIds.includes(hero.id) &&
      !activeOffers.some((offer) => offer.kind === 'hero' && offer.heroId === hero.id),
  );

  const offerHero = (heroId: string, price: number) => {
    report(
      createHeroOffer(heroId, price, offerCurrency),
      `Offer created for ${HEROES.find((hero) => hero.id === heroId)?.name ?? 'hero'}.`,
    );
  };

  const offerGold = () => {
    const created = createGoldOffer(offerAmount, offerPrice);
    report(
      created,
      `${offerAmount.toLocaleString('en-US')} Gold offered for ${formatTradeAmount(offerPrice, 'bwar')}.`,
    );
    if (created) {
      setGoldAmount('100');
      setGoldPrice('1');
    }
  };

  const delist = (offer: TradeOffer) => {
    report(
      delistOffer(offer.offerId),
      offer.status === 'active'
        ? 'Offer delisted and the asset returned.'
        : offer.kind === 'hero'
          ? 'Delivered offer delisted and the hero returned.'
          : 'Delivered offer removed from history.',
    );
  };

  const deliver = (offer: TradeOffer) => {
    report(
      deliverOffer(offer.offerId),
      `Offer delivered for ${formatTradeAmount(offer.price, offer.currency)}.`,
    );
  };

  return (
    <div className="trade-screen anim-fade">
      <ScreenHeader title="Trade" subtitle="Custom-price local marketplace" onBack={onBack} />

      <Card flat tight className="trade-wallet">
        <CurrencyPill kind="gold" value={gold} />
        <CurrencyPill kind="bwar" value={bwar} />
      </Card>

      <div className="trade-tabs" role="tablist" aria-label="Trade workflow">
        {(['offer', 'deliver'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`tabs__btn${view === value ? ' is-active' : ''}`}
            role="tab"
            aria-selected={view === value}
            onClick={() => pickView(value)}
          >
            {value === 'offer' ? 'Offer' : 'Deliver'}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="trade-notice" role="status">
          {notice}
        </div>
      ) : null}

      {view === 'offer' ? (
        <div className="stack">
          <div className="trade-tabs" role="tablist" aria-label="Offer asset">
            {(['hero', 'gold'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`tabs__btn${kind === value ? ' is-active' : ''}`}
                role="tab"
                aria-selected={kind === value}
                onClick={() => pickKind(value)}
              >
                {value === 'hero' ? 'Hero' : 'Gold'}
              </button>
            ))}
          </div>

          {kind === 'hero' ? (
            <>
              <div className="trade-currency">
                <span className="muted">Price currency</span>
                <div className="trade-currency__options" role="radiogroup">
                  {(['gold', 'bwar'] as const).map((currency) => (
                    <button
                      key={currency}
                      type="button"
                      className={`trade-currency__btn${offerCurrency === currency ? ' is-active' : ''}`}
                      role="radio"
                      aria-checked={offerCurrency === currency}
                      onClick={() => pickCurrency(currency)}
                    >
                      <AssetImg assetId={currency === 'gold' ? iconIds.gold : iconIds.bwar} alt="" />
                      {currency === 'gold' ? '$GOLD' : '$BWAR'}
                    </button>
                  ))}
                </div>
              </div>

              {availableHeroes.length > 0 ? (
                availableHeroes.map((hero) => {
                  const level = heroLevelOf(heroLevels, hero.id);
                  const suggested = heroTradePrice(hero, level, offerCurrency, 'sell');
                  const price = parseAmount(heroPriceDrafts[hero.id] ?? String(suggested));
                  const miningLocked = mining?.heroId === hero.id;
                  const lastHero = ownedHeroIds.length <= 1;
                  return (
                    <Card className="trade-row" key={hero.id}>
                      <HeroAvatar hero={hero} size="sm" />
                      <div className="trade-row__main">
                        <div className="trade-row__title">{hero.name}</div>
                        <div className="trade-row__meta">
                          <RarityBadge rarity={hero.rarity} height={16} />
                          <span>Lv {level}</span>
                          {miningLocked ? <Badge tone="danger">Mining</Badge> : null}
                        </div>
                        <label className="trade-price-field">
                          <span>Custom price</span>
                          <input
                            className="trade-amount__input trade-price-input"
                            type="number"
                            min="0.01"
                            step={offerCurrency === 'gold' ? '1' : '0.01'}
                            value={heroPriceDrafts[hero.id] ?? String(suggested)}
                            onChange={(event) => updateHeroPrice(hero.id, event.target.value)}
                            aria-label={`Custom price for ${hero.name}`}
                          />
                        </label>
                      </div>
                      <Button
                        size="sm"
                        variant="gold"
                        disabled={
                          miningLocked ||
                          lastHero ||
                          !isValidTradePrice(price, offerCurrency)
                        }
                        onClick={() => offerHero(hero.id, price)}
                      >
                        {miningLocked ? 'Unstack first' : lastHero ? 'Last hero' : 'Offer'}
                      </Button>
                    </Card>
                  );
                })
              ) : (
                <div className="empty-state">No unlisted heroes available.</div>
              )}
            </>
          ) : (
            <Card className="trade-item">
              <AssetImg assetId={iconIds.gold} alt="" className="trade-item__icon" />
              <div className="trade-row__main">
                <div className="trade-row__title">Gold offer</div>
                <div className="trade-row__meta">
                  <Badge tone="gold">Custom BWAR price</Badge>
                  <span>Escrowed until delivery</span>
                </div>
                <div className="trade-form-grid">
                  <label className="trade-price-field">
                    <span>Gold amount</span>
                    <input
                      className="trade-amount__input"
                      type="number"
                      min="1"
                      max={gold || undefined}
                      step="1"
                      value={goldAmount}
                      onChange={(event) => setGoldAmount(event.target.value)}
                      aria-label="Gold amount to offer"
                    />
                  </label>
                  <label className="trade-price-field">
                    <span>Price in BWAR</span>
                    <input
                      className="trade-amount__input"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={goldPrice}
                      onChange={(event) => setGoldPrice(event.target.value)}
                      aria-label="Custom BWAR price for Gold"
                    />
                  </label>
                </div>
              </div>
              <Button
                size="sm"
                variant="gold"
                disabled={
                  activeGoldOffer ||
                  !Number.isInteger(offerAmount) ||
                  offerAmount <= 0 ||
                  offerAmount > gold ||
                  !isValidTradePrice(offerPrice, 'bwar')
                }
                onClick={offerGold}
              >
                {activeGoldOffer ? 'Already offered' : 'Offer'}
              </Button>
            </Card>
          )}

          <div className="trade-section-title">Active offers</div>
          {activeOffers.length > 0 ? (
            activeOffers.map((offer) => (
              <OfferCard
                key={offer.offerId}
                offer={offer}
                actions={
                  <Button size="sm" variant="ghost" onClick={() => delist(offer)}>
                    Delist
                  </Button>
                }
              />
            ))
          ) : (
            <div className="empty-state">No active offers.</div>
          )}
        </div>
      ) : (
        <div className="stack">
          <div className="trade-section-title">Ready to deliver</div>
          {activeOffers.length > 0 ? (
            activeOffers.map((offer) => (
              <OfferCard
                key={offer.offerId}
                offer={offer}
                actions={
                  <>
                    <Button size="sm" variant="gold" onClick={() => deliver(offer)}>
                      Deliver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => delist(offer)}>
                      Delist
                    </Button>
                  </>
                }
              />
            ))
          ) : (
            <div className="empty-state">No offers ready for delivery.</div>
          )}

          <div className="trade-section-title">Delivered</div>
          {deliveredOffers.length > 0 ? (
            deliveredOffers.map((offer) => (
              <OfferCard
                key={offer.offerId}
                offer={offer}
                actions={
                  <Button size="sm" variant="ghost" onClick={() => delist(offer)}>
                    Delist
                  </Button>
                }
              />
            ))
          ) : (
            <div className="empty-state">No delivered offers yet.</div>
          )}
        </div>
      )}

      <Card flat tight className="trade-rules">
        Offer moves the asset into escrow at your chosen price. Deliver completes the sale and
        credits the proceeds; Delist returns the hero or active Gold escrow. Delivered entries
        can also be delisted. Mining heroes stay locked until unstacked.
      </Card>
    </div>
  );
};
