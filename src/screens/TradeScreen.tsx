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
import {
  formatStars,
  heroCopiesOf,
  heroInstanceLevelOf,
  heroInstanceStarsOf,
} from '../data/fusion';
import { HEROES } from '../data/heroes';
import { formatTradeAmount, heroTradePrice, isValidTradePrice } from '../data/trade';
import type { TradeCurrency, TradeOffer, TradeRequest } from '../data/trade';
import { usePlayerStore } from '../state/playerStore';
import { tradeRequestsByPrice } from '../services/tradeService';

type TradeScreenProps = { onBack: () => void };
type TradeView = 'offer' | 'deliver' | 'request';
type OfferKind = 'hero' | 'gold';
type RequestKind = 'hero' | 'gold';

type HeroInstance = {
  serial: number;
  level: number;
  stars: number;
  isMain: boolean;
};

type HeroInstanceGroup = {
  key: string;
  level: number;
  stars: number;
  instances: HeroInstance[];
};

const parseAmount = (value: string): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const statusTone = {
  active: 'gold',
  delivered: 'success',
  delisted: 'muted',
} as const;

const heroInstancesOf = (
  mainSerial: number | null,
  copies: readonly number[],
  levels: Record<string, number>,
  stars: Record<string, number>,
  fallbackLevel: number,
  fallbackStars: number,
): HeroInstance[] => [
  ...(mainSerial === null ? [] : [{
    serial: mainSerial,
    level: heroInstanceLevelOf(levels, fallbackLevel, mainSerial),
    stars: heroInstanceStarsOf(stars, fallbackStars, mainSerial),
    isMain: true,
  }]),
  ...copies.map((serial) => ({
    serial,
    level: heroInstanceLevelOf(levels, 0, serial),
    stars: heroInstanceStarsOf(stars, 1, serial),
    isMain: false,
  })),
];

const groupHeroInstances = (instances: readonly HeroInstance[]): HeroInstanceGroup[] => {
  const groups = new Map<string, HeroInstanceGroup>();
  for (const instance of instances) {
    const key = `${instance.level}:${instance.stars}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, { key, level: instance.level, stars: instance.stars, instances: [instance] });
    } else {
      group.instances.push(instance);
    }
  }
  return [...groups.values()].sort((left, right) =>
    right.level - left.level || right.stars - left.stars,
  );
};

const highestRequest = (
  requests: readonly TradeRequest[],
  kind: RequestKind,
  playerId: string,
  match: (request: TradeRequest) => boolean,
): TradeRequest | undefined =>
  tradeRequestsByPrice(
    requests.filter((request) =>
      request.status === 'active' &&
      request.kind === kind &&
      request.requesterId !== playerId &&
      match(request),
    ),
  )[0];

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
            <span>
              {offer.heroCopySerial === null || offer.heroCopySerial === undefined ? 'Main' : 'Copy'} · Lv{' '}
              {offer.heroLevel} · {formatStars(offer.heroStars)}
            </span>
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

const RequestCard = ({ request, actions }: { request: TradeRequest; actions: ReactNode }) => (
  <Card className="trade-row">
    {request.kind === 'hero' ? (
      (() => {
        const hero = HEROES.find((candidate) => candidate.id === request.heroId);
        return hero ? <HeroAvatar hero={hero} size="sm" /> : null;
      })()
    ) : (
      <AssetImg assetId={iconIds.gold} alt="" className="trade-offer-icon" />
    )}
    <div className="trade-row__main">
      <div className="trade-row__title">
        {request.kind === 'hero'
          ? `Request ${HEROES.find((hero) => hero.id === request.heroId)?.name ?? 'Hero'}`
          : `Request ${request.goldAmount.toLocaleString('en-US')} Gold`}
      </div>
      <div className="trade-row__meta">
        <Badge tone={request.status === 'active' ? 'gold' : 'muted'}>{request.status}</Badge>
        <span>Highest BWAR price wins</span>
      </div>
      <div className="trade-row__price">{formatTradeAmount(request.price, 'bwar')}</div>
    </div>
    <div className="trade-offer-actions">{actions}</div>
  </Card>
);

export const TradeScreen = ({ onBack }: TradeScreenProps) => {
  const gold = usePlayerStore((state) => state.gold);
  const bwar = usePlayerStore((state) => state.bwar);
  const ownedHeroIds = usePlayerStore((state) => state.ownedHeroIds);
  const heroLevels = usePlayerStore((state) => state.heroLevels);
  const heroStars = usePlayerStore((state) => state.heroStars);
  const heroCopies = usePlayerStore((state) => state.heroCopies);
  const heroSerials = usePlayerStore((state) => state.heroSerials);
  const heroInstanceLevels = usePlayerStore((state) => state.heroInstanceLevels);
  const heroInstanceStars = usePlayerStore((state) => state.heroInstanceStars);
  const mining = usePlayerStore((state) => state.mining);
  const tradeOffers = usePlayerStore((state) => state.tradeOffers);
  const tradeRequests = usePlayerStore((state) => state.tradeRequests);
  const playerId = usePlayerStore((state) => state.playerId);
  const createHeroOffer = usePlayerStore((state) => state.createHeroOffer);
  const createGoldOffer = usePlayerStore((state) => state.createGoldOffer);
  const createHeroRequest = usePlayerStore((state) => state.createHeroRequest);
  const createGoldRequest = usePlayerStore((state) => state.createGoldRequest);
  const cancelRequest = usePlayerStore((state) => state.cancelRequest);
  const instantSellHero = usePlayerStore((state) => state.instantSellHero);
  const instantSellGold = usePlayerStore((state) => state.instantSellGold);
  const delistOffer = usePlayerStore((state) => state.delistOffer);
  const deliverOffer = usePlayerStore((state) => state.deliverOffer);

  const [view, setView] = useState<TradeView>('offer');
  const [kind, setKind] = useState<OfferKind>('hero');
  const [requestKind, setRequestKind] = useState<RequestKind>('hero');
  const [offerCurrency, setOfferCurrency] = useState<TradeCurrency>('gold');
  const [heroPriceDrafts, setHeroPriceDrafts] = useState<Record<string, string>>({});
  const [expandedHeroId, setExpandedHeroId] = useState<string | null>(null);
  const [goldAmount, setGoldAmount] = useState('100');
  const [goldPrice, setGoldPrice] = useState('1');
  const [requestHeroId, setRequestHeroId] = useState(HEROES[0]?.id ?? 'durov');
  const [requestGoldAmount, setRequestGoldAmount] = useState('100');
  const [requestPrice, setRequestPrice] = useState('1');
  const [notice, setNotice] = useState<string | null>(null);

  const activeOffers = tradeOffers.filter((offer) => offer.status === 'active');
  const deliveredOffers = tradeOffers.filter((offer) => offer.status === 'delivered');
  const activeGoldOffer = activeOffers.some((offer) => offer.kind === 'gold');
  const offerAmount = parseAmount(goldAmount);
  const offerPrice = parseAmount(goldPrice);
  const activeRequests = tradeRequests.filter((request) => request.status === 'active');
  const highestRequests = tradeRequestsByPrice(activeRequests);
  const bestGoldRequest = highestRequest(
    tradeRequests,
    'gold',
    playerId,
    (request) => request.kind === 'gold' && request.goldAmount === offerAmount,
  );

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

  const updateHeroPrice = (groupKey: string, value: string) => {
    setHeroPriceDrafts((current) => ({ ...current, [groupKey]: value }));
  };

  const availableHeroes = HEROES.filter(
    (hero) => ownedHeroIds.includes(hero.id),
  );

  const offerHero = (heroId: string, instanceSerial: number, price: number) => {
    const hero = HEROES.find((candidate) => candidate.id === heroId);
    report(
      createHeroOffer(heroId, price, offerCurrency, instanceSerial),
      `Level-specific offer created for ${hero?.name ?? 'hero'}.`,
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

  const submitRequest = () => {
    const price = parseAmount(requestPrice);
    const success = requestKind === 'hero'
      ? createHeroRequest(requestHeroId, price)
      : createGoldRequest(parseAmount(requestGoldAmount), price);
    report(
      success,
      success
        ? `Request placed for ${formatTradeAmount(price, 'bwar')}. Highest price fills first.`
        : '',
    );
  };

  const removeRequest = (request: TradeRequest) => {
    report(cancelRequest(request.requestId), 'Request cancelled and $BWAR refunded.');
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
    if (offer.sellerId === playerId) {
      setNotice('You cannot buy your own offer. Cancel it instead.');
      return;
    }
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
        {(['offer', 'deliver', 'request'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`tabs__btn${view === value ? ' is-active' : ''}`}
            role="tab"
            aria-selected={view === value}
            onClick={() => pickView(value)}
          >
            {value === 'offer' ? 'Offer' : value === 'deliver' ? 'Deliver' : 'Request'}
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
                  const copies = heroCopiesOf(heroCopies, hero.id);
                  const mainSerial = heroSerials[hero.id] ?? null;
                  const instances = heroInstancesOf(
                    mainSerial,
                    copies,
                    heroInstanceLevels,
                    heroInstanceStars,
                    heroLevels[hero.id] ?? 0,
                    heroStars[hero.id] ?? 1,
                  );
                  const groups = groupHeroInstances(instances);
                  const isExpanded = expandedHeroId === hero.id;
                  return (
                    <div className="stack" key={hero.id}>
                      <Card className="trade-row">
                        <HeroAvatar hero={hero} size="sm" />
                        <div className="trade-row__main">
                          <div className="trade-row__title">{hero.name}</div>
                          <div className="trade-row__meta">
                            <RarityBadge rarity={hero.rarity} height={16} />
                            <span>
                              {instances.length} instance{instances.length === 1 ? '' : 's'} ·{' '}
                              {groups.length} level group{groups.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isExpanded ? 'gold' : 'ghost'}
                          onClick={() => setExpandedHeroId(isExpanded ? null : hero.id)}
                        >
                          {isExpanded ? 'Hide levels' : 'Choose level'}
                        </Button>
                      </Card>

                      {isExpanded ? groups.map((group) => {
                        const preferredInstance =
                          group.instances.find((instance) => !instance.isMain) ?? group.instances[0];
                        const draftKey = `${hero.id}:${group.key}`;
                        const suggested = heroTradePrice(
                          hero,
                          group.level,
                          offerCurrency,
                          'sell',
                          group.stars,
                        );
                        const price = parseAmount(heroPriceDrafts[draftKey] ?? String(suggested));
                        const miningLocked =
                          preferredInstance.isMain && mining?.heroId === hero.id;
                        const lastHero =
                          preferredInstance.isMain &&
                          copies.length === 0 &&
                          ownedHeroIds.length <= 1;
                        const bestHeroRequest = highestRequest(
                          tradeRequests,
                          'hero',
                          playerId,
                          (request) => request.kind === 'hero' && request.heroId === hero.id,
                        );
                        const blocked = miningLocked || lastHero;
                        return (
                          <Card className="trade-row" key={group.key}>
                            <HeroAvatar hero={hero} size="sm" />
                            <div className="trade-row__main">
                              <div className="trade-row__title">
                                {hero.name} · Lv {group.level}
                              </div>
                              <div className="trade-row__meta">
                                <span>{formatStars(group.stars)}</span>
                                <Badge tone="gold">×{group.instances.length}</Badge>
                                <span>
                                  {preferredInstance.isMain ? 'Main instance' : 'Stacked copies'}
                                </span>
                                {miningLocked ? <Badge tone="danger">Mining</Badge> : null}
                              </div>
                              <label className="trade-price-field">
                                <span>Custom price</span>
                                <input
                                  className="trade-amount__input trade-price-input"
                                  type="number"
                                  min="0.01"
                                  step={offerCurrency === 'gold' ? '1' : '0.01'}
                                  value={heroPriceDrafts[draftKey] ?? String(suggested)}
                                  onChange={(event) => updateHeroPrice(draftKey, event.target.value)}
                                  aria-label={`Custom price for ${hero.name} level ${group.level}`}
                                />
                              </label>
                            </div>
                            <div className="trade-offer-actions">
                              {bestHeroRequest !== undefined ? (
                                <Button
                                  size="sm"
                                  variant="gold"
                                  disabled={blocked}
                                  onClick={() =>
                                    report(
                                      instantSellHero(hero.id, preferredInstance.serial),
                                      'Hero sold to the highest matching request.',
                                    )
                                  }
                                >
                                  Instant Sell
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant={bestHeroRequest === undefined ? 'gold' : 'ghost'}
                                disabled={blocked || !isValidTradePrice(price, offerCurrency)}
                                onClick={() =>
                                  offerHero(hero.id, preferredInstance.serial, price)
                                }
                              >
                                {blocked
                                  ? miningLocked
                                    ? 'Unstack first'
                                    : 'Last hero'
                                  : 'Offer'}
                              </Button>
                            </div>
                          </Card>
                        );
                      }) : null}
                    </div>
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
              <div className="trade-item__actions">
                {bestGoldRequest !== undefined ? (
                  <Button
                    size="sm"
                    variant="gold"
                    disabled={
                      !Number.isInteger(offerAmount) ||
                      offerAmount <= 0 ||
                      offerAmount > gold
                    }
                    onClick={() => report(instantSellGold(offerAmount), 'Gold sold to the highest request.')}
                  >
                    Instant Sell
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant={bestGoldRequest === undefined ? 'gold' : 'ghost'}
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
              </div>
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
                    Cancel
                  </Button>
                }
              />
            ))
          ) : (
            <div className="empty-state">No active offers.</div>
          )}
        </div>
      ) : view === 'deliver' ? (
        <div className="stack">
          <div className="trade-section-title">Ready to deliver</div>
          {activeOffers.length > 0 ? (
            activeOffers.map((offer) =>
              offer.sellerId === playerId ? (
                <OfferCard
                  key={offer.offerId}
                  offer={offer}
                  actions={
                    <Button size="sm" variant="ghost" onClick={() => delist(offer)}>
                      Cancel
                    </Button>
                  }
                />
              ) : (
                <OfferCard
                  key={offer.offerId}
                  offer={offer}
                  actions={
                    <Button size="sm" variant="gold" onClick={() => deliver(offer)}>
                      Deliver
                    </Button>
                  }
                />
              ),
            )
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
      ) : (
        <div className="stack">
          <div className="trade-section-title">Place a buy request</div>
          <Card className="trade-item">
            <AssetImg
              assetId={requestKind === 'hero' ? iconIds.hero : iconIds.gold}
              alt=""
              className="trade-item__icon"
            />
            <div className="trade-row__main">
              <div className="trade-row__title">Request in $BWAR</div>
              <div className="trade-row__meta">
                <Badge tone="gold">Your price</Badge>
                <span>Escrowed until fill or cancel</span>
              </div>
              <div className="trade-tabs" role="tablist" aria-label="Request asset">
                {(['hero', 'gold'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`tabs__btn${requestKind === value ? ' is-active' : ''}`}
                    role="tab"
                    aria-selected={requestKind === value}
                    onClick={() => {
                      setRequestKind(value);
                      setNotice(null);
                    }}
                  >
                    {value === 'hero' ? 'Hero' : 'Gold'}
                  </button>
                ))}
              </div>
              <div className="trade-form-grid">
                {requestKind === 'hero' ? (
                  <label className="trade-price-field">
                    <span>Hero</span>
                    <select
                      className="trade-amount__input"
                      value={requestHeroId}
                      onChange={(event) => setRequestHeroId(event.target.value)}
                      aria-label="Requested Hero"
                    >
                      {HEROES.map((hero) => (
                        <option key={hero.id} value={hero.id}>{hero.name}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="trade-price-field">
                    <span>Gold amount</span>
                    <input
                      className="trade-amount__input"
                      type="number"
                      min="1"
                      step="1"
                      value={requestGoldAmount}
                      onChange={(event) => setRequestGoldAmount(event.target.value)}
                      aria-label="Requested Gold amount"
                    />
                  </label>
                )}
                <label className="trade-price-field">
                  <span>Price in BWAR</span>
                  <input
                    className="trade-amount__input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={requestPrice}
                    onChange={(event) => setRequestPrice(event.target.value)}
                    aria-label="Request price in BWAR"
                  />
                </label>
              </div>
            </div>
            <Button
              size="sm"
              variant="gold"
              disabled={
                !isValidTradePrice(parseAmount(requestPrice), 'bwar') ||
                parseAmount(requestPrice) > bwar ||
                (requestKind === 'gold' &&
                  (!Number.isInteger(parseAmount(requestGoldAmount)) ||
                    parseAmount(requestGoldAmount) <= 0))
              }
              onClick={submitRequest}
            >
              Place Request
            </Button>
          </Card>

          <div className="trade-section-title">Requests · highest first</div>
          {highestRequests.length > 0 ? (
            highestRequests.map((request) => (
              <RequestCard
                key={request.requestId}
                request={request}
                actions={
                  request.requesterId === playerId && request.status === 'active' ? (
                    <Button size="sm" variant="ghost" onClick={() => removeRequest(request)}>
                      Cancel
                    </Button>
                  ) : null
                }
              />
            ))
          ) : (
            <div className="empty-state">No active buy requests.</div>
          )}
        </div>
      )}

      <Card flat tight className="trade-rules">
        Choose a Hero instance by level and star; equal instances display as one ×N stack.
        Offers escrow the exact serial at your price. Requests escrow $BWAR and the highest
        matching price fills first through Instant Sell. Mining locks only the roster instance.
      </Card>
    </div>
  );
};
