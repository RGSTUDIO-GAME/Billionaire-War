import { useEffect } from 'react';
import { EXECUTION_BEAT_MS, ROUND_BANNER_MS, ROUND_SUMMARY_MS } from '../data/balance';
import { audio } from '../audio/audioManager';
import { BATTLE_MUSIC, playEventCue } from '../presentation/audioEvents';
import { buildBattleView } from '../presentation/battleView';
import { isSelectionPhase, nextFlowStep } from '../presentation/flowPlan';
import type { FlowStep } from '../presentation/flowPlan';
import { useBattleStore } from '../state/battleStore';

/**
 * Drives the battle clock: the 30s selection timer, the 3-2-1-FIGHT countdown
 * and the sequential attack beats.
 *
 * This hook owns TIMING and nothing else. Which transition a phase waits on
 * comes from the flow plan, whose turn it is and what each attack did come
 * from the view model, and the audio comes from the presentation layer.
 * Deleting this hook would make the game slower, never different.
 */

/** How long each beat is held before its transition fires. */
export const STEP_DELAY_MS: Record<FlowStep['kind'], number> = {
  HOLD: 0,
  COUNTDOWN: 1000,
  RESOLVE_ATTACK: EXECUTION_BEAT_MS,
  SETTLE_ROUND: ROUND_SUMMARY_MS,
  OPEN_NEXT_ROUND: ROUND_BANNER_MS,
};

/**
 * Performs a planned step against the store.
 *
 * Exported so the verification suite can drive a whole battle through the same
 * decisions the UI makes, instead of calling transitions by hand.
 */
export const runFlowStep = (step: FlowStep): void => {
  const store = useBattleStore.getState;
  switch (step.kind) {
    case 'COUNTDOWN':
      store().tickCountdown();
      return;
    case 'RESOLVE_ATTACK':
      // B is never skipped, even when A's attack already reduced B to 0 HP.
      if (step.attacker === 'A') store().applyPlayerAAttack();
      else store().applyPlayerBAttack();
      return;
    case 'SETTLE_ROUND':
      store().finishRound();
      return;
    case 'OPEN_NEXT_ROUND':
      // Reopens the pickers for the next round. Without this beat a battle
      // would stop dead after round 1.
      store().openNextRound();
      return;
    default:
      return;
  }
};

export const useBattleFlow = (): void => {
  const status = useBattleStore((state) => state.battle?.status ?? null);
  const countdown = useBattleStore((state) => state.battle?.countdown ?? null);
  const result = useBattleStore((state) => state.result);
  const winner = useBattleStore((state) => state.winner);
  // Number of attacks that have already resolved in this round.
  const beat = useBattleStore((state) => state.battle?.currentRoundRecord?.attacks.length ?? 0);

  // 30s selection clock.
  useEffect(() => {
    if (!isSelectionPhase(status)) return undefined;
    const id = window.setInterval(() => useBattleStore.getState().tickSecond(), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // 3 -> 2 -> 1 -> FIGHT. The engine decides which of the two it is.
  useEffect(() => {
    if (countdown === null) return undefined;
    playEventCue(countdown === 0 ? 'FIGHT' : 'COUNTDOWN');
    const id = window.setTimeout(
      () => runFlowStep(nextFlowStep(useBattleStore.getState().battle?.status ?? null)),
      STEP_DELAY_MS.COUNTDOWN,
    );
    return () => window.clearTimeout(id);
  }, [countdown]);

  /**
   * Every timed beat after the countdown. The plan says what this phase is
   * waiting on; the audio below says what it sounded like. The round log is
   * read from the view model, so the whoosh and the impact always match what
   * the engine actually produced.
   */
  useEffect(() => {
    const current = useBattleStore.getState().battle;
    if (!current) return undefined;

    const view = buildBattleView(current);

    if (view.attacker) {
      playEventCue(view.fighters[view.attacker].event?.type ?? null);
      // The defender reacts in the same beat as the swing, so its impact
      // sounds together with the attack - not one beat later when the attack
      // resolves in the round log.
      const target = view.attacker === 'A' ? view.fighters.B : view.fighters.A;
      playEventCue(target.event?.type ?? null);
    }

    const step = nextFlowStep(view.status);
    // COUNTDOWN belongs to the ticking effect above; selection waits on a
    // person, not a timer.
    if (step.kind === 'HOLD' || step.kind === 'COUNTDOWN') return undefined;

    const id = window.setTimeout(() => runFlowStep(step), STEP_DELAY_MS[step.kind]);
    return () => window.clearTimeout(id);
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
