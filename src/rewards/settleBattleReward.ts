import { BATTLE_STATUS } from '../engine/types';
import type { BattleState } from '../engine/types';
import { useBattleStore } from '../state/battleStore';
import { usePlayerStore } from '../state/playerStore';
import { RewardEngine } from './RewardEngine';
import type { RewardOutcome } from './types';

/**
 * REWARD COORDINATOR
 * ==================
 * The one place where a finished battle becomes money.
 *
 *   Battle Engine -> BATTLE_RESULT -> Reward Engine -> balance -> ledger
 *
 * It is deliberately the only component that touches both worlds: the engine
 * cannot move a balance, and the player store cannot invent a reward. It
 * refuses to settle anything that is not a finished battle, and it is safe to
 * call twice - the second call resolves to ALREADY_SETTLED and applies nothing.
 */
export const settleBattleReward = (
  battle: BattleState | null = useBattleStore.getState().battle,
  now: number = Date.now(),
): RewardOutcome | null => {
  // A battle only pays out once the engine has produced a result.
  if (!battle || battle.status !== BATTLE_STATUS.BATTLE_RESULT) return null;

  const result = RewardEngine.resultFor(battle.winner);
  if (result === null) return null;

  const player = usePlayerStore.getState();
  const outcome = RewardEngine.settle(
    {
      battleId: battle.battleId,
      playerId: player.playerId,
      mode: battle.mode,
      result,
      createdAt: now,
    },
    player.settledRewards,
  );

  if (outcome.status === 'GRANTED') player.applyReward(outcome);

  return outcome;
};
