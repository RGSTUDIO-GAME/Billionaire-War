import type { BodyPart } from '../data/balance';
import type { BattleEvent } from './events';

/**
 * Universal Battle Engine - core types.
 *
 * A combatant is identified as A or B. In every mode A is the local player and
 * B is the opponent. The engine itself is mode-agnostic: PvP and VS BOT use
 * exactly the same state and the same transitions.
 */
export type CombatantId = 'A' | 'B';

export type RoundNumber = 1 | 2 | 3;

export type BattleMode = 'pvp' | 'bot';

/**
 * Outcome of a single attack.
 * - HIT       : the attack connected, full round damage
 * - BLOCK     : the attack hit the defended part, 0 damage
 * - NO_ACTION : the attacker made no selection, nothing happens
 */
export type HitOutcome = 'HIT' | 'BLOCK' | 'NO_ACTION';

export type BattleWinner = CombatantId | 'DRAW' | null;

/**
 * The battle state machine. Exactly one of these is active at a time - the
 * engine never relies on a combination of booleans.
 */
export const BATTLE_STATUS = {
  /** Battle object created, nothing resolved yet. */
  BATTLE_START: 'BATTLE_START',
  /** Round is being set up (targets and confirmations reset). */
  ROUND_START: 'ROUND_START',
  /** Nobody has confirmed yet. The 30s clock is running. */
  SELECTION: 'SELECTION',
  /** One combatant has confirmed and is waiting for the other. */
  WAITING_FOR_CONFIRM: 'WAITING_FOR_CONFIRM',
  /** Both combatants locked in, or the clock ran out. 3 - 2 - 1 - FIGHT. */
  COUNTDOWN: 'COUNTDOWN',
  /** A is attacking. No damage has been applied yet. */
  EXECUTION_PLAYER_A: 'EXECUTION_PLAYER_A',
  /** A's attack has resolved, B is attacking. Runs even if A knocked B out. */
  EXECUTION_PLAYER_B: 'EXECUTION_PLAYER_B',
  /** Both attacks resolved. HP is final for the round. */
  ROUND_RESULT: 'ROUND_RESULT',
  /** Moving on to the next round. */
  NEXT_ROUND: 'NEXT_ROUND',
  /** Terminal. The battle is over. */
  BATTLE_RESULT: 'BATTLE_RESULT',
} as const;

export type BattleStatus = (typeof BATTLE_STATUS)[keyof typeof BATTLE_STATUS];

/** Which statuses accept target selection / confirmation. */
export const SELECTION_STATUSES: readonly BattleStatus[] = [
  BATTLE_STATUS.SELECTION,
  BATTLE_STATUS.WAITING_FOR_CONFIRM,
];

/**
 * One combatant's live battle data.
 *
 * HP is a single pool for the whole hero. HEAD / BODY / ARM / LEG are only
 * attack and defense targets - they never carry their own HP.
 */
export type CombatantState = {
  heroId: string;
  name: string;
  maxHp: number;
  currentHp: number;
  attackTarget: BodyPart | null;
  defenseTarget: BodyPart | null;
  confirmed: boolean;
  /** True once currentHp <= 0. Set when the round is settled, not mid-round. */
  defeated: boolean;
};

/** The full state of one battle. */
export type BattleState = {
  battleId: string;
  mode: BattleMode;
  seed: number;
  status: BattleStatus;
  currentRound: RoundNumber;
  playerA: CombatantState;
  playerB: CombatantState;
  secondsRemaining: number;
  /** 3, 2, 1, 0 - where 0 renders FIGHT. null when not counting down. */
  countdown: number | null;
  /**
   * Both attacks of the current round, resolved when execution starts.
   * The animation only plays these - it never recomputes a result.
   */
  currentPlans: [AttackRecord, AttackRecord] | null;
  /** HP of each combatant when the round began, for the history entry. */
  hpAtRoundStart: { A: number; B: number };
  /** Round currently being fought, appended to roundHistory on settle. */
  currentRoundRecord: RoundRecord | null;
  /** Events produced by the most recent transition, for the animation layer. */
  lastEvents: BattleEvent[];
  /** Every finished round, in order. Replay / stats / quests read this. */
  roundHistory: RoundRecord[];
  winner: BattleWinner;
  result: BattleResult | null;
};

/** Immutable snapshot of a combatant for the round history. */
export type CombatantSnapshot = {
  heroId: string;
  attackTarget: BodyPart | null;
  defenseTarget: BodyPart | null;
  confirmed: boolean;
  hpBefore: number;
  hpAfter: number;
  damageDealt: number;
  damageTaken: number;
};

/** One resolved attack. */
export type AttackRecord = {
  round: RoundNumber;
  attacker: CombatantId;
  target: CombatantId;
  attackTarget: BodyPart | null;
  targetDefense: BodyPart | null;
  outcome: HitOutcome;
  damage: number;
  /** Execution order in this round. Visual only, never an advantage. */
  order: 1 | 2;
};

/** Everything that happened in one round. */
export type RoundRecord = {
  round: RoundNumber;
  playerA: CombatantSnapshot;
  playerB: CombatantSnapshot;
  attacks: AttackRecord[];
  /** Events for this round, in order. Replay / analytics read this. */
  events: BattleEvent[];
  playerAHPAfter: number;
  playerBHPAfter: number;
  ended: 'CONTINUE' | 'BATTLE_OVER';
  winner: BattleWinner;
};

export type BattleResult = {
  winner: BattleWinner;
  playerAHP: number;
  playerBHP: number;
  roundsPlayed: number;
  /** True when a combatant never confirmed in time. */
  timedOut: { A: boolean; B: boolean };
};
