import { useEffect } from 'react';
import { settleBattleReward } from '../rewards/settleBattleReward';
import { usePlayerStore } from '../state/playerStore';

/**
 * Fires the reward the moment a battle is finished, and clears the previous
 * payout as soon as a new battle starts.
 *
 * Timing only. Whether a battle may pay out, and for how much, is decided by
 * the Battle Engine and the Reward Engine respectively.
 */
export const useBattleReward = (battleId: string | null, battleFinished: boolean): void => {
  useEffect(() => {
    if (battleFinished) {
      settleBattleReward();
      return;
    }
    // A new battle must never inherit the previous battle's reward.
    usePlayerStore.getState().clearLastReward();
  }, [battleId, battleFinished]);
};
