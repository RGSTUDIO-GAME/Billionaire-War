import { useBattleStore } from '../state/battleStore';
import { usePlayerStore } from '../state/playerStore';
import { runtime } from '../state/runtime';
import type { BattleState } from '../engine/types';
import type { RewardConfig, RewardOutcome } from './types';

/**
 * REWARD COORDINATOR
 * ==================
 * The single entry point the UI calls when a battle finishes.
 *
 *   BATTLE_RESULT -> Reward Service -> $GOLD -> ledger -> battle history
 *
 * The service pays and writes; this adapter then re-reads the save so the
 * player store shows the balance that was actually written. The card can only
 * ever display what the ledger holds.
 *
 * It is safe to call twice: the second call resolves to ALREADY_SETTLED and
 * moves nothing. It refuses anything that is not a finished battle, so a
 * reload mid-battle can never pay out.
 *
 * `config` exists only so a check can inject different amounts and prove the
 * payout still comes from configuration. The game never passes it.
 */
export const settleBattleReward = (
  battle: BattleState | null = useBattleStore.getState().battle,
  now: number = Date.now(),
  config?: RewardConfig,
): RewardOutcome | null => {
  const outcome = runtime.rewardService.settle(battle, now, { config });
  if (outcome === null) return null;

  usePlayerStore.getState().applyReward(outcome);
  return outcome;
};
