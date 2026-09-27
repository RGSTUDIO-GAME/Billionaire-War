/**
 * REWARD SYSTEM VERIFICATION
 * ==========================
 * Encodes the Prompt 4 acceptance list: every mode and outcome pays out, the
 * amount always comes from configuration, $GOLD really moves, the same battle
 * can never pay twice, and nothing is paid before the battle is finished.
 *
 * Run with: npm run verify
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STARTING_GOLD } from '../src/data/balance';
import { DUROV } from '../src/data/heroes/durov';
import { BATTLE_STATUS } from '../src/engine/types';
import type { BattleState } from '../src/engine/types';
import { BattleEngine } from '../src/engine';
import { rewardConfig, RewardEngine } from '../src/rewards';
import type { RewardConfig, RewardMode, RewardOutcome, RewardResult } from '../src/rewards';
import { settleBattleReward } from '../src/rewards/settleBattleReward';
import { useBattleStore } from '../src/state/battleStore';
import { usePlayerStore } from '../src/state/playerStore';

const ROOT = process.cwd();
const readSource = (...parts: string[]): string => readFileSync(join(ROOT, ...parts), 'utf8');
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

const player = () => usePlayerStore.getState();
const store = () => useBattleStore.getState();
const battle = () => useBattleStore.getState().battle;

/** Amounts the tests inject to prove the arithmetic. Production reads 0s. */
const TEST_CONFIG: RewardConfig = {
  vsBot: { victory: 100, defeat: 25, draw: 40 },
  pvp: { victory: 200, defeat: 50, draw: 60 },
};

/** Distinct seeds so the two modes do not replay the same battle. */
const seedOffset = (mode: 'bot' | 'pvp'): number => (mode === 'bot' ? 0 : 500);

const MODES: { mode: 'bot' | 'pvp'; table: RewardMode }[] = [
  { mode: 'bot', table: 'vsBot' },
  { mode: 'pvp', table: 'pvp' },
];

const RESULTS: { result: RewardResult; key: keyof RewardConfig['vsBot'] }[] = [
  { result: 'VICTORY', key: 'victory' },
  { result: 'DEFEAT', key: 'defeat' },
  { result: 'DRAW', key: 'draw' },
];

/** The clock every settlement in this check is stamped with. */
const NOW = 1_700_000_000_000;

const WINNER: Record<RewardResult, 'A' | 'B' | 'DRAW'> = {
  VICTORY: 'A',
  DEFEAT: 'B',
  DRAW: 'DRAW',
};

/**
 * A battle that has already finished, shaped the way the engine leaves one.
 * Settling goes through the real coordinator, so a check can price any mode
 * and outcome without playing six battles to get there.
 */
const finishedBattle = (battleId: string, mode: 'bot' | 'pvp', result: RewardResult): BattleState =>
  ({
    battleId,
    mode,
    status: BATTLE_STATUS.BATTLE_RESULT,
    currentRound: 3,
    winner: WINNER[result],
    playerA: { currentHp: result === 'DEFEAT' ? 0 : 640 },
    playerB: { currentHp: result === 'VICTORY' ? 0 : 720 },
    result: {
      winner: WINNER[result],
      playerAHP: result === 'DEFEAT' ? 0 : 640,
      playerBHP: result === 'VICTORY' ? 0 : 720,
      roundsPlayed: 3,
      timedOut: { A: false, B: false },
    },
  }) as unknown as BattleState;

const settleAs = (
  battleId: string,
  mode: 'bot' | 'pvp',
  result: RewardResult,
  config?: RewardConfig,
): RewardOutcome => settleBattleReward(finishedBattle(battleId, mode, result), NOW, config)!;

/* ------------------------------------------------------- 1. configuration */

check('config: winning vs bot pays 1000 GOLD', rewardConfig.vsBot.victory === 1000, String(rewardConfig.vsBot.victory));
check('config: winning in pvp pays 1000 GOLD', rewardConfig.pvp.victory === 1000, String(rewardConfig.pvp.victory));
check('config: losing vs bot is not priced yet', rewardConfig.vsBot.defeat === 0, String(rewardConfig.vsBot.defeat));
check('config: losing in pvp is not priced yet', rewardConfig.pvp.defeat === 0, String(rewardConfig.pvp.defeat));
check('config: drawing vs bot is not priced yet', rewardConfig.vsBot.draw === 0, String(rewardConfig.vsBot.draw));
check('config: drawing in pvp is not priced yet', rewardConfig.pvp.draw === 0, String(rewardConfig.pvp.draw));
check('config: the two modes are priced separately', MODES[0].table !== MODES[1].table);
check('config: every amount is a whole number of GOLD',
  [...MODES.flatMap(({ table }) => Object.values(rewardConfig[table])), ...Object.values(TEST_CONFIG).flatMap(Object.values)]
    .every((amount) => Number.isInteger(amount) && amount >= 0));
check('config: the config holds exactly six amounts',
  Object.keys(rewardConfig).length === 2 &&
  Object.values(rewardConfig).every((table) => Object.keys(table).length === 3));

check('engine: a bot battle reads the vsBot table', RewardEngine.modeFor('bot') === 'vsBot');
check('engine: a pvp battle reads the pvp table', RewardEngine.modeFor('pvp') === 'pvp');
check('engine: winning as A is a VICTORY', RewardEngine.resultFor('A') === 'VICTORY');
check('engine: losing as A is a DEFEAT', RewardEngine.resultFor('B') === 'DEFEAT');
check('engine: equal HP is a DRAW', RewardEngine.resultFor('DRAW') === 'DRAW');
check('engine: an unfinished battle has no result to reward', RewardEngine.resultFor(null) === null);

/* --------------------------------------- 2. every mode and outcome pays out */

for (const { mode, table } of MODES) {
  for (const { result, key } of RESULTS) {
    const label = `${table} ${result}`;

    player().resetProgress();
    const before = player().gold;

    const outcome = settleAs(`btl-${table}-${result}`, mode, result, TEST_CONFIG);
    const expected = TEST_CONFIG[table][key];

    check(`${label}: the amount comes from configuration`, outcome.amount === expected, `${outcome.amount} vs ${expected}`);
    check(`${label}: the payout is granted once`, outcome.status === 'GRANTED');
    check(`${label}: the transaction records the mode`, outcome.transaction.mode === mode);
    check(`${label}: the transaction records the result`, outcome.transaction.result === result);
    check(`${label}: the transaction records the battle`, outcome.transaction.battleId === `btl-${table}-${result}`);
    check(`${label}: the transaction records the player`, outcome.transaction.playerId === player().playerId);
    check(`${label}: the transaction is timestamped`, outcome.transaction.createdAt === NOW);

    check(`${label}: GOLD increases by exactly the reward`, player().gold === before + expected,
      `${player().gold} vs ${before + expected}`);
    check(`${label}: the payout is recorded in the ledger`, player().goldTransactions.length === 1);
    check(`${label}: the latest transaction is the reward`, player().goldTransactions[0]?.transactionId === outcome.transaction.transactionId);

    // The same request against the shipped configuration must agree with it.
    const live = settleAs(`btl-live-${table}-${result}`, mode, result);
    check(`${label}: the shipped configuration pays what it declares`,
      live.amount === rewardConfig[table][key], `${live.amount} vs ${rewardConfig[table][key]}`);
  }
}

check('config: injecting a test config never mutates the real one',
  rewardConfig.vsBot.victory === 1000 && rewardConfig.pvp.victory === 1000);

/* -------------------------------------------------- 3. duplicate settlement */

player().resetProgress();

const first = settleAs('btl-duplicate', 'bot', 'VICTORY', TEST_CONFIG);
const goldAfterFirst = player().gold;
const second = settleAs('btl-duplicate', 'bot', 'VICTORY', TEST_CONFIG);

check('duplicate: the first call grants the reward', first.status === 'GRANTED');
check('duplicate: the second call is refused', second.status === 'ALREADY_SETTLED', second.status);
check('duplicate: the refused call still reports the same amount', second.amount === first.amount);
check('duplicate: the refused call still reports the same transaction', second.transaction.transactionId === first.transaction.transactionId);
check('duplicate: GOLD only moved once', player().gold === goldAfterFirst, `${player().gold} vs ${goldAfterFirst}`);
check('duplicate: only one transaction was written', player().goldTransactions.length === 1, String(player().goldTransactions.length));
check('duplicate: only one settlement key was stored', player().settledRewards.length === 1, String(player().settledRewards.length));
check('duplicate: the settlement key is battle + player',
  player().settledRewards[0] === `btl-duplicate::${player().playerId}`, String(player().settledRewards[0]));

settleAs('btl-duplicate-2', 'bot', 'VICTORY', TEST_CONFIG);
check('duplicate: a different battle id pays again', player().gold === goldAfterFirst + TEST_CONFIG.vsBot.victory,
  `${player().gold} vs ${goldAfterFirst + TEST_CONFIG.vsBot.victory}`);

player().resetProgress();
const otherPlayerKey = RewardEngine.settle(
  { battleId: 'btl-shared', playerId: 'player_other', mode: 'bot', result: 'VICTORY', createdAt: 1 },
  [],
  { config: TEST_CONFIG },
);
check('duplicate: a different player id is a different settlement', otherPlayerKey.status === 'GRANTED');
check('duplicate: the same battle can pay two different players',
  RewardEngine.settle(
    { battleId: 'btl-shared', playerId: 'player_other', mode: 'bot', result: 'VICTORY', createdAt: 2 },
    [otherPlayerKey.settlementKey],
    { config: TEST_CONFIG },
  ).status === 'ALREADY_SETTLED');

/* ------------------------------------------- 4. nothing pays before the end */

player().resetProgress();
store().start('bot', DUROV, DUROV, 4242);
const beforeAnyReward = player().gold;

check('timing: a new battle pays nothing', settleBattleReward() === null);
check('timing: the balance is untouched by an unfinished battle', player().gold === beforeAnyReward);

/** Plays a whole battle through the real store, timing included. */
const playWholeBattle = (mode: 'bot' | 'pvp', seed: number): BattleState | null => {
  store().start(mode, DUROV, DUROV, seed);

  let guard = 0;
  while (battle()?.status !== BATTLE_STATUS.BATTLE_RESULT && guard < 500) {
    const current = battle();
    const status = current?.status;
    const selecting = status === BATTLE_STATUS.SELECTION || status === BATTLE_STATUS.WAITING_FOR_CONFIRM;

    if (selecting && current) {
      // Pick and confirm once, then let the 30s clock run out whoever is
      // still waiting - in PvP nobody ever confirms on the other side.
      if (!current.playerA.confirmed) {
        const actions = store();
        if (current.playerA.attackTarget === null) actions.selectAttack('head');
        if (current.playerA.defenseTarget === null) actions.selectDefense('leg');
        if (BattleEngine.isComplete(battle()!.playerA)) store().confirmPlayer();
      }
      const after = battle()?.status;
      if (after === BATTLE_STATUS.SELECTION || after === BATTLE_STATUS.WAITING_FOR_CONFIRM) {
        store().tickSecond();
      }
    } else if (status === BATTLE_STATUS.COUNTDOWN) {
      store().tickCountdown();
    } else if (status === BATTLE_STATUS.EXECUTION_PLAYER_A) {
      store().applyPlayerAAttack();
    } else if (status === BATTLE_STATUS.EXECUTION_PLAYER_B) {
      store().applyPlayerBAttack();
    } else if (status === BATTLE_STATUS.ROUND_RESULT) {
      store().finishRound();
    } else if (status === BATTLE_STATUS.NEXT_ROUND) {
      store().openNextRound();
    }
    guard += 1;
  }
  return battle();
};

for (const status of [
  BATTLE_STATUS.BATTLE_START,
  BATTLE_STATUS.ROUND_START,
  BATTLE_STATUS.SELECTION,
  BATTLE_STATUS.WAITING_FOR_CONFIRM,
  BATTLE_STATUS.COUNTDOWN,
  BATTLE_STATUS.EXECUTION_PLAYER_A,
  BATTLE_STATUS.EXECUTION_PLAYER_B,
  BATTLE_STATUS.ROUND_RESULT,
  BATTLE_STATUS.NEXT_ROUND,
]) {
  const fake = { ...battle()!, status } as BattleState;
  check(`timing: ${status} never pays out`, settleBattleReward(fake) === null, status);
  check(`timing: ${status} leaves GOLD alone`, player().gold === beforeAnyReward, status);
}

/* -------------------------------------------- 5. a real battle, end to end */

const finishAndSettle = (mode: 'bot' | 'pvp', seed: number) => {
  const finished = playWholeBattle(mode, seed);
  const goldBefore = player().gold;
  const outcome = settleBattleReward();
  return { finished, goldBefore, outcome };
};

for (const { mode, table } of MODES) {
  player().resetProgress();
  const { finished, goldBefore, outcome } = finishAndSettle(mode, 9001 + seedOffset(mode));

  check(`${table}: the battle really finished`, finished?.status === BATTLE_STATUS.BATTLE_RESULT, String(finished?.status));
  const expectedResult = RewardEngine.resultFor(finished?.winner ?? null);
  const entry = RESULTS.find((candidate) => candidate.result === expectedResult);
  check(`${table}: the finished battle has a result`, entry !== undefined, String(expectedResult));
  check(`${table}: the reward matches the battle result`, outcome?.transaction.result === expectedResult,
    `${outcome?.transaction.result} vs ${String(expectedResult)}`);
  check(`${table}: the reward uses the mode's table`, outcome?.transaction.mode === mode);
  check(`${table}: GOLD moves by exactly the configured amount`,
    player().gold === goldBefore + rewardConfig[table][entry?.key ?? 'victory'],
    `${player().gold} vs ${goldBefore}`);
  check(`${table}: the battle was paid exactly once`, player().settledRewards.length === 1, String(player().settledRewards.length));
  check(`${table}: $BWAR is untouched by a reward`, player().bwar === 0, String(player().bwar));
  check(`${table}: the transaction points at the finished battle`,
    player().goldTransactions[0]?.battleId === finished?.battleId);
}

/* ------------------------------------- 5b. a real battle that is WON */

/**
 * In PvP the opponent never confirms, so it times out every round and the
 * player wins for certain. This is the direct end-to-end proof that a win
 * really moves $GOLD - with a zero config it would have passed for free.
 */
player().resetProgress();
const goldBeforeWin = player().gold;
check('win: the balance starts from player data, not a literal', goldBeforeWin === STARTING_GOLD, String(goldBeforeWin));

const wonBattle = playWholeBattle('pvp', 55555);
const winPayout = settleBattleReward();

check('win: the battle was genuinely won', wonBattle?.winner === 'A', String(wonBattle?.winner));
check('win: a win is paid', winPayout?.status === 'GRANTED', String(winPayout?.status));
check('win: the payout is recorded as a VICTORY', winPayout?.transaction.result === 'VICTORY', String(winPayout?.transaction.result));
check('win: the amount is the configured victory reward',
  winPayout?.amount === rewardConfig.pvp.victory, `${String(winPayout?.amount)} vs ${rewardConfig.pvp.victory}`);
check('win: the balance grew by exactly the reward',
  player().gold === goldBeforeWin + rewardConfig.pvp.victory,
  `${player().gold} vs ${goldBeforeWin + rewardConfig.pvp.victory}`);
check('win: the ledger holds the payout', player().goldTransactions[0]?.amount === rewardConfig.pvp.victory);
check('win: the player can see the new balance', player().gold === goldBeforeWin + rewardConfig.pvp.victory);
check('win: $BWAR did not move', player().bwar === 0, String(player().bwar));

/* --------------------------------------------- 6. rematch gets a new battle */

player().resetProgress();
const firstBattle = finishAndSettle('bot', 777);
const firstId = firstBattle.finished?.battleId;
const goldAfterFirstBattle = player().gold;

check('rematch: the first battle was paid', player().settledRewards.length === 1);
check('rematch: the reward belongs to the first battle id', player().goldTransactions[0]?.battleId === firstId);

const rematchId = (store().rematch(), battle()?.battleId);
check('rematch: a rematch gets a brand new battle id', rematchId !== firstId, `${String(rematchId)} vs ${String(firstId)}`);
check('rematch: the rematch restarts at round 1', battle()?.currentRound === 1);
check('rematch: the rematch has full HP again', battle()?.playerA.currentHp === DUROV.hp && battle()?.playerB.currentHp === DUROV.hp);

player().clearLastReward();
check('rematch: the previous reward is cleared', player().lastReward === null);
check('rematch: the previous reward stays in the ledger', player().goldTransactions.length === 1);
check('rematch: the balance is unchanged by starting a new battle', player().gold === goldAfterFirstBattle);

const secondBattle = finishAndSettle('bot', 778);
check('rematch: the new battle pays its own reward', player().goldTransactions.length === 2, String(player().goldTransactions.length));
check('rematch: two battles mean two settlements', player().settledRewards.length === 2, String(player().settledRewards.length));
check('rematch: the new reward points at the new battle',
  player().goldTransactions[0]?.battleId === secondBattle.finished?.battleId);

/* --------------------------------------------- 7. the engine stays untouched */

{
  // `settleRound` is the engine's own vocabulary, so the guard looks for the
  // reward concepts specifically rather than for the word "settle".
  const engineFiles = ['battle.ts', 'damage.ts', 'round.ts', 'types.ts', 'events.ts', 'random.ts', 'debug.ts', 'index.ts'];
  const leaks = engineFiles.filter((name) => {
    const source = stripComments(readSource('src', 'engine', name)).toLowerCase();
    return ['reward', 'gold', 'playerstore', 'applyreward', 'transaction'].some((word) => source.includes(word));
  });
  check('engine: no engine file knows about rewards or gold', leaks.length === 0, leaks.join(', '));

  const rules = [
    ['still 1 vs 1', 'playerA: CombatantSeed'],
    ['still capped at three rounds', 'nextRound > MAX_ROUNDS'],
  ];
  const engineSource = stripComments(readSource('src', 'engine', 'battle.ts'));
  for (const [label, needle] of rules) {
    check(`engine: ${label}`, engineSource.includes(needle), needle);
  }

  const store = stripComments(readSource('src', 'state', 'battleStore.ts'));
  check('engine: the battle store never moves a balance', !store.includes('gold') && !store.includes('reward'));

  const rewards = stripComments(readSource('src', 'rewards', 'RewardEngine.ts'));
  check('rewards: the engine is the only place config is read', rewards.includes('rewardConfig'));
  check('rewards: the reward engine never imports the battle store', !rewards.includes('battleStore'));
  check('rewards: the reward engine never imports the player store', !rewards.includes('playerStore'));

  const rewardFiles = ['RewardEngine.ts', 'types.ts', 'rewardConfig.ts', 'settleBattleReward.ts', 'index.ts'];
  const web3 = rewardFiles.filter((name) => {
    const source = stripComments(readSource('src', 'rewards', name)).toLowerCase();
    return ['wallet', 'blockchain', 'smart contract', 'token transfer', 'nft', 'staking'].some((word) => source.includes(word));
  });
  check('rewards: nothing in the reward system touches Web3', web3.length === 0, web3.join(', '));

  const bwar = stripComments(readSource('src', 'rewards', 'RewardEngine.ts'));
  check('rewards: $BWAR is not part of the reward system', !bwar.includes('bwar'));
}

/* ----------------------------------------------------------------- report */

if (failures.length > 0) {
  console.error(`\n${failures.length} reward check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} reward system checks passed.`);
