/**
 * BWAR MINING VERIFICATION
 * ========================
 * Checks the local mining lifecycle independently of the battle suites.
 */
import { MINING_DURATION_MS } from '../src/data/balance';
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
  'mining: the 24-hour target is snapshotted from hashrate',
  started.ok && close(started.profile.mining?.rewardAmount ?? 0, (hashrateFor('legendary', 0) * MINING_DURATION_MS) / 1000),
);

if (started.ok) {
  const session = started.profile.mining;
  if (session !== null) {
    const half = miningProgress(session, NOW + MINING_DURATION_MS / 2);
    check('mining: halfway progress pays halfway', close(half.amount, session.rewardAmount / 2));
    check('mining: a session is not claimable before full', !half.full);
    check(
      'mining: an early claim is refused',
      runtime.miningService.claim(started.profile, NOW + MINING_DURATION_MS / 2).ok === false,
    );

    const fullAt = NOW + MINING_DURATION_MS;
    const full = miningProgress(session, fullAt);
    check('mining: a 24-hour session reaches full exactly', full.full && close(full.amount, session.rewardAmount));
    check('mining: progress never exceeds the target', close(miningProgress(session, fullAt + 60_000).amount, session.rewardAmount));

    const claimed = runtime.miningService.claim(started.profile, fullAt);
    check('mining: a full claim succeeds', claimed.ok);
    check('mining: claim credits the full BWAR target', claimed.ok && close(claimed.profile.bwarBalance, claimed.amount));
    check('mining: claim restarts the same hero cycle', claimed.ok && claimed.profile.mining?.startedAt === fullAt);

    if (claimed.ok) {
      const duplicate = runtime.miningService.claim(claimed.profile, fullAt + 1);
      check('mining: an immediate duplicate claim is refused', duplicate.ok === false);
      check('mining: duplicate claim does not double the balance', close(claimed.profile.bwarBalance, claimed.amount));
    }
  }
}

const reloaded = runtime.players.load();
check('mining: session survives a reload', reloaded !== null && reloaded.mining?.heroId === 'elonmusk');
check('mining: balance survives a reload', reloaded !== null && reloaded.bwarBalance > 0);

const switched = runtime.miningService.start(reloaded ?? profile, 'gracychen', NOW + MINING_DURATION_MS + 1);
check('mining: changing hero starts a new session', switched.ok && switched.profile.mining?.heroId === 'gracychen');
check('mining: only one hero remains active', switched.ok && switched.profile.mining?.heroId !== 'elonmusk');

if (failures.length > 0) {
  console.error(`\n${failures.length} mining check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} mining checks passed.`);
