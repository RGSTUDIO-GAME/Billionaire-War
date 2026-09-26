import { BATTLE_STATUS } from '../engine/types';
import type { BattleStatus, CombatantId } from '../engine/types';

/**
 * BATTLE FLOW PLAN
 * ================
 * One table: which store transition a battle phase is waiting on.
 *
 * The engine decides WHICH phase a battle is in. This decides what the UI
 * schedules once it is there, so the sequencing lives in a pure function that
 * can be tested exhaustively instead of being spread across timer callbacks.
 *
 * Every status must appear here. A phase that is missing stalls the battle -
 * which is exactly how round 2 used to disappear.
 */
export type FlowStep =
  /** Selection phase: the 30s clock effect owns this one. */
  | { kind: 'COUNTDOWN' }
  | { kind: 'RESOLVE_ATTACK'; attacker: CombatantId }
  | { kind: 'SETTLE_ROUND' }
  | { kind: 'OPEN_NEXT_ROUND' }
  | { kind: 'HOLD' };

export const nextFlowStep = (status: BattleStatus | null): FlowStep => {
  switch (status) {
    case BATTLE_STATUS.COUNTDOWN:
      return { kind: 'COUNTDOWN' };
    case BATTLE_STATUS.EXECUTION_PLAYER_A:
      return { kind: 'RESOLVE_ATTACK', attacker: 'A' };
    case BATTLE_STATUS.EXECUTION_PLAYER_B:
      return { kind: 'RESOLVE_ATTACK', attacker: 'B' };
    case BATTLE_STATUS.ROUND_RESULT:
      return { kind: 'SETTLE_ROUND' };
    // Without this the battle parks in NEXT_ROUND and the next round's
    // pickers never come back.
    case BATTLE_STATUS.NEXT_ROUND:
      return { kind: 'OPEN_NEXT_ROUND' };
    default:
      return { kind: 'HOLD' };
  }
};

/** True when the phase is waiting on the player rather than on a timer. */
export const isSelectionPhase = (status: BattleStatus | null): boolean =>
  status === BATTLE_STATUS.SELECTION || status === BATTLE_STATUS.WAITING_FOR_CONFIRM;
