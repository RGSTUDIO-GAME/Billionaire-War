/**
 * DATA LAYER VERIFICATION
 * ========================
 * Encodes the Prompt 5 acceptance list: the game survives being closed, a
 * damaged save is repaired instead of fatal, $GOLD can only move through one
 * service and never below zero, a finished battle is archived exactly once, a
 * settlement is never paid twice - not even across a reload - and the engine
 * still knows nothing about any of it.
 *
 * A "reload" is a second runtime over the same bytes. That is exactly what the
 * game does when it is closed and reopened, so every persistence rule is
 * asserted from a fresh object graph rather than from warm memory.
 *
 * Run with: npm run verify
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_ROUNDS, STARTING_BWAR, STARTING_GOLD } from '../src/data/balance';
import { BASE_HASHRATE, MAX_HERO_LEVEL, UPGRADE_BASE_COST, hashrateFor, heroLevelOf, totalUpgradeCost, upgradeCost } from '../src/data/economy';
import { getFreeHeroes } from '../src/data/heroes';
import { BATTLE_STATUS } from '../src/engine/types';
import type { BattleState } from '../src/engine/types';
import { parseBattleRecord } from '../src/repositories/battleRepository';
import { parseLedger, parseTransaction } from '../src/repositories/goldRepository';
import { newProfile, parseProfile } from '../src/repositories/playerRepository';
import { browserStorage, memoryStorage } from '../src/storage/StorageAdapter';
import type { StorageAdapter } from '../src/storage/StorageAdapter';
import { STORAGE_KEYS, STORAGE_VERSION } from '../src/storage/keys';
import { MAX_LEDGER_ENTRIES } from '../src/storage/records';
import type { BattleRecord, GoldTransaction } from '../src/storage/records';
import { createRuntime } from '../src/state/runtime';
import type { AppRuntime } from '../src/state/runtime';
import { createHydratedPlayerStore, createPlayerStore } from '../src/state/playerStore';
import { usePlayerStore } from '../src/state/playerStore';

const ROOT = process.cwd();
const readSource = (...parts: string[]): string => readFileSync(join(ROOT, ...parts), 'utf8');
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Type-only imports are erased at build time, so a type two layers share is
 * not a runtime dependency. Stripping them lets the import rules below be
 * strict about CODE while still letting a record shape be named in a type.
 */
const stripTypeImports = (source: string): string =>
  stripComments(source)
    .replace(/^\s*import\s+type\s+[\s\S]*?from\s+'[^']*';?$/gm, '')
    .replace(/^\s*export\s+type\s*\{[\s\S]*?\};?$/gm, '');

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

const NOW = 1_700_000_000_000;

/** A battle the engine has already finished, shaped the way it leaves one. */
const finishedBattle = (battleId: string, winner: 'A' | 'B' | 'DRAW' = 'A'): BattleState =>
  ({
    battleId,
    mode: 'bot',
    status: BATTLE_STATUS.BATTLE_RESULT,
    currentRound: 2,
    winner,
    playerA: { currentHp: winner === 'B' ? 0 : 700 },
    playerB: { currentHp: winner === 'A' ? 0 : 300 },
    result: {
      winner,
      playerAHP: winner === 'B' ? 0 : 700,
      playerBHP: winner === 'A' ? 0 : 300,
      roundsPlayed: 2,
      timedOut: { A: false, B: false },
    },
  }) as unknown as BattleState;

/** A brand new, isolated game world. */
const world = (storage: StorageAdapter = memoryStorage()): AppRuntime => createRuntime(storage);

/* ------------------------------------------------------- 1. storage adapter */

{
  const storage = memoryStorage({ seed: 'value' });
  check('storage: an in-memory cell reads back what was written', storage.read('seed') === 'value');
  storage.write('seed', 'changed');
  check('storage: a write replaces the cell', storage.read('seed') === 'changed');
  check('storage: an unknown key reads as null', storage.read('missing') === null);
  storage.write('second', 'x');
  check('storage: keys lists what is stored', storage.keys().length === 2, storage.keys().join(','));
  storage.remove('second');
  check('storage: a removed key is gone', storage.keys().length === 1, storage.keys().join(','));

  // A storage that throws must degrade to something the game can still run on.
  const realStorage = globalThis.localStorage;
  const throwing = {
    get length(): number {
      throw new Error('blocked');
    },
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
    key: () => {
      throw new Error('blocked');
    },
    clear: () => {},
  };
  globalThis.localStorage = throwing as unknown as Storage;
  let degraded: StorageAdapter | null = null;
  try {
    degraded = browserStorage();
  } finally {
    globalThis.localStorage = realStorage;
  }
  check('storage: blocked storage does not throw while being built', degraded !== null);
  check('storage: a blocked storage still accepts a write', degraded!.write('k', 'v') === true);
  check('storage: a blocked storage reads back its own write', degraded!.read('k') === 'v');

  const runtime = world();
  check('storage: a write that fails is reported, never thrown',
    (() => {
      const failing: StorageAdapter = {
        read: () => null,
        write: () => {
          throw new Error('quota exceeded');
        },
        remove: () => {},
        keys: () => [],
      };
      return world(failing).players.save(newProfile(NOW)) === false;
    })());
  check('storage: an unwritable save is reported, not thrown', runtime.players.load() === null);
}

/* ------------------------------------------------ 2. the profile survives */

{
  const storage = memoryStorage();
  const first = world(storage);
  const created = first.players.loadOrCreate();

  check('profile: a new player has an id', created.playerId.length > 0, created.playerId);
  check('profile: a new player has a username', created.username.startsWith('PLAYER-'), created.username);
  check('profile: a new player starts with the configured GOLD', created.goldBalance === STARTING_GOLD, String(created.goldBalance));
  check('profile: a new player starts with the configured $BWAR', created.bwarBalance === STARTING_BWAR, String(created.bwarBalance));
  check('profile: the free hero is owned from the first second',
    created.ownedHeroes.includes(getFreeHeroes()[0].id), created.ownedHeroes.join(','));
  check('profile: the equipped hero is one the player owns', created.ownedHeroes.includes(created.equippedHeroId));
  check('profile: the record is written at the current schema version', created.version === STORAGE_VERSION);

  // A reload is a second object graph over the same bytes.
  const reloaded = world(storage).players.load();
  check('profile: identity survives a reload', reloaded?.playerId === created.playerId, String(reloaded?.playerId));
  check('profile: the balance survives a reload', reloaded?.goldBalance === created.goldBalance);
  check('reload: nothing is minted a second time',
    (world(storage).players.loadOrCreate().playerId) === created.playerId);
}

{
  const storage = memoryStorage();
  const app = world(storage);
  const created = app.players.loadOrCreate();
  app.goldService.credit(created, 500, { kind: 'GRANT' }, NOW);
  app.players.save({ ...app.players.load()!, equippedHeroId: 'durov', ownedHeroes: ['durov'] });

  const reloaded = world(storage).players.load();
  check('profile: a credited balance survives a reload', reloaded?.goldBalance === STARTING_GOLD + 500, String(reloaded?.goldBalance));
  check('profile: the ledger survives a reload', world(storage).gold.list().length === 1);
  check('profile: the credited balance is not paid out twice', reloaded?.goldBalance === STARTING_GOLD + 500);
}

/* -------------------------------------------------- 3. a damaged save heals */

{
  const storage = memoryStorage();
  const app = world(storage);
  const created = app.players.loadOrCreate();
  app.goldService.credit(created, 750, { kind: 'GRANT' }, NOW);
  const playerId = app.players.load()!.playerId;

  // Corrupt JSON, as a truncated write would leave behind.
  storage.write(STORAGE_KEYS.player, '{"playerId":"broken","gold');
  check('recovery: unreadable JSON is not fatal', app.players.load() === null);
  check('recovery: an unreadable save is replaced by a new player', app.players.loadOrCreate().playerId !== playerId);

  // A readable record with fields that cannot be trusted.
  const damaged = {
    playerId,
    username: '   ',
    goldBalance: 'not a number',
    bwarBalance: -5,
    ownedHeroes: ['durov', 'a_hero_that_does_not_exist'],
    equippedHeroId: 'a_hero_that_does_not_exist',
    createdAt: -1,
  };
  storage.write(STORAGE_KEYS.player, JSON.stringify(damaged));
  // The ledger lives in another repository, so the recovery is injected
  // rather than known: `load(rebuildGold)` is the wiring every caller uses.
  const repaired = app.players.load((id) => app.gold.rebuildBalance(id))!;

  check('recovery: a readable record keeps its identity', repaired.playerId === playerId);
  check('recovery: a damaged balance is rebuilt from the ledger',
    repaired.goldBalance === STARTING_GOLD + 750, String(repaired.goldBalance));
  check('recovery: a damaged username is regenerated from the id',
    repaired.username === `PLAYER-${playerId.replace(/^player_/, '').toUpperCase().slice(0, 6)}`, repaired.username);
  check('recovery: a negative $BWAR counter falls back to the starting value',
    repaired.bwarBalance === STARTING_BWAR, String(repaired.bwarBalance));
  check('recovery: a hero that does not exist is dropped from the roster',
    !repaired.ownedHeroes.includes('a_hero_that_does_not_exist'), repaired.ownedHeroes.join(','));
  check('recovery: the free hero stays owned', repaired.ownedHeroes.includes(getFreeHeroes()[0].id));
  check('recovery: an unowned equipped hero falls back to an owned one',
    repaired.ownedHeroes.includes(repaired.equippedHeroId), repaired.equippedHeroId);
  check('recovery: a damaged timestamp falls back to now', repaired.createdAt > 0);
  check('recovery: the store rebuilds a damaged balance too',
    createHydratedPlayerStore(app).getState().gold === STARTING_GOLD + 750,
    String(createHydratedPlayerStore(app).getState().gold));

  // A damaged balance with nothing to rebuild it from.
  storage.write(STORAGE_KEYS.goldLedger, JSON.stringify([]));
  storage.write(STORAGE_KEYS.player, JSON.stringify({ ...damaged, goldBalance: null }));
  check('recovery: an unrecoverable balance starts the player over, not at zero',
    app.players.load()!.goldBalance === STARTING_GOLD, String(app.players.load()!.goldBalance));
}

{
  const asProfile = (raw: unknown) => parseProfile(raw, { now: NOW });
  check('recovery: junk is not a profile', asProfile(null) === null);
  check('recovery: an array is not a profile', asProfile([]) === null);
  check('recovery: a profile with no id is given a fresh one',
    asProfile({ goldBalance: 10 })?.playerId.startsWith('player_') === true);
  check('recovery: a float balance is not trusted',
    asProfile({ playerId: 'player_x1', goldBalance: 10.5 })?.goldBalance === STARTING_GOLD,
    String(asProfile({ playerId: 'player_x1', goldBalance: 10.5 })?.goldBalance));
  check('recovery: an Infinity balance is not trusted',
    asProfile({ playerId: 'player_x1', goldBalance: Number.POSITIVE_INFINITY })?.goldBalance === STARTING_GOLD);
  check('recovery: a negative balance is not trusted',
    asProfile({ playerId: 'player_x1', goldBalance: -100 })?.goldBalance === STARTING_GOLD);
}

/* ------------------------------------------------------ 4. $GOLD only moves */

{
  const app = world();
  const created = app.players.loadOrCreate();

  const credited = app.goldService.credit(created, 250, { kind: 'GRANT' }, NOW);
  check('gold: a credit is accepted', credited.ok);
  check('gold: a credit adds exactly the amount', credited.profile.goldBalance === STARTING_GOLD + 250, String(credited.profile.goldBalance));
  check('gold: a credit is recorded', app.gold.list().length === 1);

  const debited = app.goldService.debit(credited.profile, 100, {}, NOW + 1);
  check('gold: a debit is accepted', debited.ok);
  check('gold: a debit takes exactly the amount', debited.profile.goldBalance === STARTING_GOLD + 150, String(debited.profile.goldBalance));

  const refused = app.goldService.debit(debited.profile, 10_000, {}, NOW + 2);
  check('gold: a debit larger than the balance is refused', !refused.ok && refused.reason === 'INSUFFICIENT_FUNDS');
  check('gold: a refused debit leaves the balance untouched',
    refused.profile.goldBalance === STARTING_GOLD + 150, String(refused.profile.goldBalance));
  check('gold: a refused debit writes nothing to the ledger', app.gold.list().length === 2, String(app.gold.list().length));

  for (const amount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const outcome = app.goldService.debit(debited.profile, amount, {}, NOW + 3);
    check(`gold: a debit of ${String(amount)} is refused`, !outcome.ok && outcome.reason === 'INVALID_AMOUNT');
  }
  check('gold: the balance never went below zero', app.gold.list().every((entry) => entry.balanceAfter >= 0));
  check('gold: the ledger only holds whole amounts',
    app.gold.list().every((entry) => Number.isInteger(entry.amount) && Number.isInteger(entry.balanceAfter)));

  const latest = app.gold.list()[0];
  check('ledger: an entry records the balance before it', latest.balanceBefore === STARTING_GOLD + 250, String(latest.balanceBefore));
  check('ledger: an entry records the balance after it', latest.balanceAfter === STARTING_GOLD + 150, String(latest.balanceAfter));
  check('ledger: a debit is recorded as a SPEND', latest.kind === 'SPEND', latest.kind);
  check('ledger: the newest entry is first', app.gold.list()[0].createdAt >= app.gold.list()[1].createdAt);
  check('ledger: the balance can be rebuilt from the ledger',
    app.gold.rebuildBalance(created.playerId) === STARTING_GOLD + 150,
    String(app.gold.rebuildBalance(created.playerId)));
  check('ledger: an empty ledger rebuilds to nothing', world().gold.rebuildBalance('player_nobody') === null);

  const entry = app.gold.list()[0];
  check('ledger: a balanced entry is accepted', parseTransaction(entry) !== null);
  check('ledger: an entry whose arithmetic does not add up is rejected',
    parseTransaction({ ...entry, balanceAfter: entry.balanceAfter + 1 }) === null);
  check('ledger: an entry with a negative balance is rejected',
    parseTransaction({ ...entry, balanceBefore: -1, balanceAfter: entry.amount - 1 }) === null);
  check('ledger: an entry with no id is rejected', parseTransaction({ ...entry, transactionId: '' }) === null);
  check('ledger: junk is not a ledger', parseLedger('nonsense').length === 0);
  check('ledger: a list keeps only usable entries',
    parseLedger([entry, null, 'nope', { ...entry, kind: 'MYSTERY' }]).length === 1);
}

{
  const app = world();
  const created = app.players.loadOrCreate();
  for (let index = 0; index < MAX_LEDGER_ENTRIES + 25; index += 1) {
    app.goldService.credit(created, 1, { kind: 'GRANT' }, NOW + index);
  }
  const entries = app.gold.list();
  check(`ledger: the ledger is trimmed to ${MAX_LEDGER_ENTRIES} entries`, entries.length === MAX_LEDGER_ENTRIES, String(entries.length));
  check('ledger: trimming keeps the newest entries',
    entries[0].createdAt === NOW + MAX_LEDGER_ENTRIES + 24, String(entries[0].createdAt));
}

/* --------------------------------------------------- 5. battle history */

{
  const storage = memoryStorage();
  const app = world(storage);
  const created = app.players.loadOrCreate();
  const record: BattleRecord = {
    battleId: 'btl-history-1',
    playerId: created.playerId,
    mode: 'bot',
    result: 'VICTORY',
    finalHp: 700,
    opponentFinalHp: 0,
    roundsPlayed: 2,
    completedAt: NOW,
  };

  check('history: a finished battle is archived', app.battleService.archive(finishedBattle('btl-history-1'), created.playerId, NOW) !== null);
  check('history: the archive is readable', app.battles.list().length === 1);
  check('history: a battle id cannot be archived twice', app.battleService.archive(finishedBattle('btl-history-1'), created.playerId, NOW) !== null && app.battles.list().length === 1);
  check('history: an unfinished battle is not archived',
    app.battleService.archive({ ...finishedBattle('btl-open'), status: BATTLE_STATUS.SELECTION } as BattleState, created.playerId, NOW) === null);
  check('history: a battle without a result is not archived',
    app.battleService.archive({ ...finishedBattle('btl-null'), winner: null } as unknown as BattleState, created.playerId, NOW) === null);
  check('history: an abandoned battle leaves no record', app.battles.list().length === 1, String(app.battles.list().length));

  const other: BattleRecord = { ...record, battleId: 'btl-history-2', playerId: 'player_someone_else' };
  app.battles.append(other);
  check('history: another player\'s battles are not shown', app.battles.list(created.playerId).length === 1);
  check('history: the newest battle is first', app.battles.list()[0].battleId === 'btl-history-2');
  check('history: a battle is found by its id', app.battles.findById('btl-history-1')?.roundsPlayed === 2);
  check('history: an unknown id finds nothing', app.battles.findById('btl-nothing') === null);

  check('history: the archive survives a reload', world(storage).battles.list().length === 2, String(world(storage).battles.list().length));
  check('history: a reloaded archive keeps its entries intact',
    world(storage).battles.findById('btl-history-1')?.playerId === created.playerId);
}

{
  const base: BattleRecord = {
    battleId: 'btl-x',
    playerId: 'player_x1',
    mode: 'bot',
    result: 'DRAW',
    finalHp: 100,
    opponentFinalHp: 100,
    roundsPlayed: 2,
    completedAt: NOW,
  };
  check('history: a well-formed record is accepted', parseBattleRecord(base) !== null);
  check('history: junk is not a record', parseBattleRecord(null) === null);
  check('history: a record with no battle id is rejected', parseBattleRecord({ ...base, battleId: '' }) === null);
  check('history: a record with an unknown mode is rejected', parseBattleRecord({ ...base, mode: 'arena' }) === null);
  check('history: a record with an unknown result is rejected', parseBattleRecord({ ...base, result: 'WIN' }) === null);
  check('history: a record with negative HP is rejected', parseBattleRecord({ ...base, finalHp: -1 }) === null);
  check('history: rounds are capped at the maximum a battle can have',
    parseBattleRecord({ ...base, roundsPlayed: 99 })?.roundsPlayed === MAX_ROUNDS,
    String(parseBattleRecord({ ...base, roundsPlayed: 99 })?.roundsPlayed));
  check('history: a record with no round count is repaired to one',
    parseBattleRecord({ ...base, roundsPlayed: 'two' })?.roundsPlayed === 1);
}

/* ------------------------------------- 6. identity and payments across reloads */

{
  const storage = memoryStorage();
  const session = world(storage);
  const created = session.players.loadOrCreate();
  const firstId = session.battleService.nextId(777);

  // A reload: a brand new object graph over the same bytes.
  const reopened = world(storage);
  const secondId = reopened.battleService.nextId(777);
  check('identity: a reload cannot reissue a battle id', firstId !== secondId, `${firstId} vs ${secondId}`);
  check('identity: the id survives being persisted', reopened.players.load()?.playerId === created.playerId);

  const paid = session.rewardService.settle(finishedBattle(firstId, 'A'), NOW);
  check('settlement: the first session pays', paid?.status === 'GRANTED', String(paid?.status));
  const goldAfter = session.players.load()!.goldBalance;

  const refused = reopened.rewardService.settle(finishedBattle(firstId, 'A'), NOW);
  check('settlement: a reload still refuses to pay the same battle twice',
    refused?.status === 'ALREADY_SETTLED', String(refused?.status));
  check('settlement: the refused payout moves nothing',
    reopened.players.load()!.goldBalance === goldAfter, String(reopened.players.load()!.goldBalance));
  check('settlement: the refused payout reports what was really paid',
    refused?.transaction.transactionId === paid?.transaction.transactionId);
  check('settlement: the refused payout is the recorded one',
    reopened.gold.list().some((entry) => entry.transactionId === paid?.transaction.transactionId));
  check('settlement: the ledger holds exactly one payout', reopened.gold.list().length === 1, String(reopened.gold.list().length));

  const fresh = reopened.rewardService.settle(finishedBattle(secondId, 'A'), NOW);
  check('settlement: a new battle after a reload is paid normally', fresh?.status === 'GRANTED', String(fresh?.status));
  check('settlement: a new battle after a reload moves the balance',
    reopened.players.load()!.goldBalance === goldAfter + rewardOf(fresh), String(reopened.players.load()!.goldBalance));
  check('history: a settled battle is archived', reopened.battles.findById(firstId) !== null);
  check('history: the archive holds both battles', reopened.battles.list().length === 2, String(reopened.battles.list().length));
  check('history: the newest battle is first', reopened.battles.list()[0].battleId === secondId);
  check('history: the archived result is the one the player got',
    reopened.battles.findById(firstId)?.result === 'VICTORY');
  check('history: the archived round count is real',
    reopened.battles.findById(firstId)?.roundsPlayed === 2);

  // A reward the gold service refuses is not a reward. A broken configuration
  // must report nothing rather than a payout that never reached the ledger.
  const goldBeforeBroken = reopened.players.load()!.goldBalance;
  const broken = reopened.rewardService.settle(finishedBattle('btl-broken-reward', 'A'), NOW, {
    config: { vsBot: { victory: -500, defeat: 0, draw: 0 }, pvp: { victory: 0, defeat: 0, draw: 0 } },
  });
  check('settlement: a reward the gold service refuses reports nothing', broken === null, String(broken));
  check('settlement: a refused reward moves nothing',
    reopened.players.load()!.goldBalance === goldBeforeBroken, String(reopened.players.load()!.goldBalance));
  check('settlement: a refused reward writes nothing to the ledger',
    reopened.gold.list().some((entry) => entry.battleId === 'btl-broken-reward') === false);
}

/** The amount a settlement actually paid. */
function rewardOf(outcome: { transaction: GoldTransaction } | null): number {
  return outcome?.transaction.amount ?? -1;
}

/* ------------------------------------------------------ 7. the store mirror */

{
  const storage = memoryStorage();
  const app = world(storage);
  const store = createHydratedPlayerStore(app);

  check('store: the save is read back the moment the store exists', store.getState().hydrated);
  check('store: the store shows the persisted identity', store.getState().playerId === app.players.load()?.playerId);
  check('store: the store shows the persisted balance', store.getState().gold === STARTING_GOLD);

  check('store: $GOLD can be added', store.getState().addGold(300) === true);
  check('store: the added $GOLD is persisted', app.players.load()?.goldBalance === STARTING_GOLD + 300);
  check('store: the store mirrors the new balance', store.getState().gold === STARTING_GOLD + 300);
  check('store: $GOLD can be taken', store.getState().debitGold(200) === true);
  check('store: a debit larger than the balance is refused', store.getState().debitGold(99_999) === false);
  check('store: a refused debit persists nothing', app.players.load()?.goldBalance === STARTING_GOLD + 100, String(app.players.load()?.goldBalance));
  check('store: a negative credit is refused', store.getState().addGold(-50) === false);
  check('store: the store shows the ledger', store.getState().goldTransactions.length === 2, String(store.getState().goldTransactions.length));

  // The payout on the card mirrors the ledger; it never pays a second time.
  const settlement = app.rewardService.settle(finishedBattle('btl-store-1', 'A'), NOW);
  check('store: a battle can be settled', settlement?.status === 'GRANTED');
  const goldAfterSettlement = app.players.load()!.goldBalance;
  const ledgerAfterSettlement = app.gold.list().length;
  store.getState().applyReward(settlement!);
  check('store: showing a reward does not pay again', app.players.load()!.goldBalance === goldAfterSettlement);
  check('store: showing a reward does not add to the ledger',
    app.gold.list().length === ledgerAfterSettlement, String(app.gold.list().length));
  check('store: the card shows the recorded payout', store.getState().lastReward?.transactionId === settlement?.transaction.transactionId);
  check('store: the card shows the settled battle', store.getState().lastReward?.battleId === 'btl-store-1');
  store.getState().clearLastReward();
  check('store: the card can be cleared', store.getState().lastReward === null);
  check('store: clearing the card keeps the ledger',
    store.getState().goldTransactions.length === ledgerAfterSettlement, String(store.getState().goldTransactions.length));
  check('store: the settlement is remembered', store.getState().settledRewards.includes(`btl-store-1::${store.getState().playerId}`),
    store.getState().settledRewards.join(','));
  check('store: the finished battle is in the history', store.getState().battleHistory.length === 1);

  const beforeWipe = app.players.load()!.playerId;
  store.getState().resetProgress();
  check('wipe: the save is gone', app.players.load()?.playerId !== beforeWipe, String(app.players.load()?.playerId));
  check('wipe: the balance is back to the starting value', store.getState().gold === STARTING_GOLD, String(store.getState().gold));
  check('wipe: the ledger is gone', store.getState().goldTransactions.length === 0);
  check('wipe: the history is gone', store.getState().battleHistory.length === 0);
  check('wipe: the card is cleared', store.getState().lastReward === null);
  check('wipe: the roster is back to the free heroes',
    store.getState().ownedHeroIds.join(',') === getFreeHeroes().map((hero) => hero.id).join(','));

  // The store has to be usable AFTER a wipe, not just before it.
  check('wipe: the store still saves after a wipe', store.getState().addGold(10) === true);
  check('wipe: what it saved is really on disk', app.players.load()?.goldBalance === STARTING_GOLD + 10, String(app.players.load()?.goldBalance));
  check('wipe: the hero can still be equipped after a wipe', store.getState().equipHero(getFreeHeroes()[0].id) === undefined);
  check('wipe: a battle can still be settled after a wipe',
    app.rewardService.settle(finishedBattle('btl-after-wipe', 'A'), NOW)?.status === 'GRANTED');
}

{
  // A store is only a mirror: until it has read the save, it says so.
  const app = world();
  const store = createPlayerStore(app);
  check('store: a fresh store has not read the save yet', store.getState().hydrated === false);
  check('store: a fresh store shows no player', store.getState().playerId === '', store.getState().playerId);
  store.getState().hydrate();
  check('store: reading the save hydrates the store', store.getState().hydrated === true);
  check('store: reading the save brings the player back', store.getState().playerId === app.players.load()?.playerId);
  store.getState().resetProgress();
  check('store: the live store can be wiped without breaking', usePlayerStore.getState().resetProgress() === undefined);
  check('store: the live store keeps working after a wipe', usePlayerStore.getState().addGold(5) === true);
}

/* ------------------------------------------------------- 8. layer discipline */

{
  const sourceFiles = (directory: string): string[] => {
    const root = join(ROOT, 'src', directory);
    return readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
      .map((name) => join(root, name));
  };

  // localStorage is the storage adapter's business and nobody else's.
  const outsiders = [...sourceFiles('state'), ...sourceFiles('services'), ...sourceFiles('repositories'),
    ...sourceFiles('screens'), ...sourceFiles('components'), ...sourceFiles('rewards'), ...sourceFiles('engine')]
    .filter((file) => stripComments(readFileSync(file, 'utf8')).includes('localStorage'));
  check('layers: nothing outside src/storage touches localStorage', outsiders.length === 0, outsiders.join(','));

  const upward = (directory: string, forbidden: RegExp): string[] =>
    sourceFiles(directory)
      .filter((file) => forbidden.test(stripTypeImports(readFileSync(file, 'utf8'))))
      .map((file) => file.slice(join(ROOT, 'src').length + 1));

  check('layers: a repository knows nothing about the UI or the stores',
    upward('repositories', /from '(\.\.\/)+(state|components|screens|hooks)\//).length === 0,
    upward('repositories', /from '(\.\.\/)+(state|components|screens|hooks)\//).join(','));
  check('layers: a service knows nothing about the UI or the stores',
    upward('services', /from '(\.\.\/)+(state|components|screens|hooks)\//).length === 0,
    upward('services', /from '(\.\.\/)+(state|components|screens|hooks)\//).join(','));
  check('layers: the reward system imports no storage CODE',
    upward('rewards', /from '\.\.\/(storage|repositories)\//).length === 0,
    upward('rewards', /from '\.\.\/(storage|repositories)\//).join(','));

  const engineLeaks = sourceFiles('engine')
    .filter((file) => ['storage', 'repository', 'gold', 'ledger', 'localstorage', 'playerstore']
      .some((word) => stripComments(readFileSync(file, 'utf8')).toLowerCase().includes(word)))
    .map((file) => file.slice(join(ROOT, 'src').length + 1));
  check('layers: the battle engine knows nothing about persistence', engineLeaks.length === 0, engineLeaks.join(','));

  // A balance can be stored anywhere as data, but the arithmetic that MOVES
  // it belongs to one service. A second layer computing a balance would leave
  // the ledger describing only some of the money that moved.
  const balanceMath = [...sourceFiles('state'), ...sourceFiles('repositories'), ...sourceFiles('services')]
    .filter((file) => !file.endsWith('services/goldService.ts'))
    .filter((file) => /goldBalance[^\n]*[-+][^=]/.test(stripComments(readFileSync(file, 'utf8'))))
    .map((file) => file.slice(join(ROOT, 'src').length + 1));
  check('layers: a balance is only ever computed in the gold service',
    balanceMath.length === 0, balanceMath.join(','));

  const wiring = sourceFiles('state')
    .filter((file) => stripComments(readFileSync(file, 'utf8')).includes('resolveStorage('))
    .map((file) => file.slice(join(ROOT, 'src').length + 1));
  check('layers: runtime.ts is the only place that resolves the storage', wiring.join(',') === 'state/runtime.ts', wiring.join(','));

  const builders = sourceFiles('state')
    .filter((file) => stripComments(readFileSync(file, 'utf8')).includes('new PlayerRepository('))
    .map((file) => file.slice(join(ROOT, 'src').length + 1));
  check('layers: runtime.ts is the only place that builds the data layer',
    builders.join(',') === 'state/runtime.ts', builders.join(','));

  const storage = stripComments(readSource('src', 'storage', 'keys.ts'));
  check('layers: every record has its own versioned key',
    ['player', 'goldLedger', 'battleHistory'].every((key) => storage.includes(`${key}:`) && storage.includes('STORAGE_VERSION')));
  check('layers: storage keys are namespaced to the game', Object.values(STORAGE_KEYS).every((key) => key.startsWith('billionaire-war:')));
}

/* -------------------------------------------------------- hero economy */

{
  // Spec price list: Lv X -> Lv X+1 costs 100,000 x (X+1) $GOLD.
  check('economy: Lv0 -> Lv1 costs 100,000', upgradeCost(0) === 100_000);
  check('economy: Lv1 -> Lv2 costs 200,000', upgradeCost(1) === 200_000);
  check('economy: Lv2 -> Lv3 costs 300,000', upgradeCost(2) === 300_000);
  check('economy: Lv9 -> Lv10 costs 1,000,000', upgradeCost(9) === 1_000_000);
  check('economy: Lv99 -> Lv100 costs 10,000,000', upgradeCost(99) === 10_000_000);
  check('economy: nothing to buy at max level', upgradeCost(MAX_HERO_LEVEL) === null);
  check('economy: Lv0 -> Lv100 costs 505,000,000 in total', totalUpgradeCost(0, MAX_HERO_LEVEL) === 505_000_000);

  // Spec hashrate table, plus linearity: each level adds one base unit.
  const close = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;
  check('economy: base table matches spec',
    BASE_HASHRATE.common === 0.000001 &&
    BASE_HASHRATE.uncommon === 0.00001 &&
    BASE_HASHRATE.rare === 0.0001 &&
    BASE_HASHRATE.epic === 0.001 &&
    BASE_HASHRATE.legendary === 0.01);
  check('economy: Level 0 mines nothing', hashrateFor('legendary', 0) === 0);
  check('economy: legendary Lv1 mines 0.01 BWAR/s', close(hashrateFor('legendary', 1), 0.01));
  check('economy: legendary Lv100 mines 1 BWAR/s', close(hashrateFor('legendary', 100), 1));
  check('economy: max table matches spec',
    close(hashrateFor('common', 100), 0.0001) &&
    close(hashrateFor('uncommon', 100), 0.001) &&
    close(hashrateFor('rare', 100), 0.01) &&
    close(hashrateFor('epic', 100), 0.1) &&
    close(hashrateFor('legendary', 100), 1));
  check('economy: one level always adds one base unit',
    close(hashrateFor('rare', 50) - hashrateFor('rare', 49), BASE_HASHRATE.rare) &&
    close(hashrateFor('epic', 77), 77 * BASE_HASHRATE.epic));

  // Persistence: levels survive a reload, garbage is repaired.
  const fresh = newProfile(NOW);
  check('economy: new heroes start at Level 0', heroLevelOf(fresh.heroLevels, 'durov') === 0);
  const repaired = parseProfile(
    { ...fresh, heroLevels: { durov: 5, elonmusk: 150, nope: 3, gracychen: 'x' } },
    { now: NOW },
  );
  check('economy: stored levels load back',
    repaired !== null && heroLevelOf(repaired.heroLevels, 'durov') === 5);
  check('economy: unknown heroes and bad values are dropped, levels clamp to max',
    repaired !== null &&
    !('nope' in repaired.heroLevels) &&
    !('gracychen' in repaired.heroLevels) &&
    repaired.heroLevels.elonmusk === MAX_HERO_LEVEL);

  // Store: real $GOLD moves through the ledger, or nothing moves at all.
  const game = world();
  const store = createPlayerStore(game);
  store.getState().hydrate();
  check('economy: unknown heroes cannot level', store.getState().upgradeHero('nope') === false);
  check('economy: broke players cannot level', store.getState().upgradeHero('durov') === false);
  store.getState().addGold(1_000_000);
  const before = store.getState().gold;
  check('economy: affordable upgrade levels up', store.getState().upgradeHero('durov') === true);
  check('economy: upgrade debits exactly the linear price',
    store.getState().gold === before - UPGRADE_BASE_COST &&
    heroLevelOf(store.getState().heroLevels, 'durov') === 1);
  const spent = store.getState().goldTransactions.find((entry) => entry.amount === -UPGRADE_BASE_COST);
  check('economy: upgrade spend is written to the ledger', spent !== undefined && spent.balanceAfter === before - UPGRADE_BASE_COST);
}

/* ----------------------------------------------------------------- report */

if (failures.length > 0) {
  console.error(`\n${failures.length} data layer check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} data layer checks passed.`);
