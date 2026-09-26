/** Public API of the Universal Battle Engine. */
export {
  BattleEngine,
  createBattle,
  confirm,
  decideWinner,
  applyAttack,
  settleRound,
  eventsForAttack,
} from './battle';
export { BATTLE_STATUS, SELECTION_STATUSES } from './types';
export type {
  AttackRecord,
  BattleMode,
  BattleResult,
  BattleState,
  BattleStatus,
  BattleWinner,
  CombatantId,
  CombatantSnapshot,
  CombatantState,
  HitOutcome,
  RoundNumber,
  RoundRecord,
} from './types';
export { getRoundDamage, computeDamage, evaluateOutcome } from './damage';
export { planRound, EXECUTION_ORDER, other } from './round';
export { ALL_EVENT_TYPES } from './events';
export type { BattleEvent, BattleEventType } from './events';
export { isDebugEnabled, setDebugEnabled } from './debug';
