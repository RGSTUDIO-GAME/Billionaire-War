/**
 * PRESENTATION LAYER VERIFICATION
 * ===============================
 * The battle screen draws a read model and decides nothing. This suite drives
 * the real engine into every phase the player can see and asserts the read
 * model mirrors it exactly: round labels, reveal timing, result events, damage
 * totals - plus the architectural rule that no gameplay logic leaked into the
 * presentation or UI code.
 *
 * Run with: npm run verify
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_ROUNDS } from '../src/data/balance';
import type { BodyPart } from '../src/data/balance';
import { DUROV } from '../src/data/heroes/durov';
import { soundForEvent } from '../src/presentation/audioEvents';
import { buildBattleView } from '../src/presentation/battleView';
import { BattleEngine } from '../src/engine';
import { BATTLE_STATUS } from '../src/engine/types';
import type { BattleEventType } from '../src/engine/events';
import type { BattleState, CombatantId } from '../src/engine/types';

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

/* ------------------------------------------------------------------ setup */

type Choice = { atk: BodyPart | null; def: BodyPart | null };

const makeBattle = (playerBhp = 1000): BattleState =>
  BattleEngine.beginSelection(
    BattleEngine.createBattle({
      mode: 'pvp',
      seed: 99,
      playerA: { heroId: DUROV.id, name: 'YOU', hp: 1000 },
      playerB: { heroId: DUROV.id, name: 'ENEMY', hp: playerBhp },
    }),
  );

const choose = (state: BattleState, id: CombatantId, atk: BodyPart | null, def: BodyPart | null): BattleState => {
  let next = state;
  if (atk) next = BattleEngine.setAttackTarget(next, id, atk);
  if (def) next = BattleEngine.setDefenseTarget(next, id, def);
  return next;
};

/** Sets both sides' targets for the round that is currently open. */
const stage = (state: BattleState, a: Choice, b: Choice): BattleState => {
  let next = choose(state, 'A', a.atk, a.def);
  next = choose(next, 'B', b.atk, b.def);
  return next;
};

/** 3 -> 2 -> 1 -> FIGHT. Returns the state at the start of execution. */
const toFight = (state: BattleState): BattleState => {
  let next = BattleEngine.confirm(state, 'A');
  next = BattleEngine.confirm(next, 'B');
  while (next.status === BATTLE_STATUS.COUNTDOWN) next = BattleEngine.tickCountdown(next);
  return next;
};

/** Runs the 30s clock out. Any unconfirmed combatant forfeits both targets. */
const runClockOut = (state: BattleState): BattleState => {
  let next = state;
  while (next.secondsRemaining > 0) next = BattleEngine.tickSecond(next);
  return next;
};

/** Plays one whole round with fixed choices, and settles it. */
const playRound = (state: BattleState, a: Choice, b: Choice): BattleState => {
  let next = stage(state, a, b);
  next = toFight(next);
  next = BattleEngine.applyAttack(next, 'A');
  next = BattleEngine.applyAttack(next, 'B');
  return BattleEngine.settleRound(next);
};

const openNextSelection = (state: BattleState): BattleState => BattleEngine.beginSelection(BattleEngine.startRound(state));

/* ------------------------------------------------------------- round label */

{
  const battle = makeBattle();
  const view = buildBattleView(battle);
  check('view: the round label names round 1 of 3', view.roundLabel === 'ROUND 1 / 3', view.roundLabel);
  check('view: the total is the engine maximum', view.totalRounds === MAX_ROUNDS);
  check('view: no banner before the first round is fought', view.banner === null);
  check('view: no summary before the battle ends', view.summary === null);
  check('view: the selection panel is up', view.showSelection && view.selection.visible);
  check('view: the round counter comes from the engine', view.round === battle.currentRound);
}

/* -------------------------------------------------------- selection gating */

{
  const battle = stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' });
  const view = buildBattleView(battle);
  check('view: one attack plus one defense is complete', view.selection.complete);
  check('view: the picks are read back from the engine', view.selection.attack === 'head' && view.selection.defense === 'leg');
  check('view: the opponent has not locked in', view.selection.opponentLocked === false);
  check('view: nobody is confirmed yet', view.selection.confirmed === false);
  check('view: the clock has not expired', view.selection.expired === false);
}

{
  const battle = choose(makeBattle(), 'A', 'head', null);
  const view = buildBattleView(battle);
  check('view: attack alone is not complete', view.selection.complete === false);
  check('view: the confirm button stays disabled until both are picked', view.selection.complete === false);
}

{
  let battle = BattleEngine.confirm(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' }), 'A');
  battle = BattleEngine.confirm(battle, 'B');
  const view = buildBattleView(battle);
  check('view: both locked in starts the countdown at once', battle.status === BATTLE_STATUS.COUNTDOWN, battle.status);
  check('view: the countdown shows 3', view.countdown === 3, String(view.countdown));
  check('view: the countdown overlay is up', view.showCountdown);
  check('view: the selection panel is gone during the countdown', view.showSelection === false);
  check('view: a confirmed player can no longer edit', view.selection.confirmed);
  check('view: the opponent is reported as locked in', view.selection.opponentLocked);
}

{
  const battle = runClockOut(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' }));
  const view = buildBattleView(battle);
  check('view: an unconfirmed player is flagged as expired', view.selection.expired);
  check('view: the clock really reached zero', battle.secondsRemaining === 0);
  check('view: expiry forfeits the attack target', battle.playerA.attackTarget === null);
  check('view: expiry forfeits the defense target', battle.playerA.defenseTarget === null);
}

/* --------------------------------------------------- opponent choice privacy */

{
  const battle = stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' });
  const view = buildBattleView(battle);
  check('privacy: the enemy attack is hidden during selection', view.fighters.B.attack === null);
  check('privacy: the enemy defense is hidden during selection', view.fighters.B.defense === null);
}

{
  const battle = BattleEngine.confirm(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' }), 'A');
  const countdown = BattleEngine.confirm(battle, 'B');
  const view = buildBattleView(countdown);
  check('privacy: choices stay hidden through the countdown', view.fighters.A.attack === null && view.fighters.B.attack === null);
  check('privacy: neither defense is readable before FIGHT', view.fighters.A.defense === null && view.fighters.B.defense === null);
  check('privacy: the engine has not resolved the plans yet', countdown.currentPlans === null);
}

{
  const fight = toFight(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' }));
  const view = buildBattleView(fight);
  check('privacy: FIGHT reveals both attacks', view.fighters.A.attack === 'head' && view.fighters.B.attack === 'body');
  check('privacy: FIGHT reveals both defenses', view.fighters.A.defense === 'leg' && view.fighters.B.defense === 'arm');
}

/* ------------------------------------------------------------- execution */

{
  const fight = toFight(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' }));
  const view = buildBattleView(fight);
  check('execution: A swings first', view.attacker === 'A', String(view.attacker));
  check('execution: the attacker plays an attack event', view.fighters.A.event?.type === 'ATTACK_HEAD', String(view.fighters.A.event?.type));
  check('execution: the target reacts in the same beat', view.fighters.B.event?.type === 'HIT', String(view.fighters.B.event?.type));
  check('execution: the round log is still empty', view.log.length === 0);
}

{
  const afterA = BattleEngine.applyAttack(
    toFight(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' })),
    'A',
  );
  const view = buildBattleView(afterA);
  check('execution: B is up next', view.attacker === 'B', String(view.attacker));
  check('execution: the next attacker plays its own swing', view.fighters.B.event?.type === 'ATTACK_BODY', String(view.fighters.B.event?.type));
  check('execution: the waiting fighter reacts in the same beat', view.fighters.A.event?.type === 'HIT', String(view.fighters.A.event?.type));
  check('execution: the incoming attack is already known', view.fighters.B.attack === 'body', String(view.fighters.B.attack));
  check('execution: the round log records the first attack', view.log.length === 1);
  check('execution: round 1 damage is 200', view.log[0]?.damage === 200, String(view.log[0]?.damage));
}

{
  const afterB = BattleEngine.applyAttack(
    BattleEngine.applyAttack(toFight(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' })), 'A'),
    'B',
  );
  const view = buildBattleView(afterB);
  check('execution: both attacks are in the log', view.log.length === 2);
  check('execution: both results stay on screen at the round summary', view.fighters.A.event?.type === 'HIT' && view.fighters.B.event?.type === 'HIT',
    `${String(view.fighters.A.event?.type)} / ${String(view.fighters.B.event?.type)}`);
  check('execution: the banner announces the finished round', view.banner?.title === 'ROUND 1 COMPLETE', String(view.banner?.title));
  check('execution: the summary is not available yet', view.summary === null);
}

/* ---------------------------------------------------------------- blocking */

{
  // A hits HEAD while B defends HEAD; B hits LEG while A defends LEG.
  const afterA = BattleEngine.applyAttack(
    toFight(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'leg', def: 'head' })),
    'A',
  );
  const view = buildBattleView(afterA);
  check('block: a defended target blocks', view.log[0]?.outcome === 'BLOCK', String(view.log[0]?.outcome));
  check('block: a blocked attack deals 0 damage', view.log[0]?.damage === 0, String(view.log[0]?.damage));
  check('block: the next attacker still swings its attack', view.fighters.B.event?.type === 'ATTACK_LEG', String(view.fighters.B.event?.type));
}

{
  const afterB = BattleEngine.applyAttack(
    BattleEngine.applyAttack(toFight(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'leg', def: 'head' })), 'A'),
    'B',
  );
  const view = buildBattleView(afterB);
  check('block: a mutual block leaves both HP pools full', view.fighters.A.hp === 1000 && view.fighters.B.hp === 1000);
  check('block: both block events are visible', view.fighters.A.event?.type === 'BLOCK_LEG' && view.fighters.B.event?.type === 'BLOCK_HEAD');
}

/* ---------------------------------------------------------------- timeout */

{
  // The player never confirms: A forfeits both targets, B still acts.
  const timedOut = runClockOut(stage(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' }));
  let battle = toFight(timedOut);
  check('timeout: the round still reaches execution', battle.status === BATTLE_STATUS.EXECUTION_PLAYER_A, battle.status);
  battle = BattleEngine.applyAttack(battle, 'A');
  const view = buildBattleView(battle);
  check('timeout: the player did nothing', view.log[0]?.outcome === 'NO_ACTION', String(view.log[0]?.outcome));
  check('timeout: a skipped attack deals 0 damage', view.log[0]?.damage === 0);
  check('timeout: the sprite is told NO ACTION', view.fighters.B.event?.type === 'NO_ACTION', String(view.fighters.B.event?.type));
  check('timeout: B still gets its turn', view.attacker === 'B', String(view.attacker));
}

/* --------------------------------------------------------------- knockout */

{
  // B starts on 200 HP and A connects for 200 - B is out but still acts.
  let battle = choose(makeBattle(200), 'A', 'head', 'arm');
  battle = choose(battle, 'B', 'leg', 'arm');
  battle = toFight(battle);
  battle = BattleEngine.applyAttack(battle, 'A');
  const ko = buildBattleView(battle);
  check('ko: B is down to 0 HP', battle.playerB.currentHp === 0, String(battle.playerB.currentHp));
  check('ko: B still gets its attack animation', ko.attacker === 'B', String(ko.attacker));
  battle = BattleEngine.applyAttack(battle, 'B');
  const done = buildBattleView(battle);
  check('ko: the round still closes normally', done.status === BATTLE_STATUS.ROUND_RESULT, done.status);
  check('ko: the defeated flag is only set when the round settles', done.fighters.B.defeated === false);
  const settled = buildBattleView(BattleEngine.settleRound(battle));
  check('ko: the KO flag appears once the round is settled', settled.fighters.B.defeated);
  check('ko: the engine ends the battle', settled.status === BATTLE_STATUS.BATTLE_RESULT, settled.status);
  check('ko: A is the winner', settled.summary?.winner === 'A', String(settled.summary?.winner));
}

/* -------------------------------------------------------- round transition */

{
  let battle = playRound(makeBattle(), { atk: 'head', def: 'leg' }, { atk: 'body', def: 'arm' });
  check('transition: the battle moves to the next round', battle.status === BATTLE_STATUS.NEXT_ROUND, battle.status);
  const banner = buildBattleView(battle);
  check('transition: the banner announces the new round', banner.banner?.title === 'ROUND 2 / 3', String(banner.banner?.title));
  check('transition: the round label follows the engine', banner.roundLabel === 'ROUND 2 / 3', banner.roundLabel);
  check('transition: the selection panel is closed for the beat', banner.showSelection === false);

  battle = openNextSelection(battle);
  const reopened = buildBattleView(battle);
  check('transition: selection reopens for the new round', reopened.showSelection);
  check('transition: the last picks are not reused', reopened.selection.attack === null && reopened.selection.defense === null);
  check('transition: the clock is reset to 30', reopened.secondsLeft === 30, String(reopened.secondsLeft));
  check('transition: HP carries over', reopened.fighters.A.hp === 800 && reopened.fighters.B.hp === 800,
    `${reopened.fighters.A.hp} / ${reopened.fighters.B.hp}`);
}

/* -------------------------------------------------------------- full battle */

const playOut = (a: Choice, b: Choice): BattleState => {
  let battle = makeBattle();
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    battle = playRound(battle, a, b);
    if (battle.status === BATTLE_STATUS.BATTLE_RESULT) return battle;
    battle = openNextSelection(battle);
  }
  return battle;
};

{
  // Mirror the picks: every attack is blocked, so the HP pools stay equal.
  const battle = playOut({ atk: 'head', def: 'head' }, { atk: 'head', def: 'head' });
  const view = buildBattleView(battle);
  check('battle: it finishes after exactly 3 rounds', view.summary?.rounds === MAX_ROUNDS, String(view.summary?.rounds));
  check('battle: there is never a round 4', battle.roundHistory.length === MAX_ROUNDS, String(battle.roundHistory.length));
  check('battle: equal HP ends in a draw', view.summary?.winner === 'DRAW', String(view.summary?.winner));
  check('battle: the result overlay is shown', view.showResult);
  const endEvents = battle.currentRoundRecord?.events ?? [];
  check('battle: the engine announces the draw as an event', endEvents.some((event) => event.type === 'DRAW'),
    endEvents.map((event) => event.type).join(','));
}

{
  const battle = playOut({ atk: 'head', def: 'arm' }, { atk: 'leg', def: 'arm' });
  const view = buildBattleView(battle);
  const expectedDealt = battle.roundHistory.reduce((sum, round) => sum + round.playerA.damageDealt, 0);
  const expectedTaken = battle.roundHistory.reduce((sum, round) => sum + round.playerA.damageTaken, 0);
  check('summary: damage dealt matches the round history', view.summary?.playerA.damageDealt === expectedDealt, `${String(view.summary?.playerA.damageDealt)} vs ${expectedDealt}`);
  check('summary: damage taken matches the round history', view.summary?.playerA.damageTaken === expectedTaken, `${String(view.summary?.playerA.damageTaken)} vs ${expectedTaken}`);
  check('summary: the totals are non-zero in a real fight', expectedDealt > 0 && expectedTaken > 0);
  check('summary: the winner is reported', view.summary?.winner !== null);
  check('summary: both final HP pools are reported', view.summary?.playerA.hp === battle.playerA.currentHp && view.summary?.playerB.hp === battle.playerB.currentHp);
}

/* -------------------------------------------------------------- audio cues */

{
  check('audio: the countdown has a sound', soundForEvent('COUNTDOWN') !== null);
  check('audio: FIGHT has a sound', soundForEvent('FIGHT') !== null);
  check('audio: a hit has a sound', soundForEvent('HIT') !== null);
  check('audio: a block has a sound', soundForEvent('BLOCK') !== null);
  const attackParts: BattleEventType[] = ['ATTACK_HEAD', 'ATTACK_BODY', 'ATTACK_ARM', 'ATTACK_LEG'];
  const blockParts: BattleEventType[] = ['BLOCK_HEAD', 'BLOCK_BODY', 'BLOCK_ARM', 'BLOCK_LEG'];
  check('audio: every attack part has a sound', attackParts.every((type) => soundForEvent(type) !== null));
  check('audio: every blocked part has a sound', blockParts.every((type) => soundForEvent(type) !== null));
  check('audio: a timeout has a sound', soundForEvent('NO_ACTION') !== null);
  check('audio: victory has a sound', soundForEvent('VICTORY') !== null);
  check('audio: defeat has a sound', soundForEvent('DEFEAT') !== null);
  check('audio: a draw has a sound', soundForEvent('DRAW') !== null);
  check('audio: attacks and blocks share one whoosh cue', soundForEvent('ATTACK_HEAD')?.asset === soundForEvent('ATTACK_LEG')?.asset);
  check('audio: a silent-by-design event stays silent', soundForEvent('ROUND_START') === null);
}

/* -------------------------------------------------- architecture guardrails */

{
  const viewSource = stripComments(readSource('src', 'presentation', 'battleView.ts'));
  check('arch: the read model never computes damage', !viewSource.includes('computeDamage'));
  check('arch: the read model never evaluates an outcome', !viewSource.includes('evaluateOutcome'));
  check('arch: the read model never decides the winner', !viewSource.includes('decideWinner'));
  check('arch: the read model never rolls a die', !viewSource.includes('Math.random'));

  const screen = stripComments(readSource('src', 'screens', 'BattleScreen.tsx'));
  check('arch: the screen does not import the engine rules', !screen.includes('BattleEngine'));
  check('arch: the screen does not branch on engine statuses', !screen.includes('BATTLE_STATUS'));
  check('arch: the screen reads the view model', screen.includes('buildBattleView'));

  const panel = stripComments(readSource('src', 'components', 'battle', 'SelectionPanel.tsx'));
  check('arch: the selection panel asks no engine questions', !panel.includes('BattleEngine'));

  const flow = stripComments(readSource('src', 'hooks', 'useBattleFlow.ts'));
  check('arch: the flow hook names no sound file', !flow.includes('soundIds'));

  const audioLayer = stripComments(readSource('src', 'presentation', 'audioEvents.ts'));
  check('arch: the audio layer is the only place sounds are named', audioLayer.includes('soundIds'));
}

/* ----------------------------------------------------------------- report */

if (failures.length > 0) {
  console.error(`\n${failures.length} view check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} presentation layer checks passed.`);
