import { COUNTDOWN_SECONDS, MAX_ROUNDS, SELECTION_TIME_SECONDS } from '../data/balance';
import type { BodyPart } from '../data/balance';
import { logBattle, logRound } from './debug';
import {
  attackEvent,
  battleEndEvent,
  blockEvent,
  generic,
  hitEvent,
  noActionEvent,
} from './events';
import type { BattleEvent } from './events';
import { EXECUTION_ORDER, buildRoundRecord, other, planRound } from './round';
import { BATTLE_STATUS, SELECTION_STATUSES } from './types';
import type {
  AttackRecord,
  BattleMode,
  BattleState,
  BattleStatus,
  BattleWinner,
  CombatantId,
  CombatantState,
  RoundNumber,
  RoundRecord,
} from './types';

/* ------------------------------------------------------------------ setup */

export type CombatantSeed = {
  heroId: string;
  name: string;
  hp: number;
};

export type BattleSeed = {
  battleId?: string;
  mode: BattleMode;
  seed: number;
  playerA: CombatantSeed;
  playerB: CombatantSeed;
};

const buildCombatant = (seed: CombatantSeed): CombatantState => ({
  heroId: seed.heroId,
  name: seed.name,
  maxHp: seed.hp,
  currentHp: seed.hp,
  attackTarget: null,
  defenseTarget: null,
  confirmed: false,
  defeated: false,
});

/**
 * Creates a battle. Identical for PvP and VS BOT - the mode is data, and the
 * bot simply drives the same confirm/lock transitions a remote player would.
 */
export const createBattle = (seed: BattleSeed): BattleState => {
  const state: BattleState = {
    battleId: seed.battleId ?? `btl-${seed.seed.toString(36)}-${seed.mode}`,
    mode: seed.mode,
    seed: seed.seed,
    status: BATTLE_STATUS.BATTLE_START,
    currentRound: 1,
    playerA: buildCombatant(seed.playerA),
    playerB: buildCombatant(seed.playerB),
    secondsRemaining: SELECTION_TIME_SECONDS,
    countdown: null,
    currentPlans: null,
    hpAtRoundStart: { A: seed.playerA.hp, B: seed.playerB.hp },
    currentRoundRecord: null,
    lastEvents: [],
    roundHistory: [],
    winner: null,
    result: null,
  };

  logBattle('created', state);
  return startRound(state);
};

/* ------------------------------------------------------------ round set-up */

/**
 * ROUND_START. Clears every target and confirmation so nobody carries a
 * choice over from the previous round, and resets the 30s clock.
 */
export const startRound = (state: BattleState): BattleState => {
  const reset = (combatant: CombatantState): CombatantState => ({
    ...combatant,
    attackTarget: null,
    defenseTarget: null,
    confirmed: false,
  });

  return {
    ...state,
    status: BATTLE_STATUS.ROUND_START,
    playerA: reset(state.playerA),
    playerB: reset(state.playerB),
    secondsRemaining: SELECTION_TIME_SECONDS,
    countdown: null,
    currentPlans: null,
    currentRoundRecord: null,
    hpAtRoundStart: { A: state.playerA.currentHp, B: state.playerB.currentHp },
    lastEvents: [generic('ROUND_START', state.currentRound)],
  };
};

/** SELECTION. The 30s clock is now running and targets can be chosen. */
export const beginSelection = (state: BattleState): BattleState => {
  if (state.status !== BATTLE_STATUS.ROUND_START) return state;
  return {
    ...state,
    status: BATTLE_STATUS.SELECTION,
    secondsRemaining: SELECTION_TIME_SECONDS,
    lastEvents: [generic('SELECTION_START', state.currentRound)],
  };
};

/* -------------------------------------------------------------- selections */

const canSelect = (state: BattleState, id: CombatantId): boolean =>
  SELECTION_STATUSES.includes(state.status) && !combatantOf(state, id).confirmed;

const combatantOf = (state: BattleState, id: CombatantId): CombatantState =>
  id === 'A' ? state.playerA : state.playerB;

const withCombatant = (
  state: BattleState,
  id: CombatantId,
  patch: Partial<CombatantState>,
): BattleState => ({
  ...state,
  playerA: id === 'A' ? { ...state.playerA, ...patch } : state.playerA,
  playerB: id === 'B' ? { ...state.playerB, ...patch } : state.playerB,
});

/** Both targets must be picked before a combatant can confirm. */
export const isComplete = (combatant: CombatantState): boolean =>
  combatant.attackTarget !== null && combatant.defenseTarget !== null;

/**
 * Picking a target keeps the battle in SELECTION. Targets stay editable right
 * up to the moment a combatant confirms.
 */
export const setAttackTarget = (
  state: BattleState,
  id: CombatantId,
  target: BodyPart,
): BattleState => {
  if (!canSelect(state, id)) return state;
  return withCombatant(state, id, { attackTarget: target });
};

export const setDefenseTarget = (
  state: BattleState,
  id: CombatantId,
  target: BodyPart,
): BattleState => {
  if (!canSelect(state, id)) return state;
  return withCombatant(state, id, { defenseTarget: target });
};

/**
 * Locks a combatant's attack and defense. They cannot be changed afterwards.
 *
 * SELECTION -> WAITING_FOR_CONFIRM as soon as one side is locked in, and
 * straight to COUNTDOWN when both are, without waiting for the clock.
 */
export const confirm = (state: BattleState, id: CombatantId): BattleState => {
  if (!canSelect(state, id)) return state;
  if (!isComplete(combatantOf(state, id))) return state;

  const next = withCombatant(state, id, { confirmed: true });
  const locked: BattleState = {
    ...next,
    status: BATTLE_STATUS.WAITING_FOR_CONFIRM,
    lastEvents: [generic('CONFIRM', state.currentRound, { actor: id })],
  };

  // Both locked in: go straight to the countdown, do not wait for the clock.
  return areBothConfirmed(locked) ? beginCountdown(locked) : locked;
};

export const areBothConfirmed = (state: BattleState): boolean =>
  state.playerA.confirmed && state.playerB.confirmed;

/* ------------------------------------------------------------------- clock */

/** Ticks the 30s selection clock. Returns the same state when not in selection. */
export const tickSecond = (state: BattleState): BattleState => {
  if (!SELECTION_STATUSES.includes(state.status)) return state;

  const secondsRemaining = Math.max(0, state.secondsRemaining - 1);
  if (secondsRemaining > 0) return { ...state, secondsRemaining };

  return beginCountdown(expireUnconfirmed(state));
};

/**
 * Time is up. Any combatant that never confirmed gives up both targets, so the
 * hero neither attacks nor defends this round. Never randomised.
 */
export const expireUnconfirmed = (state: BattleState): BattleState => {
  const expire = (combatant: CombatantState): CombatantState =>
    combatant.confirmed
      ? combatant
      : { ...combatant, attackTarget: null, defenseTarget: null, confirmed: false };

  return {
    ...state,
    secondsRemaining: 0,
    playerA: expire(state.playerA),
    playerB: expire(state.playerB),
    lastEvents: [generic('SELECTION_EXPIRED', state.currentRound)],
  };
};

/* --------------------------------------------------------------- countdown */

/** COUNTDOWN. Both choices are locked and hidden from the opponent. */
export const beginCountdown = (state: BattleState): BattleState => ({
  ...state,
  status: BATTLE_STATUS.COUNTDOWN,
  countdown: COUNTDOWN_SECONDS,
  lastEvents: [generic('COUNTDOWN', state.currentRound)],
});

/** 3 -> 2 -> 1 -> 0, where 0 renders FIGHT, then execution starts. */
export const tickCountdown = (state: BattleState): BattleState => {
  if (state.status !== BATTLE_STATUS.COUNTDOWN || state.countdown === null) return state;

  if (state.countdown > 0) {
    return { ...state, countdown: state.countdown - 1 };
  }

  return startExecution({ ...state, countdown: null });
};

/* --------------------------------------------------------------- execution */

/**
 * Resolves BOTH attacks from the simultaneous choices, then hands control to
 * the animation. Nothing after this point can change a result.
 */
export const startExecution = (state: BattleState): BattleState => {
  if (state.status !== BATTLE_STATUS.COUNTDOWN) return state;

  const plans = planRound(state);
  logBattle('plans resolved', state);
  logRound({ ...state, currentPlans: plans });

  return {
    ...state,
    status: BATTLE_STATUS.EXECUTION_PLAYER_A,
    currentPlans: plans,
    lastEvents: [generic('FIGHT', state.currentRound)],
  };
};

/**
 * Applies one combatant's attack and resolves the visual.
 *
 * A's attack lands -> EXECUTION_PLAYER_B.
 * B's attack lands -> ROUND_RESULT.
 *
 * B is always given the turn, even when A's attack already reduced B to 0 HP.
 * The round only closes once both actions are done.
 */
export const applyAttack = (state: BattleState, attacker: CombatantId): BattleState => {
  const plans = state.currentPlans;
  if (!plans) return state;

  const expected: BattleStatus =
    attacker === 'A' ? BATTLE_STATUS.EXECUTION_PLAYER_A : BATTLE_STATUS.EXECUTION_PLAYER_B;
  if (state.status !== expected) return state;

  const plan = attacker === 'A' ? plans[0] : plans[1];
  const events = eventsForAttack(plan);

  const hpBefore = combatantOf(state, plan.target).currentHp;
  const hpAfter = Math.max(0, hpBefore - plan.damage);

  const attacks = state.currentRoundRecord?.attacks ?? [];
  const next: BattleState = {
    ...state,
    playerA: plan.target === 'A' ? { ...state.playerA, currentHp: hpAfter } : state.playerA,
    playerB: plan.target === 'B' ? { ...state.playerB, currentHp: hpAfter } : state.playerB,
    currentRoundRecord: {
      round: state.currentRound,
      playerA: { ...placeholderSnapshot(state.playerA) },
      playerB: { ...placeholderSnapshot(state.playerB) },
      attacks: [...attacks, plan],
      events: [...(state.currentRoundRecord?.events ?? []), ...events],
      playerAHPAfter: plan.target === 'A' ? hpAfter : state.playerA.currentHp,
      playerBHPAfter: plan.target === 'B' ? hpAfter : state.playerB.currentHp,
      ended: 'CONTINUE',
      winner: null,
    },
    lastEvents: events,
    status: attacker === 'A' ? BATTLE_STATUS.EXECUTION_PLAYER_B : BATTLE_STATUS.ROUND_RESULT,
  };

  logBattle(`${plan.attacker} ${plan.outcome} ${plan.damage}`, next);
  return next;
};

const placeholderSnapshot = (combatant: CombatantState) => ({
  heroId: combatant.heroId,
  attackTarget: combatant.attackTarget,
  defenseTarget: combatant.defenseTarget,
  confirmed: combatant.confirmed,
  hpBefore: combatant.currentHp,
  hpAfter: combatant.currentHp,
  damageDealt: 0,
  damageTaken: 0,
});

/**
 * Events for one resolved attack, in the order they should play.
 * The first entry is what the attacker does, the second is what lands on the
 * target. Replay and animation both read this, so they can never disagree.
 */
export const eventsForAttack = (plan: AttackRecord): BattleEvent[] => {
  const events: BattleEvent[] = [];

  if (plan.attackTarget === null) {
    events.push(noActionEvent(plan.round, plan.attacker));
    return events;
  }

  events.push(attackEvent(plan.round, plan.attacker, plan.target, plan.attackTarget));

  if (plan.outcome === 'BLOCK' && plan.targetDefense !== null) {
    events.push(blockEvent(plan.round, plan.target, plan.attacker, plan.targetDefense));
  } else {
    events.push(hitEvent(plan.round, plan.target, plan.attacker, plan.attackTarget, plan.damage));
  }

  return events;
};

/* ------------------------------------------------------------ round result */

/**
 * Winner rules.
 *  - HP <= 0  -> that hero is defeated
 *  - both out  -> DRAW
 *  - last round with both alive -> higher HP wins, equal HP is a DRAW
 *  - otherwise -> null, the battle continues
 */
export const decideWinner = (state: BattleState): BattleWinner => {
  const a = state.playerA.currentHp;
  const b = state.playerB.currentHp;

  if (a <= 0 && b <= 0) return 'DRAW';
  if (a <= 0) return 'B';
  if (b <= 0) return 'A';

  if (state.currentRound >= MAX_ROUNDS) {
    if (a === b) return 'DRAW';
    return a > b ? 'A' : 'B';
  }

  return null;
};

/**
 * ROUND_RESULT. Closes the round, stores it in the history, then either ends
 * the battle or moves on to the next round.
 */
export const settleRound = (state: BattleState): BattleState => {
  if (state.status !== BATTLE_STATUS.ROUND_RESULT) return state;

  const winner = decideWinner(state);
  const plans = state.currentPlans ?? planRound(state);
  const over = winner !== null;

  const record: RoundRecord = buildRoundRecord(
    state,
    plans,
    state.hpAtRoundStart,
    { A: state.playerA.currentHp, B: state.playerB.currentHp },
    over ? 'BATTLE_OVER' : 'CONTINUE',
    winner,
  );

  // Keep the events produced during execution: replay and analytics need them.
  const archived: RoundRecord = {
    ...record,
    events: state.currentRoundRecord?.events ?? [],
  };

  const withDefeatFlags: BattleState = {
    ...state,
    playerA: { ...state.playerA, defeated: state.playerA.currentHp <= 0 },
    playerB: { ...state.playerB, defeated: state.playerB.currentHp <= 0 },
    currentRoundRecord: archived,
    roundHistory: [...state.roundHistory, archived],
  };

  logRound(withDefeatFlags);
  logBattle(`round ${state.currentRound} settled, winner=${winner ?? 'none'}`, withDefeatFlags);

  if (over) return endBattle(withDefeatFlags, winner);
  return toNextRound(withDefeatFlags);
};

/**
 * NEXT_ROUND. There is no round 4.
 *
 * The battle lands here with the round counter already advanced and both
 * combatants reset, so the UI can hold the "round complete" beat before the
 * next selection opens. `startRound` then moves it to ROUND_START.
 */
export const toNextRound = (state: BattleState): BattleState => {
  const nextRound = (state.currentRound + 1) as RoundNumber;
  if (nextRound > MAX_ROUNDS) return endBattle(state, decideWinner(state));

  const reset = (combatant: CombatantState): CombatantState => ({
    ...combatant,
    attackTarget: null,
    defenseTarget: null,
    confirmed: false,
  });

  return {
    ...state,
    status: BATTLE_STATUS.NEXT_ROUND,
    currentRound: nextRound,
    playerA: reset(state.playerA),
    playerB: reset(state.playerB),
    secondsRemaining: SELECTION_TIME_SECONDS,
    countdown: null,
    currentPlans: null,
    currentRoundRecord: null,
    hpAtRoundStart: { A: state.playerA.currentHp, B: state.playerB.currentHp },
    lastEvents: [generic('ROUND_START', nextRound)],
  };
};

/** BATTLE_RESULT. Terminal. */
export const endBattle = (state: BattleState, winner: BattleWinner): BattleState => {
  const result = {
    winner,
    playerAHP: state.playerA.currentHp,
    playerBHP: state.playerB.currentHp,
    roundsPlayed: state.currentRound,
    timedOut: {
      A: !state.playerA.confirmed,
      B: !state.playerB.confirmed,
    },
  };

  const events = [...(state.currentRoundRecord?.events ?? []), ...battleEndEvent(state.currentRound, winner ?? 'DRAW')];
  const finalised: BattleState = {
    ...state,
    status: BATTLE_STATUS.BATTLE_RESULT,
    playerA: { ...state.playerA, defeated: state.playerA.currentHp <= 0 },
    playerB: { ...state.playerB, defeated: state.playerB.currentHp <= 0 },
    winner,
    result,
    currentRoundRecord: state.currentRoundRecord
      ? { ...state.currentRoundRecord, events, ended: 'BATTLE_OVER', winner }
      : null,
  };

  logBattle(`ended. winner=${winner}`, finalised);
  return finalised;
};

/* ------------------------------------------------------------- inspection */

/** Both choices, revealed. Only valid once execution has started. */
export const revealedChoices = (state: BattleState) => state.currentPlans;

/** The opponent's choices are unreadable until execution begins. */
export const areChoicesHidden = (state: BattleState): boolean =>
  state.status === BATTLE_STATUS.SELECTION ||
  state.status === BATTLE_STATUS.WAITING_FOR_CONFIRM ||
  state.status === BATTLE_STATUS.COUNTDOWN;

export { BATTLE_STATUS, other };

/**
 * BATTLE ENGINE
 * =============
 * The universal entry point. Hero-agnostic and mode-agnostic: DUROV is just
 * the first hero loaded into it, and PvP and VS BOT drive the same functions.
 */
export const BattleEngine = Object.freeze({
  createBattle,
  startRound,
  beginSelection,
  setAttackTarget,
  setDefenseTarget,
  confirm,
  areBothConfirmed,
  tickSecond,
  expireUnconfirmed,
  beginCountdown,
  tickCountdown,
  startExecution,
  applyAttack,
  settleRound,
  toNextRound,
  endBattle,
  decideWinner,
  planRound,
  eventsForAttack,
  revealedChoices,
  areChoicesHidden,
  isComplete,
  statuses: BATTLE_STATUS,
  executionOrder: EXECUTION_ORDER,
});
