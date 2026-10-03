/**
 * FUSION VERIFICATION
 * ====================
 * Checks the star system independently of the UI: supply math, serial
 * identity, copy grants, fusion costs, the upgrade star-cap and the way
 * hero offers carry stars through escrow.
 */
import {
  COPIES_PER_SIX_STAR,
  fusionCostCopies,
  heroCopiesOf,
  heroSerialOf,
  heroStackCountOf,
  heroStarsOf,
  maxLevelForStars,
  maxSixStarCount,
  totalFusionCostToMax,
  MAX_STARS,
} from '../src/data/fusion';
import { HEROES } from '../src/data/heroes';
import { memoryStorage } from '../src/storage/StorageAdapter';
import { createRuntime } from '../src/state/runtime';
import { createPlayerStore } from '../src/state/playerStore';

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

const NOW = 1_700_000_000_000;
const heroId = HEROES[0].id;

/* Star caps follow the tier table. */
{
  check('fusion: 1 star caps at Lv 20', maxLevelForStars(1) === 20);
  check('fusion: 2 stars cap at Lv 35', maxLevelForStars(2) === 35);
  check('fusion: 3 stars cap at Lv 50', maxLevelForStars(3) === 50);
  check('fusion: 4 stars cap at Lv 65', maxLevelForStars(4) === 65);
  check('fusion: 5 stars cap at Lv 80', maxLevelForStars(5) === 80);
  check('fusion: 6 stars cap at Lv 100', maxLevelForStars(6) === 100);
}

/* Each fusion step doubles its material: 1, 2, 4, 8, 16. */
{
  check('fusion: 1->2 burns 1 copy', fusionCostCopies(1) === 1);
  check('fusion: 2->3 burns 2 copies', fusionCostCopies(2) === 2);
  check('fusion: 3->4 burns 4 copies', fusionCostCopies(3) === 4);
  check('fusion: 4->5 burns 8 copies', fusionCostCopies(4) === 8);
  check('fusion: 5->6 burns 16 copies', fusionCostCopies(5) === 16);
  check('fusion: 6 stars cannot fuse', fusionCostCopies(6) === null);
  check('fusion: 1->6 burns 31 copies plus the main hero', totalFusionCostToMax() === COPIES_PER_SIX_STAR - 1);
}

/* Supply divided by 32 is the most 6-star heroes one hero can produce. */
{
  check('fusion: common supply allows 5,000 at 6 stars', maxSixStarCount('common') === 5_000);
  check('fusion: uncommon supply allows 2,500 at 6 stars', maxSixStarCount('uncommon') === 2_500);
  check('fusion: rare supply allows 1,250 at 6 stars', maxSixStarCount('rare') === 1_250);
  check('fusion: epic supply allows 625 at 6 stars', maxSixStarCount('epic') === 625);
  check('fusion: legendary supply allows 156 at 6 stars', maxSixStarCount('legendary') === 156);
}

/* A fresh profile fields one-star heroes, each with its own serial. */
{
  const runtime = createRuntime(memoryStorage());
  const fresh = runtime.players.loadOrCreate();
  check('fusion: new heroes are 1 star', heroStarsOf(fresh.heroStars, heroId) === 1);
  const serials = fresh.ownedHeroes.map((owned) => heroSerialOf(fresh.heroSerials, owned));
  check(
    'fusion: every roster hero has a unique serial',
    serials.every((serial) => typeof serial === 'number') && new Set(serials).size === serials.length,
    serials.join(','),
  );
}

/* Copies are granted with unique serials; unknown heroes are refused. */
{
  const runtime = createRuntime(memoryStorage());
  const fresh = runtime.players.loadOrCreate();
  const refused = runtime.fusionService.grantCopy(fresh, 'nope', NOW);
  check('fusion: unknown heroes grant nothing', refused.ok === false);

  const granted = runtime.fusionService.grantCopy(fresh, heroId, NOW);
  check('fusion: an owned hero gains a spare copy', granted.ok && heroCopiesOf(granted.profile.heroCopies, heroId).length === 1);
  const grantedAgain = granted.ok
    ? runtime.fusionService.grantCopy(granted.profile, heroId, NOW + 1)
    : null;
  const serials = grantedAgain && grantedAgain.ok
    ? [heroSerialOf(grantedAgain.profile.heroSerials, heroId), ...heroCopiesOf(grantedAgain.profile.heroCopies, heroId)]
    : [];
  check(
    'fusion: main and spare serials never collide',
    grantedAgain !== null && grantedAgain.ok && new Set(serials).size === serials.length,
    serials.join(','),
  );

  const lockedId = HEROES.find((hero) => !fresh.ownedHeroes.includes(hero.id))?.id;
  if (lockedId !== undefined) {
    const unlocked = runtime.fusionService.grantCopy(fresh, lockedId, NOW + 2);
    check(
      'fusion: granting a locked hero unlocks its roster instance, not a copy',
      unlocked.ok &&
        unlocked.profile.ownedHeroes.includes(lockedId) &&
        heroCopiesOf(unlocked.profile.heroCopies, lockedId).length === 0,
    );
  }
}

/* A complete Gacha pull saves atomically and updates the Hero stack count. */
{
  const runtime = createRuntime(memoryStorage());
  const fresh = runtime.players.loadOrCreate();
  const secondHeroId = HEROES[1].id;
  const batch = runtime.fusionService.grantCopies(
    fresh,
    [heroId, heroId, secondHeroId],
    NOW + 10,
  );
  check(
    'fusion: a Gacha batch stacks duplicate heroes',
    batch.ok &&
      heroStackCountOf(batch.profile.heroCopies, heroId) === 3 &&
      heroStackCountOf(batch.profile.heroCopies, secondHeroId) === 2,
  );

  const persisted = runtime.players.load();
  check(
    'fusion: a Gacha batch persists every copy in one save',
    persisted !== null &&
      heroStackCountOf(persisted.heroCopies, heroId) === 3 &&
      heroStackCountOf(persisted.heroCopies, secondHeroId) === 2,
  );

  const atomicRuntime = createRuntime(memoryStorage());
  const atomicFresh = atomicRuntime.players.loadOrCreate();
  const refusedBatch = atomicRuntime.fusionService.grantCopies(
    atomicFresh,
    [heroId, 'nope'],
    NOW + 11,
  );
  const atomicStored = atomicRuntime.players.load();
  check(
    'fusion: an invalid Gacha batch changes nothing',
    refusedBatch.ok === false &&
      heroStackCountOf(atomicFresh.heroCopies, heroId) === 1 &&
      heroStackCountOf(atomicStored?.heroCopies, heroId) === 1,
  );

  const storeRuntime = createRuntime(memoryStorage());
  storeRuntime.players.loadOrCreate();
  const gachaStore = createPlayerStore(storeRuntime);
  gachaStore.getState().hydrate();
  check(
    'store: the Gacha action refreshes duplicate counts',
    gachaStore.getState().grantGachaHeroes([heroId, heroId]) &&
      heroStackCountOf(gachaStore.getState().heroCopies, heroId) === 3 &&
      heroStackCountOf(storeRuntime.players.load()?.heroCopies, heroId) === 3,
  );
}

/* A duplicate of a maxed roster hero remains a separate sellable copy. */
{
  const runtime = createRuntime(memoryStorage());
  const fresh = runtime.players.loadOrCreate();
  const maxed = {
    ...fresh,
    ownedHeroes: [heroId],
    equippedHeroId: heroId,
    heroLevels: { [heroId]: 100 },
    heroStars: { [heroId]: MAX_STARS },
    heroCopies: {},
  };
  runtime.players.save(maxed);
  const storedMaxed = runtime.players.load() ?? maxed;
  const granted = runtime.fusionService.grantCopy(storedMaxed, heroId, NOW + 20);
  check(
    'gacha: a duplicate of a maxed hero stays separate from the Level 100 main',
    granted.ok &&
      granted.profile.ownedHeroes.includes(heroId) &&
      granted.profile.heroLevels[heroId] === 100 &&
      heroCopiesOf(granted.profile.heroCopies, heroId).length === 1,
  );

  if (granted.ok) {
    const mainSerial = heroSerialOf(granted.profile.heroSerials, heroId);
    const copySerial = heroCopiesOf(granted.profile.heroCopies, heroId)[0];
    const offered = runtime.tradeService.createHeroOffer(granted.profile, heroId, 42, 'gold', NOW + 21);
    check(
      'trade: Gacha duplicate is offered as a Level 0 copy',
      offered.ok &&
        offered.profile.ownedHeroes.includes(heroId) &&
        offered.profile.heroLevels[heroId] === 100 &&
        offered.profile.tradeOffers?.[0]?.kind === 'hero' &&
        offered.profile.tradeOffers[0].kind === 'hero' &&
        offered.profile.tradeOffers[0].heroLevel === 0 &&
        offered.profile.tradeOffers[0].heroCopySerial === copySerial,
    );
    check(
      'trade: offering the duplicate never escrows the maxed main hero',
      offered.ok &&
        heroSerialOf(offered.profile.heroSerials, heroId) === mainSerial &&
        heroCopiesOf(offered.profile.heroCopies, heroId).length === 0,
    );

    if (offered.ok) {
      const offerId = offered.profile.tradeOffers?.[0]?.offerId ?? '';
      const reloaded = runtime.players.load();
      check(
        'trade: an active copy offer survives reload beside its owned main',
        reloaded?.ownedHeroes.includes(heroId) === true &&
          reloaded?.tradeOffers?.some((offer) =>
            offer.offerId === offerId &&
            offer.status === 'active' &&
            offer.kind === 'hero' &&
            offer.heroCopySerial === copySerial,
          ) === true,
      );
      const delisted = runtime.tradeService.delistOffer(offered.profile, offerId, NOW + 22);
      check(
        'trade: delisting returns only the same duplicate serial',
        delisted.ok &&
          delisted.profile.ownedHeroes.includes(heroId) &&
          delisted.profile.heroLevels[heroId] === 100 &&
          heroCopiesOf(delisted.profile.heroCopies, heroId).includes(copySerial),
      );

      if (delisted.ok) {
        const grown = runtime.fusionService.grantCopy(delisted.profile, heroId, NOW + 23);
        if (grown.ok) {
          const grownCopies = heroCopiesOf(grown.profile.heroCopies, heroId);
          const detailedCopy = grownCopies[grownCopies.length - 1];
          const detailedProfile = {
            ...grown.profile,
            heroInstanceLevels: {
              ...(grown.profile.heroInstanceLevels ?? {}),
              [String(detailedCopy)]: 12,
            },
            heroInstanceStars: {
              ...(grown.profile.heroInstanceStars ?? {}),
              [String(detailedCopy)]: 3,
            },
          };
          const detailedOffer = runtime.tradeService.createHeroOffer(
            detailedProfile,
            heroId,
            88,
            'bwar',
            NOW + 24,
            detailedCopy,
          );
          check(
            'trade: selecting a copy preserves its exact level and stars',
            detailedOffer.ok &&
              detailedOffer.profile.heroLevels[heroId] === 100 &&
              detailedOffer.profile.heroStars[heroId] === MAX_STARS &&
              detailedOffer.profile.tradeOffers?.[0]?.kind === 'hero' &&
              detailedOffer.profile.tradeOffers[0].kind === 'hero' &&
              detailedOffer.profile.tradeOffers[0].heroLevel === 12 &&
              detailedOffer.profile.tradeOffers[0].heroStars === 3 &&
              detailedOffer.profile.tradeOffers[0].heroSerial === detailedCopy,
          );
          if (detailedOffer.ok) {
            const detailedOfferId = detailedOffer.profile.tradeOffers?.[0]?.offerId ?? '';
            const returnedCopy = runtime.tradeService.delistOffer(
              detailedOffer.profile,
              detailedOfferId,
              NOW + 25,
            );
            check(
              'trade: Delist returns the exact detailed copy serial',
              returnedCopy.ok &&
                heroCopiesOf(returnedCopy.profile.heroCopies, heroId).includes(detailedCopy) &&
                returnedCopy.profile.heroLevels[heroId] === 100,
            );
          }
        }

        const grownAgain = runtime.players.load();
        if (grownAgain !== null) {
          const selectedMain = heroSerialOf(grownAgain.heroSerials, heroId);
          const mainOffer = runtime.tradeService.createHeroOffer(
            grownAgain,
            heroId,
            99,
            'gold',
            NOW + 26,
            selectedMain,
          );
          check(
            'trade: a maxed main can be selected while copies remain',
            mainOffer.ok &&
              mainOffer.profile.ownedHeroes.includes(heroId) &&
              mainOffer.profile.heroLevels[heroId] === 12 &&
              mainOffer.profile.heroStars[heroId] === 3 &&
              heroSerialOf(mainOffer.profile.heroSerials, heroId) !== selectedMain &&
              mainOffer.profile.tradeOffers?.[0]?.kind === 'hero' &&
              mainOffer.profile.tradeOffers[0].kind === 'hero' &&
              mainOffer.profile.tradeOffers[0].heroLevel === 100 &&
              mainOffer.profile.tradeOffers[0].heroStars === MAX_STARS &&
              mainOffer.profile.tradeOffers[0].heroSerial === selectedMain,
          );
          if (mainOffer.ok) {
            const mainOfferId = mainOffer.profile.tradeOffers?.[0]?.offerId ?? '';
            const returnedMain = runtime.tradeService.delistOffer(
              mainOffer.profile,
              mainOfferId,
              NOW + 27,
            );
            check(
              'trade: Delist promotes the exact maxed main back into place',
              returnedMain.ok &&
                heroSerialOf(returnedMain.profile.heroSerials, heroId) === selectedMain &&
                returnedMain.profile.heroLevels[heroId] === 100 &&
                returnedMain.profile.heroStars[heroId] === MAX_STARS &&
                heroCopiesOf(returnedMain.profile.heroCopies, heroId).length === 2,
            );
          }
        }
      }
    }
  }
}

/* Fusion burns exactly the step cost and lifts one tier. */
{
  const runtime = createRuntime(memoryStorage());
  const fresh = runtime.players.loadOrCreate();
  const unknown = runtime.fusionService.fuse(fresh, 'nope', NOW);
  check('fusion: unknown heroes cannot fuse', unknown.ok === false && unknown.reason === 'UNKNOWN_HERO');

  const broke = runtime.fusionService.fuse(fresh, heroId, NOW);
  check('fusion: fusing without copies is refused', broke.ok === false && broke.reason === 'NOT_ENOUGH_COPIES');

  let profile = fresh;
  for (let index = 0; index < 31; index += 1) {
    const granted = runtime.fusionService.grantCopy(profile, heroId, NOW + index);
    if (!granted.ok) break;
    profile = granted.profile;
  }
  check('fusion: 31 spare copies can be stockpiled', heroCopiesOf(profile.heroCopies, heroId).length === 31);

  const stars: number[] = [];
  for (let step = 0; step < 5; step += 1) {
    const fused = runtime.fusionService.fuse(profile, heroId, NOW + 100 + step);
    if (!fused.ok) break;
    profile = fused.profile;
    stars.push(heroStarsOf(profile.heroStars, heroId));
  }
  check('fusion: five fusions climb 1 star to 6 stars', stars.join(',') === '2,3,4,5,6', stars.join(','));
  check('fusion: the climb burns all 31 spares', heroCopiesOf(profile.heroCopies, heroId).length === 0);
  const maxed = runtime.fusionService.fuse(profile, heroId, NOW + 200);
  check('fusion: a 6-star hero cannot fuse further', maxed.ok === false && maxed.reason === 'MAX_STARS');

  const reloaded = runtime.players.load();
  check(
    'fusion: stars and serials survive reload',
    heroStarsOf(reloaded?.heroStars, heroId) === MAX_STARS &&
      heroSerialOf(reloaded?.heroSerials, heroId) !== null,
  );
}

/* The star tier gates upgrades: 20 levels, fuse, then level 21 opens. */
{
  const storeRuntime = createRuntime(memoryStorage());
  storeRuntime.players.loadOrCreate();
  const useTestStore = createPlayerStore(storeRuntime);
  useTestStore.getState().hydrate();
  const credited = storeRuntime.goldService.credit(storeRuntime.players.load()!, 1_000_000_000, { kind: 'GRANT' }, NOW);
  if (credited.ok) useTestStore.getState().hydrate();

  let ups = 0;
  while (useTestStore.getState().upgradeHero(heroId)) {
    ups += 1;
    if (ups > 150) break;
  }
  const cappedLevel = useTestStore.getState().heroLevels[heroId] ?? 0;
  check('fusion: a 1-star hero stops at Lv 20', ups === 20 && cappedLevel === 20, `${ups}/${cappedLevel}`);
  check('fusion: the 21st upgrade is refused at 1 star', useTestStore.getState().upgradeHero(heroId) === false);

  const loaded = storeRuntime.players.load()!;
  const granted = storeRuntime.fusionService.grantCopy(loaded, heroId, NOW + 1);
  if (granted.ok) useTestStore.getState().hydrate();
  check('fusion: one copy funds the first fusion', useTestStore.getState().fuseHero(heroId) === true);
  check('fusion: fusing to 2 stars opens Lv 21', useTestStore.getState().upgradeHero(heroId) === true);
}

/* Hero offers carry stars through escrow; duplicates arrive as copies. */
{
  const runtime = createRuntime(memoryStorage());
  const base = runtime.players.loadOrCreate();
  const starred = {
    ...base,
    heroLevels: { [heroId]: 5 },
    heroStars: { [heroId]: 4 },
  };
  const offered = runtime.tradeService.createHeroOffer(starred, heroId, 777, 'bwar', NOW);
  check('fusion: offers escrow the star tier', offered.ok && offered.profile.tradeOffers?.[0]?.kind === 'hero' &&
    (offered.profile.tradeOffers[0].kind === 'hero' ? offered.profile.tradeOffers[0].heroStars : 0) === 4);
  if (offered.ok) {
    const offerId = offered.profile.tradeOffers?.[0]?.offerId ?? '';
    const delisted = runtime.tradeService.delistOffer(offered.profile, offerId, NOW + 1);
    check(
      'fusion: delisting restores the star tier',
      delisted.ok && heroStarsOf(delisted.profile.heroStars, heroId) === 4,
    );
  }

  const buyerWorld = createRuntime(memoryStorage());
  const buyer = buyerWorld.players.loadOrCreate();
  const richBuyer = {
    ...buyer,
    goldBalance: 10_000_000,
    ownedHeroes: [heroId],
    equippedHeroId: heroId,
    heroSerials: { [heroId]: 10 },
    heroSerialCounter: 10,
    tradeOffers: [
      {
        offerId: 'offer_foreign_1',
        sellerId: 'someone-else',
        kind: 'hero' as const,
        heroId,
        heroLevel: 3,
        heroStars: 2,
        heroSerial: 9_001,
        heroCopies: [9_002, 9_003],
        wasEquipped: false,
        currency: 'gold' as const,
        price: 100,
        status: 'active' as const,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  };
  const delivered = buyerWorld.tradeService.deliverOffer(richBuyer, 'offer_foreign_1', NOW + 1);
  check(
    'fusion: delivering a duplicate grants a serialised copy, not a second roster slot',
    delivered.ok &&
      delivered.profile.ownedHeroes.filter((owned) => owned === heroId).length === 1 &&
      heroCopiesOf(delivered.profile.heroCopies, heroId).length === 3,
  );
  check(
    'fusion: delivering a main offer transfers its serial and every escrowed copy',
    delivered.ok &&
      delivered.profile.ownedHeroes.filter((owned) => owned === heroId).length === 1 &&
      [9_001, 9_002, 9_003].every((serial) =>
        heroCopiesOf(delivered.profile.heroCopies, heroId).includes(serial),
      ),
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} fusion check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} fusion checks passed.`);
