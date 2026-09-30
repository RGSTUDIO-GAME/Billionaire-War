/**
 * TRADE VERIFICATION
 * ==================
 * Checks hero and Gold marketplace rules independently of the UI.
 */
import { heroTradePrice, goldItemPrice } from '../src/data/trade';
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
      rewardAmount: 864,
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
        const delivered = offerWorld.tradeService.deliverOffer(secondOffer.profile, secondId, NOW + 3);
        check('offer: Deliver completes an active offer', delivered.ok);
        check(
          'offer: Deliver credits the player custom price',
          delivered.ok && delivered.profile.goldBalance === base.goldBalance + 900,
        );
        check(
          'offer: a delivered hero remains outside the roster',
          delivered.ok && !delivered.profile.ownedHeroes.includes(hero.id),
        );
        if (delivered.ok) {
          const closed = offerWorld.tradeService.delistOffer(delivered.profile, secondId, NOW + 4);
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
        const delivered = offerWorld.tradeService.deliverOffer(secondOffer.profile, secondId, NOW + 3);
        check('offer: delivering a Gold offer credits its custom BWAR price', delivered.ok && close(delivered.profile.bwarBalance, base.bwarBalance + 12.5));
        if (delivered.ok) {
          const closed = offerWorld.tradeService.delistOffer(delivered.profile, secondId, NOW + 4);
          check('offer: delivered Gold can be delisted from history', closed.ok);
        }
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
