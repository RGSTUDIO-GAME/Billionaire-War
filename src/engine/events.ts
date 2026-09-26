import type { BodyPart } from '../data/balance';
import type { CombatantId, HitOutcome, RoundNumber } from './types';

/**
 * Animation events emitted by the Battle Engine.
 *
 * The engine describes WHAT happened; the Animation Controller decides what it
 * looks like. The engine therefore never references a hero, a file name or an
 * asset id, and a new hero can have entirely different art.
 */
export type BattleEventType =
  | 'BATTLE_START'
  | 'ROUND_START'
  | 'SELECTION_START'
  | 'CONFIRM'
  | 'SELECTION_EXPIRED'
  | 'COUNTDOWN'
  | 'FIGHT'
  | 'ATTACK_HEAD'
  | 'ATTACK_BODY'
  | 'ATTACK_ARM'
  | 'ATTACK_LEG'
  | 'BLOCK_HEAD'
  | 'BLOCK_BODY'
  | 'BLOCK_ARM'
  | 'BLOCK_LEG'
  | 'HIT'
  | 'BLOCK'
  | 'NO_ACTION'
  | 'DEFEAT'
  | 'VICTORY'
  | 'DRAW'
  | 'ROUND_END'
  | 'BATTLE_END';

export type BattleEvent = {
  type: BattleEventType;
  round: RoundNumber;
  /** Who caused the event. null for round-level events. */
  actor: CombatantId | null;
  target: CombatantId | null;
  attackTarget: BodyPart | null;
  defenseTarget: BodyPart | null;
  outcome: HitOutcome | null;
  damage: number;
};

const event = (
  type: BattleEventType,
  round: RoundNumber,
  extra: Partial<Omit<BattleEvent, 'type' | 'round'>> = {},
): BattleEvent => ({
  type,
  round,
  actor: null,
  target: null,
  attackTarget: null,
  defenseTarget: null,
  outcome: null,
  damage: 0,
  ...extra,
});

const ATTACK_EVENT: Record<'head' | 'body' | 'arm' | 'leg', BattleEventType> = {
  head: 'ATTACK_HEAD',
  body: 'ATTACK_BODY',
  arm: 'ATTACK_ARM',
  leg: 'ATTACK_LEG',
};

const BLOCK_EVENT: Record<'head' | 'body' | 'arm' | 'leg', BattleEventType> = {
  head: 'BLOCK_HEAD',
  body: 'BLOCK_BODY',
  arm: 'BLOCK_ARM',
  leg: 'BLOCK_LEG',
};

/** ATTACK_HEAD / ATTACK_BODY / ATTACK_ARM / ATTACK_LEG */
export const attackEvent = (
  round: RoundNumber,
  attacker: CombatantId,
  target: CombatantId,
  attackTarget: BodyPart,
): BattleEvent => event(ATTACK_EVENT[attackTarget], round, { actor: attacker, target, attackTarget });

/** BLOCK_HEAD / BLOCK_BODY / BLOCK_ARM / BLOCK_LEG */
export const blockEvent = (
  round: RoundNumber,
  defender: CombatantId,
  attacker: CombatantId,
  defenseTarget: BodyPart,
): BattleEvent => event(BLOCK_EVENT[defenseTarget], round, {
  actor: defender,
  target: attacker,
  attackTarget: null,
  defenseTarget,
  outcome: 'BLOCK',
  damage: 0,
});

export const hitEvent = (
  round: RoundNumber,
  target: CombatantId,
  attacker: CombatantId,
  attackTarget: BodyPart,
  damage: number,
): BattleEvent => event('HIT', round, { actor: attacker, target, attackTarget, outcome: 'HIT', damage });

export const noActionEvent = (round: RoundNumber, actor: CombatantId): BattleEvent =>
  event('NO_ACTION', round, { actor, outcome: 'NO_ACTION' });

export const generic = (
  type: BattleEventType,
  round: RoundNumber,
  extra: Partial<Omit<BattleEvent, 'type' | 'round'>> = {},
): BattleEvent => event(type, round, extra);

export const battleEndEvent = (
  round: RoundNumber,
  winner: CombatantId | 'DRAW',
): BattleEvent[] => {
  const end = generic('BATTLE_END', round);
  if (winner === 'DRAW') return [end, generic('DRAW', round)];
  return [end, generic(winner === 'A' ? 'VICTORY' : 'DEFEAT', round)];
};

/** Every event type, useful for the animation controller and for tests. */
export const ALL_EVENT_TYPES: readonly BattleEventType[] = [
  'BATTLE_START', 'ROUND_START', 'SELECTION_START', 'CONFIRM', 'SELECTION_EXPIRED',
  'COUNTDOWN', 'FIGHT', 'ATTACK_HEAD', 'ATTACK_BODY', 'ATTACK_ARM', 'ATTACK_LEG',
  'BLOCK_HEAD', 'BLOCK_BODY', 'BLOCK_ARM', 'BLOCK_LEG', 'HIT', 'BLOCK', 'NO_ACTION',
  'DEFEAT', 'VICTORY', 'DRAW', 'ROUND_END', 'BATTLE_END',
];
