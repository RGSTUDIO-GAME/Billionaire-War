/**
 * RUNTIME FLOW VERIFICATION
 * =========================
 * Drives the real battle store (the layer the UI talks to) through complete
 * battles. Catches orchestration bugs the pure-engine suite cannot see:
 * phase wiring, the bot's per-round lock, timers, and result detection.
 *
 * Run with: npm run verify
 */
import { MAX_ROUNDS, SELECTION_TIME_SECONDS } from '../src/data/balance';
import type { BodyPart } from '../src/data/balance';
import { DUROV } from '../src/data/heroes/durov';
import { BATTLE_STATUS } from '../src/engine/types';
import type { BattleStatus } from '../src/engine/types';
import { isSelectionPhase, nextFlowStep } from '../src/presentation/flowPlan';
import { runFlowStep } from '../src/hooks/useBattleFlow';
import { useBattleStore } from '../src/state/battleStore';

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

const store = () => useBattleStore.getState();
const battle = () => useBattleStore.getState().battle;

/** Runs the store through one whole round the way the UI timer would. */
const runRound = (attack: BodyPart | null, defense: BodyPart | null, confirm = true): void => {
  const s = store();
  if (attack) s.selectAttack(attack);
  if (defense) s.selectDefense(defense);
  if (confirm) s.confirmPlayer();

  // If anyone is still unconfirmed, let the 30s clock run out.
  let guard = 0;
  while (
    battle() &&
    (battle()!.status === BATTLE_STATUS.SELECTION || battle()!.status === BATTLE_STATUS.WAITING_FOR_CONFIRM) &&
    guard <= SELECTION_TIME_SECONDS
  ) {
    store().tickSecond();
    guard += 1;
  }

  // 3 -> 2 -> 1 -> FIGHT
  for (let i = 0; i < 6; i += 1) store().tickCountdown();

  store().applyPlayerAAttack();
  store().applyPlayerBAttack();
  store().finishRound();
  store().openNextRound();
};

/* ------------------------------------------------------------ battle setup */

store().start('bot', DUROV, DUROV, 4242);
check('store: the battle starts', battle() !== null);
check('store: it opens waiting for the player, bot already locked', battle()?.status === BATTLE_STATUS.WAITING_FOR_CONFIRM, `status=${battle()?.status}`);
check('store: the clock starts at 30', battle()?.secondsRemaining === 30, `got ${battle()?.secondsRemaining}`);
check('store: both heroes start at full HP', battle()?.playerA.currentHp === 1000 && battle()?.playerB.currentHp === 1000);
check('store: the bot locked in immediately', battle()?.playerB.confirmed === true);
check('store: the player has not locked yet', battle()?.playerA.confirmed === false);
check('store: no round has been resolved', battle()?.roundHistory.length === 0);
check('store: a battleId is assigned', typeof battle()?.battleId === 'string' && battle()!.battleId.length > 0);

/* -------------------------------------------------------- selection guards */

store().selectAttack('head');
store().selectDefense('body');
check('store: targets are recorded', battle()?.playerA.attackTarget === 'head' && battle()?.playerA.defenseTarget === 'body');
check('store: picking does not move the battle out of selection', battle()?.status === BATTLE_STATUS.WAITING_FOR_CONFIRM, `status=${battle()?.status}`);

store().selectAttack('leg');
check('store: targets are replaceable before confirm', battle()?.playerA.attackTarget === 'leg');

store().confirmPlayer();
check('store: confirm locks the player', battle()?.playerA.confirmed === true);
check('store: both confirmed goes straight to COUNTDOWN', battle()?.status === BATTLE_STATUS.COUNTDOWN, `status=${battle()?.status}`);
check('store: the countdown starts at 3', battle()?.countdown === 3, `got ${battle()?.countdown}`);

store().selectAttack('arm');
check('store: a locked choice cannot be changed', battle()?.playerA.attackTarget === 'leg', `got ${battle()?.playerA.attackTarget}`);

store().tickSecond();
check('store: the 30s clock is stopped once both confirm', battle()?.countdown === 3, `got ${battle()?.countdown}`);

/* --------------------------------------------------------------- countdown */

store().tickCountdown();
check('store: 3 -> 2', battle()?.countdown === 2, `got ${battle()?.countdown}`);
store().tickCountdown();
check('store: 2 -> 1', battle()?.countdown === 1, `got ${battle()?.countdown}`);
store().tickCountdown();
check('store: 1 -> FIGHT', battle()?.countdown === 0, `got ${battle()?.countdown}`);
check('store: the player cannot act during the countdown', (store().selectAttack('body'), battle()?.playerA.attackTarget === 'leg'));
store().tickCountdown();
check('store: FIGHT hands over to execution', battle()?.status === BATTLE_STATUS.EXECUTION_PLAYER_A, `status=${battle()?.status}`);
check('store: both plans are resolved up front', battle()?.currentPlans !== null);
check('store: choices are revealed at execution', battle()?.currentRoundRecord !== null || battle()?.currentPlans !== null);

/* --------------------------------------------------------------- execution */

store().applyPlayerAAttack();
check('store: A attacks first', battle()?.status === BATTLE_STATUS.EXECUTION_PLAYER_B, `status=${battle()?.status}`);
check('store: only one attack is resolved', battle()?.currentRoundRecord?.attacks.length === 1, `got ${battle()?.currentRoundRecord?.attacks.length}`);
store().applyPlayerBAttack();
check('store: B attacks second', battle()?.status === BATTLE_STATUS.ROUND_RESULT, `status=${battle()?.status}`);
check('store: both attacks are resolved', battle()?.currentRoundRecord?.attacks.length === 2);
store().applyPlayerAAttack();
check('store: a third attack is rejected', battle()?.currentRoundRecord?.attacks.length === 2);
store().finishRound();
check('store: finishRound holds on NEXT_ROUND', battle()?.status === BATTLE_STATUS.NEXT_ROUND, `status=${battle()?.status}`);
check('store: the round counter advanced', battle()?.currentRound === 2, `got ${battle()?.currentRound}`);
store().openNextRound();
check('store: the next round opens for selection', battle()?.status === BATTLE_STATUS.WAITING_FOR_CONFIRM, `status=${battle()?.status}`);
check('store: the round was archived', battle()?.roundHistory.length === 1);
check('store: the next round clears the player targets', battle()?.playerA.attackTarget === null && battle()?.playerA.defenseTarget === null);
check('store: the bot picks fresh targets for the new round', typeof battle()?.playerB.attackTarget === 'string' && typeof battle()?.playerB.defenseTarget === 'string');
check('store: the next round resets the clock', battle()?.secondsRemaining === 30);
check('store: the bot locked in again for the new round', battle()?.playerB.confirmed === true);
check('store: the player is unlocked for the new round', battle()?.playerA.confirmed === false);

/* ---------------------------------------------------------- a full battle */

store().reset();
store().start('bot', DUROV, DUROV, 99);
let rounds = 0;
while (!store().result && rounds < MAX_ROUNDS + 2) {
  rounds += 1;
  runRound('head', 'leg');
}
check('flow: a battle always reaches a result', store().result !== null, `no result after ${rounds} rounds`);
check('flow: at most three rounds are played', battle()?.roundHistory.length === 3, `got ${battle()?.roundHistory.length}`);
check('flow: the store reports finished', store().status === 'finished');
check('flow: the engine is in BATTLE_RESULT', battle()?.status === BATTLE_STATUS.BATTLE_RESULT, `status=${battle()?.status}`);
check('flow: HP never goes negative', (battle()?.playerA.currentHp ?? -1) >= 0 && (battle()?.playerB.currentHp ?? -1) >= 0);
check('flow: the result reports a winner or a draw', store().result?.winner !== undefined);
check('flow: the result round count matches the history', store().result?.roundsPlayed === battle()?.roundHistory.length);

/* ------------------------------------------------------------ timeout path */

store().reset();
store().start('bot', DUROV, DUROV, 7);
runRound('head', 'head', false);
const timedOutRound = battle()?.roundHistory[0];
check('timeout: the unconfirmed player has no attack target', timedOutRound?.playerA.attackTarget === null, `got ${timedOutRound?.playerA.attackTarget}`);
check('timeout: the unconfirmed player has no defense target', timedOutRound?.playerA.defenseTarget === null, `got ${timedOutRound?.playerA.defenseTarget}`);
check('timeout: the unconfirmed player deals no damage', timedOutRound?.playerA.damageDealt === 0, `got ${timedOutRound?.playerA.damageDealt}`);
check('timeout: the round still completed', battle()?.roundHistory.length === 1, `got ${battle()?.roundHistory.length}`);
check('timeout: execution still gave the opponent a turn', timedOutRound?.attacks.length === 2);

/* ---------------------------------------------------------------- rematch */

const seedBefore = battle()?.seed ?? 0;
store().rematch();
check('rematch: same matchup', battle()?.playerA.heroId === DUROV.id && battle()?.playerB.heroId === DUROV.id);
check('rematch: back to round 1', battle()?.currentRound === 1, `got ${battle()?.currentRound}`);
check('rematch: full HP restored', battle()?.playerA.currentHp === 1000 && battle()?.playerB.currentHp === 1000);
check('rematch: history cleared', battle()?.roundHistory.length === 0);
check('rematch: previous result cleared', store().result === null);
check('rematch: a new seed is used', (battle()?.seed ?? 0) !== seedBefore);
check('rematch: status is active again', store().status === 'active');

/* ------------------------------------------------------------- pvp parity */

store().reset();
store().start('pvp', DUROV, DUROV, 11);
check('pvp: the battle starts', battle() !== null);
check('pvp: no bot locks in automatically', battle()?.playerB.confirmed === false, `got ${String(battle()?.playerB.confirmed)}`);
check('pvp: the player can still pick', (store().selectAttack('head'), battle()?.playerA.attackTarget === 'head'));
check('pvp: confirming alone does not start the countdown', battle()?.status !== BATTLE_STATUS.COUNTDOWN, `status=${battle()?.status}`);

/* ------------------------------------------- 1. every phase has an owner */

/**
 * A phase missing from the flow plan stalls the battle: the UI has nothing to
 * schedule, so the screen sits there forever. Round 2 used to disappear for
 * exactly this reason, so every status is now asserted to have an owner.
 */
const TIMED: BattleStatus[] = [
  BATTLE_STATUS.COUNTDOWN,
  BATTLE_STATUS.EXECUTION_PLAYER_A,
  BATTLE_STATUS.EXECUTION_PLAYER_B,
  BATTLE_STATUS.ROUND_RESULT,
  BATTLE_STATUS.NEXT_ROUND,
];

const WAITS_ON_PLAYER: BattleStatus[] = [
  BATTLE_STATUS.BATTLE_START,
  BATTLE_STATUS.ROUND_START,
  BATTLE_STATUS.SELECTION,
  BATTLE_STATUS.WAITING_FOR_CONFIRM,
  BATTLE_STATUS.BATTLE_RESULT,
];

for (const status of TIMED) {
  const step = nextFlowStep(status);
  check(`plan: ${status} schedules a step`, step.kind !== 'HOLD', step.kind);
}
for (const status of WAITS_ON_PLAYER) {
  check(`plan: ${status} waits on the player`, nextFlowStep(status).kind === 'HOLD', nextFlowStep(status).kind);
}
check('plan: the countdown is ticked', nextFlowStep(BATTLE_STATUS.COUNTDOWN).kind === 'COUNTDOWN');
check('plan: A resolves first', nextFlowStep(BATTLE_STATUS.EXECUTION_PLAYER_A).kind === 'RESOLVE_ATTACK');
check('plan: B resolves second', nextFlowStep(BATTLE_STATUS.EXECUTION_PLAYER_B).kind === 'RESOLVE_ATTACK');
check('plan: the round is settled', nextFlowStep(BATTLE_STATUS.ROUND_RESULT).kind === 'SETTLE_ROUND');
check('plan: the next round is opened, or round 2 never happens',
  nextFlowStep(BATTLE_STATUS.NEXT_ROUND).kind === 'OPEN_NEXT_ROUND', nextFlowStep(BATTLE_STATUS.NEXT_ROUND).kind);
check('plan: selection phases are recognised as the player\'s turn',
  isSelectionPhase(BATTLE_STATUS.SELECTION) && isSelectionPhase(BATTLE_STATUS.WAITING_FOR_CONFIRM));
check('plan: a non-selection phase is not', !isSelectionPhase(BATTLE_STATUS.COUNTDOWN) && !isSelectionPhase(null));
check('plan: every engine status has an owner',
  Object.values(BATTLE_STATUS).every((status) => [...TIMED, ...WAITS_ON_PLAYER].includes(status)),
  Object.values(BATTLE_STATUS).filter((status) => ![...TIMED, ...WAITS_ON_PLAYER].includes(status)).join(','));

/* ---------------------------------- 2. a battle driven only by the UI plan */

/**
 * The whole battle, advanced by the flow plan the UI actually uses - no
 * transition is called by hand. This is the test that fails if a phase loses
 * its scheduled step, because the battle simply stops advancing.
 */
store().reset();
store().start('bot', DUROV, DUROV, 31337);

const roundsOfferedSelection = new Set<number>();
const phasesVisited = new Set<string>();
let stalled = false;
let ticks = 0;

while (battle()?.status !== BATTLE_STATUS.BATTLE_RESULT && ticks < 400) {
  ticks += 1;
  const current = battle();
  if (!current) break;
  phasesVisited.add(current.status);

  if (isSelectionPhase(current.status)) {
    roundsOfferedSelection.add(current.currentRound);
    if (current.playerA.attackTarget === null) store().selectAttack('head');
    if (current.playerA.defenseTarget === null) store().selectDefense('leg');
    if (current.playerA.confirmed) store().tickSecond();
    else store().confirmPlayer();
    continue;
  }

  const step = nextFlowStep(current.status);
  if (step.kind === 'HOLD') {
    // BATTLE_START is the only legal stop before the player acts.
    if (current.status !== BATTLE_STATUS.BATTLE_START) stalled = true;
    continue;
  }
  runFlowStep(step);
}

check('ui loop: the battle reaches a result', battle()?.status === BATTLE_STATUS.BATTLE_RESULT, `status=${battle()?.status} after ${ticks} ticks`);
check('ui loop: it never stalls on a phase with no owner', !stalled);
check('ui loop: it finished within a sane number of ticks', ticks < 400, String(ticks));
check('ui loop: round 1 offered the pickers', roundsOfferedSelection.has(1), [...roundsOfferedSelection].join(','));
check('ui loop: round 2 offered the pickers', roundsOfferedSelection.has(2), [...roundsOfferedSelection].join(','));
check('ui loop: round 3 offered the pickers', roundsOfferedSelection.has(3), [...roundsOfferedSelection].join(','));
check('ui loop: it never reaches a round 4', battle()?.currentRound === MAX_ROUNDS, `round=${battle()?.currentRound}`);
check('ui loop: it went through the next-round beat', phasesVisited.has(BATTLE_STATUS.NEXT_ROUND));
check('ui loop: the countdown ran', phasesVisited.has(BATTLE_STATUS.COUNTDOWN));
check('ui loop: both attacks resolved every round', battle()?.roundHistory.every((round) => round.attacks.length === 2) === true);
check('ui loop: a winner was decided', battle()?.winner !== null, String(battle()?.winner));
check('ui loop: the result matches the last round', battle()?.result?.winner === battle()?.winner);

/* ------------------------------------------- 3. the plan drives PvP too */

store().reset();
store().start('pvp', DUROV, DUROV, 24680);

const pvpRounds = new Set<number>();
ticks = 0;
while (battle()?.status !== BATTLE_STATUS.BATTLE_RESULT && ticks < 600) {
  ticks += 1;
  const current = battle();
  if (!current) break;

  if (isSelectionPhase(current.status)) {
    pvpRounds.add(current.currentRound);
    if (current.playerA.attackTarget === null) store().selectAttack('head');
    if (current.playerA.defenseTarget === null) store().selectDefense('leg');
    if (current.playerA.confirmed) store().tickSecond();
    else store().confirmPlayer();
    continue;
  }

  const step = nextFlowStep(current.status);
  if (step.kind === 'HOLD') continue;
  runFlowStep(step);
}

check('ui loop: a pvp battle also reaches a result', battle()?.status === BATTLE_STATUS.BATTLE_RESULT, `status=${battle()?.status}`);
check('ui loop: pvp reached its later rounds too', pvpRounds.has(2) && pvpRounds.has(3), [...pvpRounds].join(','));

/* ----------------------------------------------------------------- report */

if (failures.length > 0) {
  console.error(`\n${failures.length} flow check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} battle flow checks passed.`);
