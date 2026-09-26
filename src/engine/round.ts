import type { BodyPart } from '../data/balance';
import { computeDamage, evaluateOutcome } from './damage';
import type { BattleEvent } from './events';
import type { AttackRecord, BattleState, CombatantId, CombatantState, RoundRecord } from './types';

/** The other combatant. With only two combatants this is a simple swap. */
export const other = (id: CombatantId): CombatantId => (id === 'A' ? 'B' : 'A');

/**
 * Visual execution order: A first, B second.
 *
 * This is presentation order ONLY. Both attacks were already decided from
 * simultaneous choices, both damages are applied within the same round, and
 * neither combatant gains or loses anything because of this ordering.
 * There is no speed, initiative or first-strike mechanic.
 */
export const EXECUTION_ORDER: readonly CombatantId[] = ['A', 'B'];

/**
 * What a combatant actually does this round.
 *
 * A combatant only acts when it confirmed AND made a complete selection.
 * An unconfirmed, incomplete or expired selection means no attack and no
 * defense - handled here once, for every code path.
 */
export const effectiveChoice = (
  combatant: CombatantState,
): { attackTarget: BodyPart | null; defenseTarget: BodyPart | null } => {
  const complete = combatant.attackTarget !== null && combatant.defenseTarget !== null;
  if (!combatant.confirmed || !complete) {
    return { attackTarget: null, defenseTarget: null };
  }
  return { attackTarget: combatant.attackTarget, defenseTarget: combatant.defenseTarget };
};

export type AttackPlan = AttackRecord;

/**
 * Resolves both attacks of a round up front, from the simultaneous choices.
 *
 * Pure: no HP is touched here. The execution phase then applies each attack
 * in turn so the player can watch them happen.
 */
export const planRound = (state: BattleState): [AttackPlan, AttackPlan] => {
  const round = state.currentRound;
  const choiceA = effectiveChoice(state.playerA);
  const choiceB = effectiveChoice(state.playerB);
  const choices = { A: choiceA, B: choiceB };

  const plans = EXECUTION_ORDER.map((attacker, index) => {
    const target = other(attacker);
    const attackTarget = choices[attacker].attackTarget;
    const targetDefense = choices[target].defenseTarget;

    return {
      round,
      attacker,
      target,
      attackTarget,
      targetDefense,
      outcome: evaluateOutcome(attackTarget, targetDefense),
      damage: computeDamage(attackTarget, targetDefense, round),
      order: (index + 1) as 1 | 2,
    };
  });

  return [plans[0], plans[1]] as [AttackPlan, AttackPlan];
};

/**
 * Snapshot of one combatant for the round history.
 *
 * Both targets are the combatant's OWN effective choices. A combatant that
 * timed out is archived with null targets, which is what replay needs in order
 * to reconstruct the round faithfully.
 */
const snapshot = (
  combatant: CombatantState,
  plan: AttackPlan,
  hpBefore: number,
  hpAfter: number,
) => {
  const choice = effectiveChoice(combatant);
  return {
    heroId: combatant.heroId,
    attackTarget: choice.attackTarget,
    defenseTarget: choice.defenseTarget,
    confirmed: combatant.confirmed,
    hpBefore,
    hpAfter,
    damageDealt: plan.damage,
    damageTaken: 0,
  };
};

/** Builds the round history entry. Damage taken is derived from the other plan. */
export const buildRoundRecord = (
  state: BattleState,
  plans: [AttackPlan, AttackPlan],
  hpBefore: { A: number; B: number },
  hpAfter: { A: number; B: number },
  ended: RoundRecord['ended'],
  winner: RoundRecord['winner'],
  events: BattleEvent[] = [],
): RoundRecord => {
  const planA = plans[0];
  const planB = plans[1];

  const playerA = { ...snapshot(state.playerA, planA, hpBefore.A, hpAfter.A) };
  const playerB = { ...snapshot(state.playerB, planB, hpBefore.B, hpAfter.B) };
  playerA.damageTaken = planB.damage;
  playerB.damageTaken = planA.damage;

  return {
    round: state.currentRound,
    playerA,
    playerB,
    attacks: [planA, planB],
    events,
    playerAHPAfter: hpAfter.A,
    playerBHPAfter: hpAfter.B,
    ended,
    winner,
  };
};
