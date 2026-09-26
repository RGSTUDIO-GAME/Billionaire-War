import { create } from 'zustand';
import { MAX_ROUNDS, SELECTION_TIME_SECONDS } from '../data/balance';
import type { BodyPart } from '../data/balance';
import { getHeroById } from '../data/heroes';
import type { Hero } from '../data/heroes';
import { BattleEngine } from '../engine';
import { BATTLE_STATUS } from '../engine/types';
import type { BattleResult, BattleState, BattleWinner, CombatantId } from '../engine/types';
import { decideBotChoice } from '../game/botStrategy';

export type BattleRuntime = {
  status: 'idle' | 'active' | 'finished';
  /** The engine owns all battle data. This store only sequences it. */
  battle: BattleState | null;
  result: BattleResult | null;
  winner: BattleWinner;
};

export type BattleActions = {
  start: (mode: 'pvp' | 'bot', heroA: Hero, heroB: Hero, seed: number) => void;
  selectAttack: (part: BodyPart) => void;
  selectDefense: (part: BodyPart) => void;
  confirmPlayer: () => void;
  tickSecond: () => void;
  tickCountdown: () => void;
  applyPlayerAAttack: () => void;
  applyPlayerBAttack: () => void;
  finishRound: () => void;
  openNextRound: () => void;
  rematch: () => void;
  reset: () => void;
};

/**
 * Every battle gets a fresh id, so a rematch can never inherit the previous
 * battle's reward settlement.
 */
let battleSequence = 0;
const nextBattleId = (seed: number): string => {
  battleSequence += 1;
  return `btl-${battleSequence.toString(36)}-${seed.toString(36)}`;
};

const idleState = (): BattleRuntime => ({
  status: 'idle',
  battle: null,
  result: null,
  winner: null,
});

const setBattle = (battle: BattleState): Partial<BattleRuntime> => ({
  battle,
  status: battle.status === BATTLE_STATUS.BATTLE_RESULT ? 'finished' : 'active',
  result: battle.result,
  winner: battle.winner,
});

/**
 * The bot locks in at the start of every round, in parallel with the player,
 * through exactly the same setAttackTarget / setDefenseTarget / confirm calls
 * a remote PvP opponent would use.
 */
const withBotLocked = (battle: BattleState): BattleState => {
  if (battle.mode !== 'bot') return battle;
  const choice = decideBotChoice('B', battle.seed, battle.currentRound);
  let next = BattleEngine.setAttackTarget(battle, 'B', choice.attackTarget);
  next = BattleEngine.setDefenseTarget(next, 'B', choice.defenseTarget);
  return BattleEngine.confirm(next, 'B');
};

export const useBattleStore = create<BattleRuntime & BattleActions>()((set, get) => ({
  ...idleState(),

  start: (mode, heroA, heroB, seed) => {
    let battle = BattleEngine.createBattle({
      mode,
      seed,
      battleId: nextBattleId(seed),
      playerA: { heroId: heroA.id, name: heroA.name, hp: heroA.hp },
      playerB: { heroId: heroB.id, name: heroB.name, hp: heroB.hp },
    });
    battle = BattleEngine.beginSelection(battle);
    battle = withBotLocked(battle);
    set(idleState());
    set(setBattle(battle));
  },

  selectAttack: (part) => {
    const { battle } = get();
    if (!battle) return;
    set(setBattle(BattleEngine.setAttackTarget(battle, 'A', part)));
  },

  selectDefense: (part) => {
    const { battle } = get();
    if (!battle) return;
    set(setBattle(BattleEngine.setDefenseTarget(battle, 'A', part)));
  },

  confirmPlayer: () => {
    const { battle } = get();
    if (!battle) return;
    set(setBattle(BattleEngine.confirm(battle, 'A')));
  },

  tickSecond: () => {
    const { battle } = get();
    if (!battle) return;
    set(setBattle(BattleEngine.tickSecond(battle)));
  },

  tickCountdown: () => {
    const { battle } = get();
    if (!battle) return;
    set(setBattle(BattleEngine.tickCountdown(battle)));
  },

  applyPlayerAAttack: () => {
    const { battle } = get();
    if (!battle) return;
    set(setBattle(BattleEngine.applyAttack(battle, 'A')));
  },

  applyPlayerBAttack: () => {
    const { battle } = get();
    if (!battle) return;
    set(setBattle(BattleEngine.applyAttack(battle, 'B')));
  },

  /** Closes the round. Lands on NEXT_ROUND or BATTLE_RESULT. */
  finishRound: () => {
    const { battle } = get();
    if (!battle) return;
    set(setBattle(BattleEngine.settleRound(battle)));
  },

  /**
   * Opens the next round for selection. Held back by the flow hook so the
   * "round complete" beat is readable before the player picks again.
   */
  openNextRound: () => {
    const { battle } = get();
    if (!battle || battle.status !== BATTLE_STATUS.NEXT_ROUND) return;
    set(setBattle(withBotLocked(BattleEngine.beginSelection(BattleEngine.startRound(battle)))));
  },

  rematch: () => {
    const { battle } = get();
    if (!battle) return;
    get().start(battle.mode, heroOf(battle, 'A'), heroOf(battle, 'B'), (battle.seed + 1) >>> 0);
  },

  reset: () => set(idleState()),
}));

/** Resolves a combatant's hero from the registry, for a rematch. */
const heroOf = (battle: BattleState, id: CombatantId): Hero => {
  const combatant = id === 'A' ? battle.playerA : battle.playerB;
  const hero = getHeroById(combatant.heroId);
  if (!hero) throw new Error(`Unknown hero in battle: ${combatant.heroId}`);
  return hero;
};

export { MAX_ROUNDS, SELECTION_TIME_SECONDS };
