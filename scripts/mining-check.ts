/**
 * BWAR MINING VERIFICATION
 * ========================
 * Checks the local mining lifecycle independently of the battle suites.
 */
import { HASHRATE_PERIOD_MS, MINING_DURATION_MS } from '../src/data/balance';
import { hashrateFor } from '../src/data/economy';
import { memoryStorage } from '../src/storage/StorageAdapter';
import { createRuntime } from '../src/state/runtime';
import { miningProgress } from '../src/services/miningService';

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

const close = (left: number, right: number): boolean => Math.abs(left - right) < 1e-9;

const NOW = 1_700_000_000_000;
const storage = memoryStorage();
const runtime = createRuntime(storage);
const profile = runtime.players.loadOrCreate();

check('mining: a fresh player has no active session', profile.mining === null);
check(
  'mining: a Level 0 common hero has no hashrate',
  hashrateFor('common', 0) === 0,
);
check(
  'mining: a hero with zero hashrate cannot be equipped',
  runtime.miningService.start(profile, 'durov', NOW).ok === false,
);

const started = runtime.miningService.start(profile, 'elonmusk', NOW);
check('mining: a Legendary hero can start at Level 0', started.ok);
check('mining: one hero is active after Equip', started.ok && started.profile.mining?.heroId === 'elonmusk');
check(
  'mining: the 24-hour target is snapshotted in 10-minute hashrate blocks',
  started.ok &&
    close(
      started.profile.mining?.rewardAmount ?? 0,
      (hashrateFor('legendary', 0) * MINING_DURATION_MS) / HASHRATE_PERIOD_MS,
    ),
);

if (started.ok) {
  const session = started.profile.mining;
  if (session !== null) {
    const beforePeriod = miningProgress(session, NOW + HASHRATE_PERIOD_MS - 1);
    const firstPeriod = miningProgress(session, NOW + HASHRATE_PERIOD_MS);
    check('mining: nothing is earned before a full 10-minute block', beforePeriod.amount === 0);
    check(
      'mining: the first full block pays one character hashrate',
      close(firstPeriod.amount, hashrateFor('legendary', 0)),
    );
    const half = miningProgress(session, NOW + MINING_DURATION_MS / 2);
    check('mining: halfway progress pays halfway', close(half.amount, session.rewardAmount / 2));
    check('mining: an exact-start claim has nothing to credit', runtime.miningService.claim(started.profile, NOW).ok === false);

    const halfAt = NOW + MINING_DURATION_MS / 2;
    const earlyClaimed = runtime.miningService.claim(started.profile, halfAt);
    check(
      'mining: an early claim credits the accrued amount and restarts',
      earlyClaimed.ok &&
        close(earlyClaimed.amount, session.rewardAmount / 2) &&
        earlyClaimed.profile.mining?.startedAt === halfAt,
    );

    const fullAt = halfAt + MINING_DURATION_MS;
    const fullSession = earlyClaimed.ok ? earlyClaimed.profile.mining : null;
    const full = fullSession === null ? miningProgress(session, fullAt) : miningProgress(fullSession, fullAt);
    check('mining: a 24-hour session reaches full exactly', full.full && close(full.amount, session.rewardAmount));
    check('mining: progress never exceeds the target', close(miningProgress(session, fullAt + 60_000).amount, session.rewardAmount));

    const claimed = earlyClaimed.ok ? runtime.miningService.claim(earlyClaimed.profile, fullAt) : earlyClaimed;
    check('mining: a full claim succeeds', claimed.ok);
    check(
      'mining: claim credits both cycles and restarts the same hero',
      claimed.ok &&
        close(claimed.profile.bwarBalance, session.rewardAmount * 1.5) &&
        claimed.profile.mining?.startedAt === fullAt,
    );

    if (claimed.ok) {
      const duplicate = runtime.miningService.claim(claimed.profile, fullAt);
      check('mining: an immediate duplicate claim is refused', duplicate.ok === false);
      check('mining: duplicate claim does not double the balance', close(claimed.profile.bwarBalance, session.rewardAmount * 1.5));
    }
  }
}

const reloaded = runtime.players.load();
check('mining: session survives a reload', reloaded !== null && reloaded.mining?.heroId === 'elonmusk');
check('mining: balance survives a reload', reloaded !== null && reloaded.bwarBalance > 0);

const switched = runtime.miningService.start(reloaded ?? profile, 'gracychen', NOW + MINING_DURATION_MS * 1.5 + 1);
check('mining: changing hero starts a new session', switched.ok && switched.profile.mining?.heroId === 'gracychen');
check('mining: only one hero remains active', switched.ok && switched.profile.mining?.heroId !== 'elonmusk');

if (failures.length > 0) {
  console.error(`\n${failures.length} mining check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} mining checks passed.`);
