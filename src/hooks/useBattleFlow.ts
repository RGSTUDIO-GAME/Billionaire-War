import { useEffect } from 'react';
import { EXECUTION_BEAT_MS, ROUND_SUMMARY_MS } from '../data/balance';
import { audio } from '../audio/audioManager';
import { BATTLE_MUSIC, playEventCue } from '../presentation/audioEvents';
import { buildBattleView } from '../presentation/battleView';
import { eventsForAttack } from '../engine';
import { BATTLE_STATUS } from '../engine/types';
import { useBattleStore } from '../state/battleStore';

/**
 * Drives the battle clock: the 30s selection timer, the 3-2-1-FIGHT countdown
 * and the sequential attack beats.
 *
 * This hook owns TIMING and nothing else. It never reads a rule: the phase it
 * is in, whose turn it is and what each attack did all come from the view
 * model, and the audio comes from the presentation layer. Deleting this hook
 * would make the game slower, never different.
 */
export const useBattleFlow = (): void => {
  const status = useBattleStore((state) => state.battle?.status ?? null);
  const countdown = useBattleStore((state) => state.battle?.countdown ?? null);
  const result = useBattleStore((state) => state.result);
  const winner = useBattleStore((state) => state.winner);
  // Number of attacks that have already resolved in this round.
  const beat = useBattleStore((state) => state.battle?.currentRoundRecord?.attacks.length ?? 0);

  // 30s selection clock.
  useEffect(() => {
    if (status !== BATTLE_STATUS.SELECTION && status !== BATTLE_STATUS.WAITING_FOR_CONFIRM) {
      return undefined;
    }
    const id = window.setInterval(() => useBattleStore.getState().tickSecond(), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // 3 -> 2 -> 1 -> FIGHT. The engine decides which of the two it is.
  useEffect(() => {
    if (countdown === null) return undefined;
    playEventCue(countdown === 0 ? 'FIGHT' : 'COUNTDOWN');
    const id = window.setTimeout(() => useBattleStore.getState().tickCountdown(), 1000);
    return () => window.clearTimeout(id);
  }, [countdown]);

  /**
   * Execution: the attacking fighter swings, then the result of the attack
   * that just resolved is announced. Both are read from the view model, so the
   * whoosh and the impact always match what the engine actually produced.
   */
  useEffect(() => {
    const store = useBattleStore.getState;
    const battle = store().battle;
    if (!battle) return undefined;

    const view = buildBattleView(battle);

    if (view.attacker) {
      playEventCue(view.fighters[view.attacker].event?.type ?? null);
    }

    // The attack that has just resolved is the last one in the round log.
    const landed = view.log[beat - 1];
    if (landed) {
      const events = eventsForAttack(landed);
      playEventCue(events[events.length - 1]?.type ?? null);
    }

    if (view.attacker) {
      // B is never skipped, even when A's attack already reduced B to 0 HP.
      const id = window.setTimeout(
        () => (view.attacker === 'A' ? store().applyPlayerAAttack() : store().applyPlayerBAttack()),
        EXECUTION_BEAT_MS,
      );
      return () => window.clearTimeout(id);
    }

    if (status === BATTLE_STATUS.ROUND_RESULT) {
      const id = window.setTimeout(() => store().finishRound(), ROUND_SUMMARY_MS);
      return () => window.clearTimeout(id);
    }

    return undefined;
    // `beat` changes as each attack lands, so each beat gets its own cue.
  }, [status, beat]);

  // Battle music, for as long as a battle exists.
  const isRunning = status !== null;
  useEffect(() => {
    if (!isRunning) return undefined;
    audio.playMusic(BATTLE_MUSIC);
    return () => audio.stopMusic();
  }, [isRunning]);

  // Result sting.
  useEffect(() => {
    if (!result || !winner) return;
    playEventCue(winner === 'DRAW' ? 'DRAW' : winner === 'A' ? 'VICTORY' : 'DEFEAT');
  }, [result, winner]);
};
