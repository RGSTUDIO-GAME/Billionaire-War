import { ROUND_DAMAGE } from '../data/balance';
import type { BodyPart } from '../data/balance';
import type { HitOutcome, RoundNumber } from './types';

/**
 * Damage of a successful attack in the given round.
 *
 * Fixed per round. No critical hits, no random variance, no multiplier,
 * no elemental or armour modifier - not on this stage.
 */
export const getRoundDamage = (round: RoundNumber): number => ROUND_DAMAGE[round] ?? 0;

/**
 * The single rule that decides HIT / BLOCK / NO_ACTION.
 *
 * HIT       : the attacker chose a target AND the defender is not defending it
 * BLOCK     : attacker target === defender target
 * NO_ACTION : the attacker made no selection, so nothing happens at all
 */
export const evaluateOutcome = (
  attackTarget: BodyPart | null,
  defenseTarget: BodyPart | null,
): HitOutcome => {
  if (attackTarget === null) return 'NO_ACTION';
  if (defenseTarget !== null && attackTarget === defenseTarget) return 'BLOCK';
  return 'HIT';
};

/** Damage dealt by a single attack. 0 for BLOCK and NO_ACTION. */
export const computeDamage = (
  attackTarget: BodyPart | null,
  defenseTarget: BodyPart | null,
  round: RoundNumber,
): number => (evaluateOutcome(attackTarget, defenseTarget) === 'HIT' ? getRoundDamage(round) : 0);
