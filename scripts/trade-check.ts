/**
 * TRADE VERIFICATION
 * ==================
 * Checks hero and Gold marketplace rules independently of the UI.
 */
import { heroTradePrice, goldItemPrice } from '../src/data/trade';
import { heroCopiesOf } from '../src/data/fusion';
import { HEROES } from '../src/data/heroes';
import { memoryStorage } from '../src/storage/StorageAdapter';
import { createRuntime } from '../src/state/runtime';

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

const close = (left: number, right: number): boolean => Math.abs(left - right) < 1e-9;
const NOW = 1_700_000_000_000;
const runtime = createRuntime(memoryStorage());

const fresh = runtime.players.loadOrCreate();
check('trade: a fresh profile owns the initial roster', fresh.ownedHeroes.length > 0);
check(
  'trade: hero prices use the rarity base price',
  close(heroTradePrice(HEROES[0], 0, 'gold', 'buy'), HEROES[0].priceInGold ?? 500),
  String(heroTradePrice(HEROES[0], 0, 'gold', 'buy')),
);
check(
  'trade: selling returns 60 percent of buy value',
  close(heroTradePrice(HEROES[0], 10, 'gold', 'sell'), heroTradePrice(HEROES[0], 10, 'gold', 'buy') * 0.6),
);
check(
  'trade: star tiers raise the quoted Hero value',
  heroTradePrice(HEROES[0], 0, 'bwar', 'sell', 6) >
    heroTradePrice(HEROES[0], 0, 'bwar', 'sell', 1),
);

/* A saved one-hero roster must not be repaired back to every free hero. */
{
  const oneHero = {
    ...fresh,
    ownedHeroes: [HEROES[0].id],
    equippedHeroId: HEROES[0].id,
  };
  runtime.players.save(oneHero);
  const reloaded = runtime.players.load();
  check(
    'trade: a sold free hero is not re-granted on reload',
    reloaded?.ownedHeroes.length === 1 && reloaded.ownedHeroes[0] === HEROES[0].id,
    reloaded?.ownedHeroes.join(','),
  );
}

/* A leveled hero must return at Level 0 after being sold. */
{
  runtime.players.save({
    ...fresh,
    ownedHeroes: [HEROES[0].id, HEROES[1].id],
    equippedHeroId: HEROES[0].id,
    heroLevels: { [HEROES[0].id]: 7 },
    goldBalance: 1_000,
    bwarBalance: 0,
  });
  const leveled = runtime.players.load() ?? fresh;
  const sold = runtime.tradeService.sellHero(leveled, HEROES[0].id, 'gold', NOW);
  check('trade: a non-mining hero can be sold', sold.ok);
  check(
    'trade: selling clears the sold hero level',
    sold.ok && !(HEROES[0].id in sold.profile.heroLevels),
    Object.keys(sold.profile.heroLevels).join(','),
  );

  if (sold.ok) {
    const bought = runtime.tradeService.buyHero(sold.profile, HEROES[0].id, 'gold', NOW);
    check('trade: a sold hero can be bought back', bought.ok);
    check(
      'trade: a repurchased hero starts at Level 0',
      bought.ok && !(HEROES[0].id in bought.profile.heroLevels),
    );
  }
}

/* The active mining hero is locked until MiningService.unstack. */
{
  const miningHero = {
    ...fresh,
    ownedHeroes: [HEROES[0].id, HEROES[1].id],
    equippedHeroId: HEROES[0].id,
    heroLevels: { [HEROES[1].id]: 1 },
    mining: {
      heroId: HEROES[1].id,
      hashrate: 0.01,
      rewardAmount: 1.44,
      startedAt: NOW,
    },
  };
  runtime.players.save(miningHero);
  const locked = runtime.players.load() ?? miningHero;
  const refused = runtime.tradeService.sellHero(locked, HEROES[1].id, 'bwar', NOW);
  check('trade: the mining hero cannot be sold', refused.ok === false);
  check(
    'trade: a refused sale leaves the roster unchanged',
    refused.profile.ownedHeroes.length === 2,
  );
}

/* The last playable hero is protected. */
{
  runtime.players.save({
    ...fresh,
    ownedHeroes: [HEROES[0].id],
    equippedHeroId: HEROES[0].id,
    mining: null,
  });
  const onlyHero = runtime.players.load() ?? fresh;
  const refused = runtime.tradeService.sellHero(onlyHero, HEROES[0].id, 'gold', NOW);
  check('trade: the last hero cannot be sold', refused.ok === false);
  check('trade: the last hero remains equipped', refused.profile.equippedHeroId === HEROES[0].id);
}

/* A spare copy is sold first; the roster hero stays intact. */
{
  const copyWorld = createRuntime(memoryStorage());
  const onlyMain = copyWorld.players.loadOrCreate();
  const maxedHero = {
    ...onlyMain,
    ownedHeroes: [HEROES[0].id],
    equippedHeroId: HEROES[0].id,
    heroLevels: { [HEROES[0].id]: 100 },
    heroStars: { [HEROES[0].id]: 6 },
    heroCopies: { [HEROES[0].id]: [99_001] },
    goldBalance: 0,
  };
  copyWorld.players.save(maxedHero);
  const stored = copyWorld.players.load() ?? maxedHero;
  const sold = copyWorld.tradeService.sellHero(stored, HEROES[0].id, 'gold', NOW);
  check(
    'trade: direct sale spends one spare copy before the roster hero',
    sold.ok &&
      sold.profile.ownedHeroes.includes(HEROES[0].id) &&
      sold.profile.heroLevels[HEROES[0].id] === 100 &&
      heroCopiesOf(sold.profile.heroCopies, HEROES[0].id).length === 0 &&
      sold.profile.goldBalance > 0,
  );
}

/* Buy requests escrow BWAR, fill highest-first, and can be cancelled. */
{
  const requestWorld = createRuntime(memoryStorage());
  const requester = requestWorld.players.loadOrCreate();
  const fundedRequester = { ...requester, bwarBalance: 20 };
  const heroRequest = requestWorld.tradeService.createHeroRequest(fundedRequester, HEROES[0].id, 7, NOW);
  check(
    'request: creating a Hero request escrows the chosen BWAR price',
    heroRequest.ok &&
      heroRequest.profile.bwarBalance === fundedRequester.bwarBalance - 7 &&
      heroRequest.profile.tradeRequests?.[0]?.kind === 'hero' &&
      heroRequest.profile.tradeRequests[0].status === 'active',
  );
  if (heroRequest.ok) {
    const requestId = heroRequest.profile.tradeRequests?.[0]?.requestId ?? '';
    const cancelled = requestWorld.tradeService.cancelRequest(heroRequest.profile, requestId, NOW + 1);
    check(
      'request: cancelling returns the exact escrow',
      cancelled.ok && cancelled.profile.bwarBalance === fundedRequester.bwarBalance,
    );
  }

  const goldRequester = { ...requestWorld.players.loadOrCreate(), bwarBalance: 20 };
  const goldRequest = requestWorld.tradeService.createGoldRequest(goldRequester, 250, 11, NOW + 2);
  check(
    'request: Gold requests also escrow a custom BWAR price',
    goldRequest.ok &&
      goldRequest.profile.bwarBalance === goldRequester.bwarBalance - 11 &&
      goldRequest.profile.tradeRequests?.some((request) =>
        request.kind === 'gold' && request.goldAmount === 250 && request.price === 11,
      ),
  );
}

/* Instant Sell always chooses the highest matching active request. */
{
  const fillWorld = createRuntime(memoryStorage());
  const base = fillWorld.players.loadOrCreate();
  const mainSerial = base.heroSerials?.[HEROES[0].id] ?? 1;
  const heroFixture = {
    ...base,
    ownedHeroes: [HEROES[0].id, HEROES[1].id],
    tradeRequests: [
      {
        requestId: 'request_low',
        requesterId: 'buyer-low',
        kind: 'hero' as const,
        heroId: HEROES[0].id,
        price: 10,
        status: 'active' as const,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        requestId: 'request_high',
        requesterId: 'buyer-high',
        kind: 'hero' as const,
        heroId: HEROES[0].id,
        price: 20,
        status: 'active' as const,
        createdAt: NOW + 1,
        updatedAt: NOW + 1,
      },
    ],
  };
  const filled = fillWorld.tradeService.instantSellHero(
    heroFixture,
    HEROES[0].id,
    mainSerial,
    NOW + 2,
  );
  check(
    'request: Hero Instant Sell credits the highest matching price',
    filled.ok &&
      filled.profile.bwarBalance === base.bwarBalance + 20 &&
      !filled.profile.ownedHeroes.includes(HEROES[0].id) &&
      filled.profile.tradeRequests?.find((request) => request.requestId === 'request_high')?.status ===
        'fulfilled' &&
      filled.profile.tradeRequests?.find((request) => request.requestId === 'request_low')?.status ===
        'active',
  );
  check(
    'request: the selected Hero instance is removed exactly once',
    filled.ok && filled.profile.ownedHeroes.filter((id) => id === HEROES[0].id).length === 0,
  );

  const afterHeroFill = filled.ok ? filled.profile : base;
  const goldFixture = {
    ...afterHeroFill,
    ownedHeroes: [HEROES[0].id],
    goldBalance: 1_000,
    tradeRequests: [
      ...(afterHeroFill.tradeRequests ?? []),
      {
        requestId: 'gold_low',
        requesterId: 'gold-low',
        kind: 'gold' as const,
        goldAmount: 500,
        price: 5,
        status: 'active' as const,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        requestId: 'gold_high',
        requesterId: 'gold-high',
        kind: 'gold' as const,
        goldAmount: 500,
        price: 9,
        status: 'active' as const,
        createdAt: NOW + 1,
        updatedAt: NOW + 1,
      },
    ],
  };
  const goldFilled = fillWorld.tradeService.instantSellGold(goldFixture, 500, NOW + 3);
  check(
    'request: Gold Instant Sell debits Gold and credits the highest request',
    goldFilled.ok &&
      goldFilled.profile.goldBalance === 500 &&
      goldFilled.profile.bwarBalance === afterHeroFill.bwarBalance + 9 &&
      goldFilled.profile.tradeRequests?.find((request) => request.requestId === 'gold_high')?.status ===
        'fulfilled',
  );

  const reloaded = fillWorld.players.load();
  check(
    'request: request history and statuses survive reload',
    reloaded?.tradeRequests?.some((request) =>
      request.requestId === 'request_low' && request.status === 'active',
    ) === true,
  );
}

/* Gold is quoted in BWAR in both directions at 100:1. */
{
  const wallet = {
    ...fresh,
    goldBalance: 1_000,
    bwarBalance: 1,
  };
  runtime.players.save(wallet);
  const beforeBuy = runtime.players.load() ?? wallet;
  const boughtGold = runtime.tradeService.buyGold(beforeBuy, 100, NOW);
  check('trade: Gold can be bought with BWAR', boughtGold.ok);
  check(
    'trade: buying 100 Gold costs 1 BWAR',
    boughtGold.ok &&
      boughtGold.profile.goldBalance === 1_100 &&
      close(boughtGold.profile.bwarBalance, 0),
  );

  if (boughtGold.ok) {
    const soldGold = runtime.tradeService.sellGold(boughtGold.profile, 100, NOW);
    check('trade: Gold can be sold for BWAR', soldGold.ok);
    check(
      'trade: selling 100 Gold receives 1 BWAR',
      soldGold.ok &&
        soldGold.profile.goldBalance === 1_000 &&
        close(soldGold.profile.bwarBalance, 1),
    );
  }

  check('trade: the Gold exchange quote is 100:1', close(goldItemPrice(100), 1));
  const insufficient = runtime.tradeService.buyGold(beforeBuy, 10_000, NOW);
  check('trade: an unaffordable Gold purchase is refused', insufficient.ok === false);
}

{
  const zeroWallet = {
    ...fresh,
    ownedHeroes: [HEROES[0].id],
    equippedHeroId: HEROES[0].id,
    heroLevels: {},
    tradeOffers: [],
    goldBalance: 0,
    bwarBalance: 0,
    mining: null,
  };
  const heroBwar = runtime.tradeService.buyHero(zeroWallet, HEROES[1].id, 'bwar', NOW);
  const heroGold = runtime.tradeService.buyHero(zeroWallet, HEROES[1].id, 'gold', NOW);
  const goldItem = runtime.tradeService.buyGold(zeroWallet, 100, NOW);
  check('trade: zero BWAR cannot buy a hero', heroBwar.ok === false && heroBwar.reason === 'INSUFFICIENT_FUNDS');
  check('trade: zero Gold cannot buy a hero', heroGold.ok === false && heroGold.reason === 'INSUFFICIENT_FUNDS');
  check('trade: zero BWAR cannot buy Gold', goldItem.ok === false && goldItem.reason === 'INSUFFICIENT_FUNDS');
  check(
    'trade: refused zero-balance purchases move nothing',
    heroBwar.profile.goldBalance === 0 &&
      heroBwar.profile.bwarBalance === 0 &&
      heroGold.profile.ownedHeroes.length === 1 &&
      goldItem.profile.goldBalance === 0,
  );
}

{
  const offerWorld = createRuntime(memoryStorage());
  const base = offerWorld.players.loadOrCreate();
  const hero = HEROES[0];
  const firstOffer = offerWorld.tradeService.createHeroOffer(
    { ...base, heroLevels: { [hero.id]: 5 } },
    hero.id,
    777,
    'bwar',
    NOW,
  );
  check('offer: a player can create a hero offer at a custom price', firstOffer.ok);
  check(
    'offer: an active hero is held outside the roster',
    firstOffer.ok &&
      !firstOffer.profile.ownedHeroes.includes(hero.id) &&
      !(hero.id in firstOffer.profile.heroLevels),
  );

  if (firstOffer.ok) {
    const offerId = firstOffer.profile.tradeOffers?.[0]?.offerId ?? '';
    const reloaded = offerWorld.players.load();
    check(
      'offer: an active hero offer survives reload',
      reloaded?.tradeOffers?.some((offer) => offer.offerId === offerId && offer.status === 'active') === true,
    );
    const delisted = offerWorld.tradeService.delistOffer(firstOffer.profile, offerId, NOW + 1);
    check('offer: Delist returns an active hero', delisted.ok && delisted.profile.ownedHeroes.includes(hero.id));
    check(
      'offer: Delist restores the hero level and equipment',
      delisted.ok &&
        delisted.profile.heroLevels[hero.id] === 5 &&
        delisted.profile.equippedHeroId === hero.id,
    );
    check(
      'offer: Delisted offers leave the active market',
      delisted.ok && delisted.profile.tradeOffers?.every((offer) => offer.status !== 'active') === true,
    );

    if (delisted.ok) {
      const secondOffer = offerWorld.tradeService.createHeroOffer(
        delisted.profile,
        hero.id,
        900,
        'gold',
        NOW + 2,
      );
      check('offer: the same hero can be offered again', secondOffer.ok);
      if (secondOffer.ok) {
        const secondId = secondOffer.profile.tradeOffers?.[0]?.offerId ?? '';
        const blocked = offerWorld.tradeService.deliverOffer(secondOffer.profile, secondId, NOW + 3);
        check('offer: a seller cannot deliver their own offer', blocked.ok === false && blocked.reason === 'SELF_DELIVER');
        check(
          'offer: blocked self-delivery never changes the balance',
          blocked.profile.goldBalance === secondOffer.profile.goldBalance &&
            blocked.profile.bwarBalance === secondOffer.profile.bwarBalance,
        );
        const deliveredFixture = {
          ...secondOffer.profile,
          tradeOffers: secondOffer.profile.tradeOffers?.map((offer) =>
            offer.offerId === secondId ? { ...offer, status: 'delivered' as const } : offer,
          ),
        };
        const closed = offerWorld.tradeService.delistOffer(deliveredFixture, secondId, NOW + 4);
        check('offer: a delivered offer can be delisted', closed.ok);
        check(
          'offer: delisting delivery returns the hero to its owner',
          closed.ok &&
            closed.profile.ownedHeroes.includes(hero.id) &&
            closed.profile.tradeOffers?.find((offer) => offer.offerId === secondId)?.status === 'delisted',
        );
      }
    }
  }
}

{
  const offerWorld = createRuntime(memoryStorage());
  const base = offerWorld.players.loadOrCreate();
  const firstOffer = offerWorld.tradeService.createGoldOffer(base, 250, 12.5, NOW);
  check('offer: Gold can be offered at a custom BWAR price', firstOffer.ok);
  check(
    'offer: Gold is escrowed when the offer is created',
    firstOffer.ok && firstOffer.profile.goldBalance === base.goldBalance - 250,
  );

  if (firstOffer.ok) {
    const offerId = firstOffer.profile.tradeOffers?.[0]?.offerId ?? '';
    const delisted = offerWorld.tradeService.delistOffer(firstOffer.profile, offerId, NOW + 1);
    check('offer: delisting a Gold offer refunds the escrow', delisted.ok && delisted.profile.goldBalance === base.goldBalance);

    if (delisted.ok) {
      const secondOffer = offerWorld.tradeService.createGoldOffer(delisted.profile, 250, 12.5, NOW + 2);
      if (secondOffer.ok) {
        const secondId = secondOffer.profile.tradeOffers.find((offer) => offer.status === 'active')?.offerId ?? '';
        const blocked = offerWorld.tradeService.deliverOffer(secondOffer.profile, secondId, NOW + 3);
        check('offer: a seller cannot deliver their own Gold offer', blocked.ok === false && blocked.reason === 'SELF_DELIVER');
        check(
          'offer: blocked Gold delivery never adds BWAR',
          close(blocked.profile.bwarBalance, secondOffer.profile.bwarBalance),
        );
      }
    }
  }

  const invalid = offerWorld.tradeService.createGoldOffer(base, 100, 0, NOW + 5);
  check('offer: a zero price is refused', invalid.ok === false && invalid.reason === 'INVALID_PRICE');
}

if (failures.length > 0) {
  console.error(`\n${failures.length} trade check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} trade checks passed.`);
