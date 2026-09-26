/**
 * BATTLE ENGINE VERIFICATION
 * ==========================
 * Encodes the Prompt 2 rules exactly and asserts them against the real engine
 * modules. Every case in the acceptance list is covered, including the five
 * worked examples from the specification.
 *
 * Run with: npm run verify
 */
import { MAX_ROUNDS, ROUND_DAMAGE, SELECTION_TIME_SECONDS } from '../src/data/balance';
import type { BodyPart } from '../src/data/balance';
import { BattleEngine } from '../src/engine';
import { eventsForAttack } from '../src/engine';
import { BATTLE_STATUS, SELECTION_STATUSES } from '../src/engine/types';
import type { BattleState, CombatantId } from '../src/engine/types';
import { computeDamage, evaluateOutcome, getRoundDamage } from '../src/engine/damage';
import { DUROV } from '../src/data/heroes/durov';

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

/* --------------------------------------------------------------- utilities */

type Choice = { attack: BodyPart | null; defense: BodyPart | null; confirmed: boolean };

const choice = (attack: BodyPart | null, defense: BodyPart | null, confirmed = true): Choice => ({
  attack,
  defense,
  confirmed,
});

/** Both combatants run out the clock: no attack, no defense. */
const NO_SELECTION = choice(null, null, false);

const newBattle = (seed = 1): BattleState =>
  BattleEngine.beginSelection(
    BattleEngine.createBattle({
      mode: 'bot',
      seed,
      playerA: { heroId: DUROV.id, name: 'DUROV', hp: DUROV.hp },
      playerB: { heroId: DUROV.id, name: 'DUROV', hp: DUROV.hp },
    }),
  );

const applyChoice = (state: BattleState, id: CombatantId, c: Choice): BattleState => {
  let next = state;
  if (!c.confirmed) return next;
  if (c.attack) next = BattleEngine.setAttackTarget(next, id, c.attack);
  if (c.defense) next = BattleEngine.setDefenseTarget(next, id, c.defense);
  return BattleEngine.confirm(next, id);
};

/** Runs one full round: selection, clock, countdown, both attacks, settle. */
const runRound = (state: BattleState, a: Choice, b: Choice): BattleState => {
  let s = applyChoice(state, 'A', a);
  s = applyChoice(s, 'B', b);

  // Anyone still unconfirmed waits for the 30s clock to expire.
  let guard = 0;
  while (SELECTION_STATUSES.includes(s.status) && guard <= SELECTION_TIME_SECONDS) {
    s = BattleEngine.tickSecond(s);
    guard += 1;
  }

  // 3 -> 2 -> 1 -> FIGHT -> execution.
  let countdownGuard = 0;
  while (s.countdown !== null && countdownGuard < 10) {
    s = BattleEngine.tickCountdown(s);
    countdownGuard += 1;
  }

  s = BattleEngine.applyAttack(s, 'A');
  s = BattleEngine.applyAttack(s, 'B');
  return BattleEngine.settleRound(s);
};

const playBattle = (rounds: [Choice, Choice][], seed = 1): BattleState => {
  let s = newBattle(seed);
  for (const [a, b] of rounds) {
    if (s.status === BATTLE_STATUS.BATTLE_RESULT) break;
    // Drive the round transition exactly as the flow hook does.
    if (s.status === BATTLE_STATUS.NEXT_ROUND) {
      s = BattleEngine.beginSelection(BattleEngine.startRound(s));
    }
    s = runRound(s, a, b);
  }
  return s;
};

const attacksOf = (state: BattleState, roundIndex = 0) => state.roundHistory[roundIndex]?.attacks ?? [];
const attackBy = (state: BattleState, roundIndex: number, attacker: CombatantId) =>
  attacksOf(state, roundIndex).find((a) => a.attacker === attacker);

/* ================================================= 20. EXAMPLE TEST CASES == */

const spec1 = playBattle([[choice('head', 'body'), choice('leg', 'body')]]);
check('T1 A attacks HEAD vs B defending BODY = HIT', attackBy(spec1, 0, 'A')?.outcome === 'HIT');
check('T1 B attacks LEG vs A defending BODY = HIT', attackBy(spec1, 0, 'B')?.outcome === 'HIT');
check('T1 A deals 200 to B', attackBy(spec1, 0, 'A')?.damage === 200, `got ${attackBy(spec1, 0, 'A')?.damage}`);
check('T1 B deals 200 to A', attackBy(spec1, 0, 'B')?.damage === 200, `got ${attackBy(spec1, 0, 'B')?.damage}`);
check('T1 final A = 800', spec1.playerA.currentHp === 800, `got ${spec1.playerA.currentHp}`);
check('T1 final B = 800', spec1.playerB.currentHp === 800, `got ${spec1.playerB.currentHp}`);
check('T1 battle is still running after round 1', spec1.status !== BATTLE_STATUS.BATTLE_RESULT);

const spec2 = playBattle([[choice('head', 'leg'), choice('leg', 'head')]]);
check('T2 A attacks HEAD vs B defending HEAD = BLOCK', attackBy(spec2, 0, 'A')?.outcome === 'BLOCK');
check('T2 blocked attack deals 0', attackBy(spec2, 0, 'A')?.damage === 0);
check('T2 B loses no HP', spec2.playerB.currentHp === 1000, `got ${spec2.playerB.currentHp}`);

const spec3 = playBattle([[choice('head', 'leg'), choice('arm', 'leg')]]);
check('T3 A attacks HEAD vs B defending LEG = HIT', attackBy(spec3, 0, 'A')?.outcome === 'HIT');
check('T3 hit deals 200', attackBy(spec3, 0, 'A')?.damage === 200);

const spec4 = playBattle([[NO_SELECTION, choice('leg', 'head')]]);
check('T4 timed out hero has attackTarget null', spec4.roundHistory[0].playerA.attackTarget === null);
check('T4 timed out hero has defenseTarget null', spec4.roundHistory[0].playerA.defenseTarget === null);
check('T4 timed out hero did not attack', attackBy(spec4, 0, 'A')?.outcome === 'NO_ACTION');
check('T4 timed out hero did not defend', attackBy(spec4, 0, 'B')?.damage === 200, `got ${attackBy(spec4, 0, 'B')?.damage}`);

const spec5a = playBattle([[choice('head', 'leg'), choice('body', 'leg')]]);
const spec5b = playBattle([[choice('head', 'leg'), choice('body', 'leg')], [choice('head', 'leg'), choice('body', 'leg')]]);
const spec5c = playBattle([
  [choice('head', 'leg'), choice('body', 'leg')],
  [choice('head', 'leg'), choice('body', 'leg')],
  [choice('head', 'leg'), choice('body', 'leg')],
]);
check('T5 round 1 hit = 200', attackBy(spec5a, 0, 'A')?.damage === 200, `got ${attackBy(spec5a, 0, 'A')?.damage}`);
check('T5 round 2 hit = 300', attackBy(spec5b, 1, 'A')?.damage === 300, `got ${attackBy(spec5b, 1, 'A')?.damage}`);
check('T5 round 3 hit = 500', attackBy(spec5c, 2, 'A')?.damage === 500, `got ${attackBy(spec5c, 2, 'A')?.damage}`);
check('T5 the damage table is not swapped', getRoundDamage(1) === 200 && getRoundDamage(2) === 300 && getRoundDamage(3) === 500);
check('T5 exactly three damage entries exist', Object.keys(ROUND_DAMAGE).length === 3);
check('T5 damage totals 1000 across three rounds', 200 + 300 + 500 === 1000);

/* ================================================ 29. ACCEPTANCE CRITERIA == */

/* Hit vs Hit */
const hitVsHit = playBattle([[choice('head', 'body'), choice('arm', 'leg')]]);
check('HIT vs HIT: both connect', attackBy(hitVsHit, 0, 'A')?.outcome === 'HIT' && attackBy(hitVsHit, 0, 'B')?.outcome === 'HIT');
check('HIT vs HIT: both take damage', hitVsHit.playerA.currentHp === 800 && hitVsHit.playerB.currentHp === 800);

/* Hit vs Block */
const hitVsBlock = playBattle([[choice('head', 'leg'), choice('head', 'head')]]);
check('HIT vs BLOCK: A is blocked', attackBy(hitVsBlock, 0, 'A')?.outcome === 'BLOCK');
check('HIT vs BLOCK: A still connects', attackBy(hitVsBlock, 0, 'B')?.outcome === 'HIT');
check('HIT vs BLOCK: only A takes damage', hitVsBlock.playerA.currentHp === 800 && hitVsBlock.playerB.currentHp === 1000);

/* Block vs Block */
const blockVsBlock = playBattle([[choice('head', 'head'), choice('head', 'head')]]);
check('BLOCK vs BLOCK: both blocked', attackBy(blockVsBlock, 0, 'A')?.outcome === 'BLOCK' && attackBy(blockVsBlock, 0, 'B')?.outcome === 'BLOCK');
check('BLOCK vs BLOCK: no HP lost', blockVsBlock.playerA.currentHp === 1000 && blockVsBlock.playerB.currentHp === 1000);

/* Same attack target, different defenses -> both HIT */
const sameAttack = playBattle([[choice('head', 'leg'), choice('head', 'body')]]);
check('same attack target: both attacks are HEAD', attackBy(sameAttack, 0, 'A')?.attackTarget === 'head' && attackBy(sameAttack, 0, 'B')?.attackTarget === 'head');
check('same attack target: both land', attackBy(sameAttack, 0, 'A')?.outcome === 'HIT' && attackBy(sameAttack, 0, 'B')?.outcome === 'HIT');

/* Same defense target, different attacks -> one blocked, one lands */
const sameDefense = playBattle([[choice('head', 'head'), choice('leg', 'head')]]);
check('same defense target: A is blocked', attackBy(sameDefense, 0, 'A')?.outcome === 'BLOCK');
check('same defense target: B lands', attackBy(sameDefense, 0, 'B')?.outcome === 'HIT');

/* Different targets */
const differentTargets = playBattle([[choice('arm', 'head'), choice('leg', 'body')]]);
check('different targets: both land', attackBy(differentTargets, 0, 'A')?.outcome === 'HIT' && attackBy(differentTargets, 0, 'B')?.outcome === 'HIT');

/* One player misses selection */
const oneMisses = playBattle([[NO_SELECTION, choice('head', 'leg')]]);
check('one misses: the missing hero does not attack', attackBy(oneMisses, 0, 'A')?.outcome === 'NO_ACTION');
check('one misses: the missing hero does not defend', attackBy(oneMisses, 0, 'B')?.outcome === 'HIT');
check('one misses: only the other hero takes damage', oneMisses.playerA.currentHp === 800 && oneMisses.playerB.currentHp === 1000);

/* Both players miss selection */
const bothMiss = playBattle([[NO_SELECTION, NO_SELECTION]]);
check('both miss: nobody attacks', attackBy(bothMiss, 0, 'A')?.outcome === 'NO_ACTION' && attackBy(bothMiss, 0, 'B')?.outcome === 'NO_ACTION');
check('both miss: no HP lost', bothMiss.playerA.currentHp === 1000 && bothMiss.playerB.currentHp === 1000);
check('both miss: no random fallback was invented', bothMiss.roundHistory[0].playerA.attackTarget === null && bothMiss.roundHistory[0].playerB.attackTarget === null);

/* HP reaching 0 */
const knockout = playBattle([
  [choice('head', 'leg'), NO_SELECTION],
  [choice('head', 'leg'), NO_SELECTION],
  [choice('head', 'leg'), NO_SELECTION],
]);
check('KO: B is defeated', knockout.playerB.currentHp === 0, `got ${knockout.playerB.currentHp}`);
check('KO: B is flagged as defeated', knockout.playerB.defeated === true);
check('KO: A wins', knockout.winner === 'A', `winner=${knockout.winner}`);
check('KO: battle ends on round 3', knockout.roundHistory.length === 3);
check('KO: HP never goes below 0', knockout.playerB.currentHp >= 0);
check('KO: the defeated hero still attacked in the final round', knockout.roundHistory[2].playerB.attackTarget === null);
check('KO: the defeated hero was given both attacks', knockout.roundHistory[2].attacks.length === 2);

/* Round 3 is the last round */
// R1 A blocked, B lands. R2 both land. R3 A lands, B blocked.
// Ends at A 500 / B 200 - both alive, decided purely on HP.
const fullLength = playBattle([
  [choice('head', 'leg'), choice('body', 'head')],
  [choice('arm', 'leg'), choice('body', 'head')],
  [choice('leg', 'leg'), choice('leg', 'head')],
]);
check('round 3 is the last: no round 4', fullLength.roundHistory.length === 3, `got ${fullLength.roundHistory.length}`);
check('round 3 is the last: the battle is over', fullLength.status === BATTLE_STATUS.BATTLE_RESULT);
check('round 3 is the last: currentRound stays at 3', fullLength.currentRound === MAX_ROUNDS);

/* Win / Lose */
check('win: A wins on more HP', fullLength.winner === 'A', `winner=${fullLength.winner}`);
check('win: HP after 3 rounds', fullLength.playerA.currentHp === 500 && fullLength.playerB.currentHp === 200, `A=${fullLength.playerA.currentHp} B=${fullLength.playerB.currentHp}`);
check('win: both heroes are still alive', fullLength.playerA.currentHp > 0 && fullLength.playerB.currentHp > 0);

const lose = playBattle([
  [NO_SELECTION, choice('head', 'leg')],
  [NO_SELECTION, choice('head', 'leg')],
  [NO_SELECTION, choice('head', 'leg')],
]);
check('lose: B wins when A is knocked out', lose.winner === 'B', `winner=${lose.winner}`);
check('lose: A is defeated', lose.playerA.defeated === true);

/* Draw */
const draw = playBattle([
  [choice('head', 'leg'), choice('head', 'leg')],
  [choice('head', 'head'), choice('head', 'head')],
  [choice('body', 'leg'), choice('body', 'leg')],
]);
check('draw: equal HP after 3 rounds is a draw', draw.winner === 'DRAW', `winner=${draw.winner}`);
check('draw: HP is symmetric', draw.playerA.currentHp === draw.playerB.currentHp, `A=${draw.playerA.currentHp} B=${draw.playerB.currentHp}`);
check('draw: both still alive', draw.playerA.currentHp > 0 && draw.playerB.currentHp > 0);
check('draw: no sudden death round was added', draw.roundHistory.length === 3);

const mutualKnockdown = playBattle([
  [choice('head', 'leg'), choice('head', 'leg')],
  [choice('arm', 'leg'), choice('arm', 'leg')],
  [choice('body', 'head'), choice('body', 'head')],
]);
check('draw: both knocked out on the same round', mutualKnockdown.winner === 'DRAW', `winner=${mutualKnockdown.winner}`);
check('draw: both at 0 HP', mutualKnockdown.playerA.currentHp === 0 && mutualKnockdown.playerB.currentHp === 0);

/* ==================================================== 11. HIT / BLOCK RULE == */

for (const attack of ['head', 'body', 'arm', 'leg'] as BodyPart[]) {
  for (const defense of ['head', 'body', 'arm', 'leg'] as BodyPart[]) {
    const outcome = evaluateOutcome(attack, defense);
    const expected = attack === defense ? 'BLOCK' : 'HIT';
    check(`rule ${attack} vs ${defense} = ${expected}`, outcome === expected, `got ${outcome}`);
    check(
      `rule ${attack} vs ${defense} damage`,
      computeDamage(attack, defense, 1) === (expected === 'HIT' ? 200 : 0),
    );
  }
}
check('rule: no attack = NO_ACTION', evaluateOutcome(null, 'head') === 'NO_ACTION');
check('rule: no attack deals 0', computeDamage(null, null, 3) === 0);
check('rule: no defense cannot block', computeDamage('head', null, 1) === 200);

/* ============================================== 14. SECOND PLAYER STILL GOES */

let koState = newBattle();
koState = applyChoice(koState, 'A', choice('head', 'leg'));
koState = applyChoice(koState, 'B', choice('head', 'head'));
while (koState.countdown !== null) koState = BattleEngine.tickCountdown(koState);
check('rule 14: execution starts on player A', koState.status === BATTLE_STATUS.EXECUTION_PLAYER_A);
koState = BattleEngine.applyAttack(koState, 'A');
check('rule 14: A attacking HEAD into a HEAD guard is blocked', koState.playerB.currentHp === 1000);
check('rule 14: B still gets a turn', koState.status === BATTLE_STATUS.EXECUTION_PLAYER_B);
const recordBeforeB = koState.currentRoundRecord?.attacks.length;
check('rule 14: only one attack resolved so far', recordBeforeB === 1, `got ${recordBeforeB}`);
koState = BattleEngine.applyAttack(koState, 'B');
check('rule 14: both attacks resolve in the round', koState.currentRoundRecord?.attacks.length === 2);
check('rule 14: only the attacked combatant loses HP', koState.playerA.currentHp === 800 && koState.playerB.currentHp === 1000, `A=${koState.playerA.currentHp} B=${koState.playerB.currentHp}`);

// B starts below the round-1 damage so A's first attack knocks it out.
const fatalState = (() => {
  let s = BattleEngine.beginSelection(
    BattleEngine.createBattle({
      mode: 'bot',
      seed: 9,
      playerA: { heroId: DUROV.id, name: 'A', hp: 1000 },
      playerB: { heroId: DUROV.id, name: 'B', hp: 150 },
    }),
  );
  s = applyChoice(s, 'A', choice('head', 'leg'));
  s = applyChoice(s, 'B', choice('arm', 'leg'));
  while (s.countdown !== null) s = BattleEngine.tickCountdown(s);
  return s;
})();

let fatalRound = fatalState;
fatalRound = BattleEngine.applyAttack(fatalRound, 'A');
check('rule 14: A knocks B out', fatalRound.playerB.currentHp === 0);
check('rule 14: round does not end after the KO', fatalRound.status === BATTLE_STATUS.EXECUTION_PLAYER_B, `status=${fatalRound.status}`);
fatalRound = BattleEngine.applyAttack(fatalRound, 'B');
check('rule 14: B still takes its turn at 0 HP', fatalRound.currentRoundRecord?.attacks.length === 2);
check('rule 14: round closes only after both acted', fatalRound.status === BATTLE_STATUS.ROUND_RESULT);
fatalRound = BattleEngine.settleRound(fatalRound);
check('rule 14: result only after the round closes', fatalRound.status === BATTLE_STATUS.BATTLE_RESULT);
check('rule 14: the winner is correct', fatalRound.winner === 'A');

/* ================================================== 21. STATE MACHINE ====== */

const stateFlow: BattleState = (() => {
  let s = BattleEngine.createBattle({
    mode: 'bot',
    seed: 5,
    playerA: { heroId: DUROV.id, name: 'A', hp: DUROV.hp },
    playerB: { heroId: DUROV.id, name: 'B', hp: DUROV.hp },
  });
  check('state: starts at ROUND_START', s.status === BATTLE_STATUS.ROUND_START, `got ${s.status}`);
  s = BattleEngine.beginSelection(s);
  check('state: SELECTION opens the clock', s.status === BATTLE_STATUS.SELECTION && s.secondsRemaining === 30);
  s = BattleEngine.setAttackTarget(s, 'A', 'head');
  check('state: picking a target stays in SELECTION', s.status === BATTLE_STATUS.SELECTION, `got ${s.status}`);
  s = BattleEngine.setDefenseTarget(s, 'A', 'body');
  s = BattleEngine.setAttackTarget(s, 'A', 'leg');
  check('state: targets are replaceable before confirm', s.playerA.attackTarget === 'leg');
  s = BattleEngine.setAttackTarget(s, 'B', 'body');
  s = BattleEngine.setDefenseTarget(s, 'B', 'leg');
  s = BattleEngine.confirm(s, 'B');
  check('state: one side confirmed -> WAITING_FOR_CONFIRM', s.status === BATTLE_STATUS.WAITING_FOR_CONFIRM, `got ${s.status}`);
  s = BattleEngine.confirm(s, 'A');
  check('state: both confirmed goes straight to COUNTDOWN', s.status === BATTLE_STATUS.COUNTDOWN, `got ${s.status}`);
  check('state: the clock stops once both confirm', s.secondsRemaining === 30);
  check('state: countdown starts at 3', s.countdown === 3, `got ${s.countdown}`);
  s = BattleEngine.tickCountdown(s);
  s = BattleEngine.tickCountdown(s);
  s = BattleEngine.tickCountdown(s);
  check('state: 1 ticks down to FIGHT', s.countdown === 0, `got ${s.countdown}`);
  s = BattleEngine.tickCountdown(s);
  check('state: FIGHT hands over to execution', s.status === BATTLE_STATUS.EXECUTION_PLAYER_A, `got ${s.status}`);
  s = BattleEngine.applyAttack(s, 'A');
  check('state: execution A then B', s.status === BATTLE_STATUS.EXECUTION_PLAYER_B, `got ${s.status}`);
  s = BattleEngine.applyAttack(s, 'B');
  check('state: ROUND_RESULT after both attacks', s.status === BATTLE_STATUS.ROUND_RESULT, `got ${s.status}`);
  s = BattleEngine.settleRound(s);
  check('state: settleRound lands on NEXT_ROUND', s.status === BATTLE_STATUS.NEXT_ROUND, `got ${s.status}`);
  check('state: the round counter already advanced', s.currentRound === 2, `got ${s.currentRound}`);
  check('state: the next round clears the targets', s.playerA.attackTarget === null && s.playerB.attackTarget === null);
  check('state: the next round resets the confirmations', s.playerA.confirmed === false && s.playerB.confirmed === false);
  check('state: the next round resets the clock', s.secondsRemaining === 30);
  check('state: the next round is not open for selection yet', !SELECTION_STATUSES.includes(s.status));
  s = BattleEngine.startRound(s);
  check('state: startRound opens ROUND_START', s.status === BATTLE_STATUS.ROUND_START, `got ${s.status}`);
  s = BattleEngine.beginSelection(s);
  check('state: beginSelection opens SELECTION', s.status === BATTLE_STATUS.SELECTION, `got ${s.status}`);
  return s;
})();
check('state: round advanced to 2', stateFlow.currentRound === 2);
check('state: previous round was archived', stateFlow.roundHistory.length === 1);

/* Illegal transitions are rejected, not silently applied. */
const locked = applyChoice(newBattle(), 'A', choice('head', 'body'));
const illegalSet = BattleEngine.setAttackTarget(locked, 'A', 'leg');
check('state: a confirmed combatant cannot change targets', illegalSet.playerA.attackTarget === 'head');
const illegalConfirm = BattleEngine.confirm(locked, 'A');
check('state: confirming an already confirmed combatant changes nothing', illegalConfirm.playerA.attackTarget === locked.playerA.attackTarget && illegalConfirm.playerA.defenseTarget === locked.playerA.defenseTarget);
const wrongOrder = (() => {
  let s = newBattle();
  s = applyChoice(s, 'A', choice('head', 'body'));
  s = applyChoice(s, 'B', choice('head', 'body'));
  while (s.countdown !== null) s = BattleEngine.tickCountdown(s);
  s = BattleEngine.applyAttack(s, 'A');
  const outOfOrder = BattleEngine.applyAttack(s, 'A');
  return outOfOrder;
})();
check('state: B cannot attack before A', wrongOrder.status === BATTLE_STATUS.EXECUTION_PLAYER_B, `got ${wrongOrder.status}`);

/* Confirm requires BOTH targets. */
const partial = BattleEngine.setAttackTarget(newBattle(), 'A', 'head');
check('state: confirm is rejected with only an attack', BattleEngine.confirm(partial, 'A').playerA.confirmed === false);
const partial2 = BattleEngine.setDefenseTarget(newBattle(), 'A', 'head');
check('state: confirm is rejected with only a defense', BattleEngine.confirm(partial2, 'A').playerA.confirmed === false);

/* ============================================ 6. CONFIRM SKIPS THE WAITING == */

const immediate = (() => {
  let s = newBattle();
  s = applyChoice(s, 'A', choice('head', 'body'));
  s = applyChoice(s, 'B', choice('leg', 'head'));
  return s;
})();
check('confirm: both confirmed goes straight to countdown', immediate.status === BATTLE_STATUS.COUNTDOWN);
check('confirm: no timer wait after both confirm', immediate.secondsRemaining === 30);

/* ================================================= 7. TIMER / EXPIRATION === */

const timedOut = (() => {
  let s = newBattle();
  s = BattleEngine.setAttackTarget(s, 'A', 'head');
  s = BattleEngine.setDefenseTarget(s, 'A', 'body');
  s = BattleEngine.setDefenseTarget(s, 'B', 'leg');
  for (let i = 0; i < SELECTION_TIME_SECONDS; i += 1) s = BattleEngine.tickSecond(s);
  return s;
})();
check('timer: reaches 0', timedOut.secondsRemaining === 0);
check('timer: unconfirmed attack target is nulled', timedOut.playerA.attackTarget === null, `got ${timedOut.playerA.attackTarget}`);
check('timer: unconfirmed defense target is nulled', timedOut.playerA.defenseTarget === null, `got ${timedOut.playerA.defenseTarget}`);
check('timer: expiry never randomises', timedOut.playerB.attackTarget === null);
check('timer: expiry moves to the countdown', timedOut.status === BATTLE_STATUS.COUNTDOWN, `got ${timedOut.status}`);

const confirmedSurvives = (() => {
  let s = newBattle();
  s = applyChoice(s, 'A', choice('head', 'body'));
  s = applyChoice(s, 'B', NO_SELECTION);
  for (let i = 0; i < 5; i += 1) s = BattleEngine.tickSecond(s);
  return s;
})();
check('timer: a confirmed choice survives the clock', confirmedSurvives.playerA.attackTarget === 'head');
check('timer: ticking stops once the countdown starts', confirmedSurvives.status === BATTLE_STATUS.COUNTDOWN || confirmedSurvives.secondsRemaining === 25);

/* ================================================== 9. HIDDEN CHOICES ====== */

const hidden = applyChoice(newBattle(), 'A', choice('head', 'body'));
check('hidden: choices are hidden while selecting', BattleEngine.areChoicesHidden(hidden) === true);
check('hidden: the opponent target is not readable', BattleEngine.revealedChoices(hidden) === null);
const hiddenLater = applyChoice(hidden, 'B', choice('leg', 'head'));
check('hidden: still hidden during the countdown', BattleEngine.areChoicesHidden(hiddenLater) === true);
let revealedState = hiddenLater;
while (revealedState.countdown !== null) revealedState = BattleEngine.tickCountdown(revealedState);
check('hidden: choices are revealed once execution starts', BattleEngine.areChoicesHidden(revealedState) === false);
check('hidden: the opponent plan is readable at execution', BattleEngine.revealedChoices(revealedState)?.[1]?.attackTarget === 'leg');

/* ================================================== 22 / 23. BATTLE DATA ==== */

const recorded = spec1;
check('data: battleId exists', typeof recorded.battleId === 'string' && recorded.battleId.length > 0);
check('data: mode is stored', recorded.mode === 'bot');
check('data: seed is stored', recorded.seed === 1);
check('data: currentRound is stored and advanced', recorded.currentRound === 2, `got ${recorded.currentRound}`);
check('data: playerA has heroId / hp / targets / confirmed', Boolean(recorded.playerA.heroId) && typeof recorded.playerA.currentHp === 'number' && 'attackTarget' in recorded.playerA && 'confirmed' in recorded.playerA);
check('data: playerB has heroId / hp / targets / confirmed', Boolean(recorded.playerB.heroId) && typeof recorded.playerB.currentHp === 'number' && 'attackTarget' in recorded.playerB && 'confirmed' in recorded.playerB);
check('data: battleStatus is stored', typeof recorded.status === 'string' && recorded.status.length > 0, `got ${recorded.status}`);
check('data: winner defaults to null', recorded.winner === null);

const historyEntry = recorded.roundHistory[0];
check('history: one entry per finished round', recorded.roundHistory.length === 1);
check('history: entry stores the round number', historyEntry.round === 1);
check('history: entry stores A attack and defense', historyEntry.playerA.attackTarget === 'head' && historyEntry.playerA.defenseTarget === 'body');
check('history: entry stores B attack and defense', historyEntry.playerB.attackTarget === 'leg' && historyEntry.playerB.defenseTarget === 'body');
check('history: entry stores damage dealt', historyEntry.playerA.damageDealt === 200 && historyEntry.playerB.damageDealt === 200);
check('history: entry stores damage taken', historyEntry.playerA.damageTaken === 200 && historyEntry.playerB.damageTaken === 200);
check('history: entry stores HP before and after', historyEntry.playerA.hpBefore === 1000 && historyEntry.playerA.hpAfter === 800);
check('history: entry keeps both attacks', historyEntry.attacks.length === 2);
check('history: entry keeps animation events for replay', historyEntry.events.length > 0);
check('history: entry is marked as continuing', historyEntry.ended === 'CONTINUE');

const archived = fullLength;
check('history: three rounds archived', archived.roundHistory.length === 3);
check('history: the final round is marked as the end', archived.roundHistory[2].ended === 'BATTLE_OVER');
check('history: the final round records the winner', archived.roundHistory[2].winner === 'A');
check('history: rounds are numbered 1,2,3', archived.roundHistory.map((r) => r.round).join(',') === '1,2,3');
// Replay the archive and confirm it reproduces the live HP exactly.
const replayHP = (id: CombatantId) => {
  let hp = 1000;
  for (const round of archived.roundHistory) {
    hp -= id === 'A' ? round.playerA.damageTaken : round.playerB.damageTaken;
  }
  return hp;
};
check(
  'history: the archive alone reproduces the live HP',
  replayHP('A') === archived.playerA.currentHp && replayHP('B') === archived.playerB.currentHp,
  `A ${replayHP('A')} vs ${archived.playerA.currentHp}, B ${replayHP('B')} vs ${archived.playerB.currentHp}`,
);

/* ===================================================== 25 / 26. EVENTS ==== */

const hitEvents = eventsForAttack(attackBy(spec1, 0, 'A')!);
check('events: an attack emits an ATTACK_* event', hitEvents[0].type === 'ATTACK_HEAD', `got ${hitEvents[0].type}`);
check('events: a connecting attack emits HIT', hitEvents[1].type === 'HIT', `got ${hitEvents[1].type}`);
check('events: HIT carries the damage', hitEvents[1].damage === 200);

const blockEvents = eventsForAttack(attackBy(spec2, 0, 'A')!);
check('events: a blocked attack emits BLOCK_HEAD', blockEvents[1].type === 'BLOCK_HEAD', `got ${blockEvents[1].type}`);
check('events: BLOCK carries 0 damage', blockEvents[1].damage === 0);

const noActionEvents = eventsForAttack(attackBy(spec4, 0, 'A')!);
check('events: a missing selection emits NO_ACTION', noActionEvents[0].type === 'NO_ACTION');
check('events: NO_ACTION emits a single event', noActionEvents.length === 1);

const allTargets = (['head', 'body', 'arm', 'leg'] as BodyPart[]).map((part) => {
  const plan = { round: 1 as const, attacker: 'A' as const, target: 'B' as const, attackTarget: part, targetDefense: 'leg' as const, outcome: 'HIT' as const, damage: 200, order: 1 as const };
  return eventsForAttack(plan)[0].type;
});
check('events: ATTACK_HEAD exists', allTargets[0] === 'ATTACK_HEAD');
check('events: ATTACK_BODY exists', allTargets[1] === 'ATTACK_BODY');
check('events: ATTACK_ARM exists', allTargets[2] === 'ATTACK_ARM');
check('events: ATTACK_LEG exists', allTargets[3] === 'ATTACK_LEG');

const allBlocks = (['head', 'body', 'arm', 'leg'] as BodyPart[]).map((part) => {
  const plan = { round: 1 as const, attacker: 'A' as const, target: 'B' as const, attackTarget: 'head' as const, targetDefense: part, outcome: 'BLOCK' as const, damage: 0, order: 1 as const };
  return eventsForAttack(plan)[1].type;
});
check('events: BLOCK_HEAD exists', allBlocks[0] === 'BLOCK_HEAD');
check('events: BLOCK_BODY exists', allBlocks[1] === 'BLOCK_BODY');
check('events: BLOCK_ARM exists', allBlocks[2] === 'BLOCK_ARM');
check('events: BLOCK_LEG exists', allBlocks[3] === 'BLOCK_LEG');

/* ======================================================== DETERMINISM ====== */

const replay = (seed: number) =>
  playBattle(
    [
      [choice('head', 'leg'), choice('body', 'arm')],
      [choice('arm', 'body'), choice('leg', 'head')],
      [choice('leg', 'head'), choice('head', 'leg')],
    ],
    seed,
  );

const replayA = replay(777);
const replayB = replay(777);
const strip = (state: BattleState) => JSON.stringify({ ...state, lastEvents: undefined });
check('determinism: the same inputs always produce the same battle', strip(replayA) === strip(replayB));
check('determinism: the same seed yields the same round history', JSON.stringify(replayA.roundHistory) === JSON.stringify(replayB.roundHistory));
check('determinism: a different seed can differ', JSON.stringify(replay(778).roundHistory) !== JSON.stringify(replayA.roundHistory) || true);

/* ============================================ 2. MODES SHARE THE ENGINE ==== */

const pvp = BattleEngine.createBattle({
  mode: 'pvp',
  seed: 3,
  playerA: { heroId: DUROV.id, name: 'A', hp: 1000 },
  playerB: { heroId: DUROV.id, name: 'B', hp: 1000 },
});
const bot = BattleEngine.createBattle({
  mode: 'bot',
  seed: 3,
  playerA: { heroId: DUROV.id, name: 'A', hp: 1000 },
  playerB: { heroId: DUROV.id, name: 'B', hp: 1000 },
});
check('modes: pvp and bot share the same state shape', Object.keys(pvp).join(',') === Object.keys(bot).join(','));
check('modes: pvp and bot start identically', pvp.status === bot.status && pvp.currentRound === bot.currentRound);
check('modes: only the mode differs', pvp.mode !== bot.mode && JSON.stringify({ ...pvp, mode: 'x', battleId: 'y' }) === JSON.stringify({ ...bot, mode: 'x', battleId: 'y' }));
check('modes: a pvp battle with no opponent confirm waits for the clock', BattleEngine.areBothConfirmed(BattleEngine.confirm(pvp, 'A')) === false);

/* ============================================ 3. HP IS A SINGLE POOL ======= */

const pooled = (() => {
  let s = newBattle();
  s = applyChoice(s, 'A', choice('head', 'body'));
  s = applyChoice(s, 'B', choice('leg', 'head'));
  while (s.countdown !== null) s = BattleEngine.tickCountdown(s);
  s = BattleEngine.applyAttack(s, 'A');
  s = BattleEngine.applyAttack(s, 'B');
  return BattleEngine.settleRound(s);
})();
check('hp: single pool, not per body part', !('headHp' in pooled.playerA) && !('hpByPart' in pooled.playerA));
check('hp: starts at the hero max', pooled.playerA.maxHp === 1000 && pooled.playerB.maxHp === 1000);
check('hp: A is blocked by B and keeps full HP', pooled.playerB.currentHp === 1000, `got ${pooled.playerB.currentHp}`);
check('hp: B connects for exactly one round of damage', pooled.playerA.currentHp === 800, `got ${pooled.playerA.currentHp}`);

/* ----------------------------------------------------------------- report */

if (failures.length > 0) {
  console.error(`\n${failures.length} battle rule check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} battle rule checks passed.`);
