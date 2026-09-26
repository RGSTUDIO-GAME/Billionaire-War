import { MAX_ROUNDS } from '../data/balance';
import { eventsForAttack } from '../engine';
import { BATTLE_STATUS } from '../engine/types';
import type { BattleEvent } from '../engine/events';
import type {
  AttackRecord,
  BattleMode,
  BattleResult,
  BattleState,
  BattleStatus,
  CombatantId,
  CombatantState,
} from '../engine/types';

/**
 * BATTLE PRESENTATION LAYER
 * ========================
 * Turns Battle Engine state into exactly what the screen should draw.
 *
 * This is a READ MODEL. It computes no gameplay: no damage, no winner, no
 * block, no HP, no round, no timeout. Every value below is read straight from
 * the engine, and the only derived numbers are display helpers (HP percentage,
 * running damage totals for the result card).
 *
 * Architecture:  ENGINE  ->  EVENTS  ->  PRESENTATION  ->  UI
 */

/* --------------------------------------------------------------- summary */

export type FighterSummary = {
  heroId: string;
  name: string;
  hp: number;
  maxHp: number;
  damageDealt: number;
  damageTaken: number;
};

export type BattleSummary = {
  winner: BattleResult['winner'];
  rounds: number;
  playerA: FighterSummary;
  playerB: FighterSummary;
};

/**
 * Totals for the result card. Aggregated from the round history the engine
 * already archived - the engine is still the only source of truth.
 */
export const summariseBattle = (battle: BattleState): BattleSummary | null => {
  if (battle.status !== BATTLE_STATUS.BATTLE_RESULT) return null;

  const total = (id: CombatantId, field: 'damageDealt' | 'damageTaken') => {
    const key = id === 'A' ? 'playerA' : 'playerB';
    return battle.roundHistory.reduce((sum, round) => sum + round[key][field], 0);
  };

  const fighter = (id: CombatantId): FighterSummary => {
    const combatant = id === 'A' ? battle.playerA : battle.playerB;
    return {
      heroId: combatant.heroId,
      name: combatant.name,
      hp: combatant.currentHp,
      maxHp: combatant.maxHp,
      damageDealt: total(id, 'damageDealt'),
      damageTaken: total(id, 'damageTaken'),
    };
  };

  return {
    winner: battle.winner,
    rounds: battle.roundHistory.length,
    playerA: fighter('A'),
    playerB: fighter('B'),
  };
};

/* ------------------------------------------------------------ selection */

export type SelectionView = {
  /** The local player's live targets. */
  attack: CombatantState['attackTarget'];
  defense: CombatantState['defenseTarget'];
  confirmed: boolean;
  /** Both targets chosen, so CONFIRM is enabled. */
  complete: boolean;
  /** The 30s clock ran out before this player confirmed. */
  expired: boolean;
  /** The opponent has locked in. */
  opponentLocked: boolean;
  /** The selection UI is visible at all. */
  visible: boolean;
};

/* ---------------------------------------------------------------- view */

export type FighterView = {
  id: CombatantId;
  name: string;
  hp: number;
  maxHp: number;
  hpPercent: number;
  defeated: boolean;
  /** Revealed only once execution has started. */
  attack: CombatantState['attackTarget'];
  defense: CombatantState['defenseTarget'];
  /** What is animating on this fighter right now. */
  event: BattleEvent | null;
  attacking: boolean;
};

/** The full-width beat shown between rounds. */
export type RoundBannerView = {
  /** "ROUND 1 COMPLETE" while the round is being summarised. */
  title: string;
  /** What happens next, in one short line. */
  hint: string;
  tone: 'complete' | 'next';
};

export type BattleView = {
  status: BattleStatus;
  mode: BattleMode;
  /** Identity of this battle. Part of the reward settlement key. */
  battleId: string;
  round: number;
  totalRounds: number;
  roundLabel: string;
  roundCompleteLabel: string;
  countdown: number | null;
  secondsLeft: number;
  fighters: Record<CombatantId, FighterView>;
  attacker: CombatantId | null;
  selection: SelectionView;
  /** Both resolved attacks of the round, for the feedback strip. */
  log: AttackRecord[];
  summary: BattleSummary | null;
  showCountdown: boolean;
  /** Non-null exactly between two rounds. */
  banner: RoundBannerView | null;
  showSelection: boolean;
  showResult: boolean;
};

/** Which combatant is visually attacking in each execution state. */
const ATTACKING: Partial<Record<BattleStatus, CombatantId>> = {
  [BATTLE_STATUS.EXECUTION_PLAYER_A]: 'A',
  [BATTLE_STATUS.EXECUTION_PLAYER_B]: 'B',
};

/**
 * The states in which each attack's result stays on screen. A's hit shows
 * while B acts and through the round summary; B's hit shows on the summary.
 */
const RESULT_VISIBLE: Record<1 | 2, readonly BattleStatus[]> = {
  1: [BATTLE_STATUS.EXECUTION_PLAYER_B, BATTLE_STATUS.ROUND_RESULT],
  2: [BATTLE_STATUS.ROUND_RESULT],
};

/**
 * The event animating on a fighter right now.
 *
 * The attacker plays its attack event; the target plays the result event once
 * that attack has resolved. Both are read from the plans the engine resolved
 * before the first animation frame - nothing is decided here.
 */
const eventFor = (battle: BattleState, id: CombatantId): BattleEvent | null => {
  const plans = battle.currentPlans;
  if (!plans) return null;

  const plan = id === 'A' ? plans[0] : plans[1];
  const record = battle.currentRoundRecord;
  const attacker = ATTACKING[battle.status];

  // The attack that has already landed on this fighter. A result stays on
  // screen from the moment it resolves until the round closes, so the last
  // beat of the round does not blink the second hit away.
  const landed = record?.attacks.find(
    (attack) => attack.target === id && RESULT_VISIBLE[attack.order].includes(battle.status),
  );
  if (landed) {
    // ATTACK_* -> HIT / BLOCK_* for a real attack, NO_ACTION for a timeout.
    const events = eventsForAttack(landed);
    return events[events.length - 1] ?? null;
  }

  // This fighter's own attack.
  if (attacker === id) return eventsForAttack(plan)[0] ?? null;

  return null;
};

const fighterView = (battle: BattleState, id: CombatantId): FighterView => {
  const combatant = id === 'A' ? battle.playerA : battle.playerB;
  const plans = battle.currentPlans;
  // The plan this fighter swings, and the plan aimed at them.
  const plan = id === 'A' ? plans?.[0] : plans?.[1];
  const incoming = id === 'A' ? plans?.[1] : plans?.[0];

  return {
    id,
    name: combatant.name,
    hp: combatant.currentHp,
    maxHp: combatant.maxHp,
    hpPercent: combatant.maxHp <= 0 ? 0 : (combatant.currentHp / combatant.maxHp) * 100,
    defeated: combatant.defeated,
    attack: plan ? plan.attackTarget : null,
    // A fighter's OWN defended part rides on the plan aimed at them. Reading it
    // off the resolved plans - rather than off the live combatant, which
    // already holds the opponent's pick during selection - is what keeps a
    // pre-execution choice unreadable.
    defense: incoming ? incoming.targetDefense : null,
    event: eventFor(battle, id),
    attacking: ATTACKING[battle.status] === id,
  };
};

/**
 * The between-round beat. ROUND_RESULT summarises the round that just ended;
 * NEXT_ROUND has already advanced the counter, so its label reads the new one.
 */
const roundBanner = (status: BattleStatus, round: number): RoundBannerView | null => {
  if (status === BATTLE_STATUS.ROUND_RESULT) {
    return {
      title: `ROUND ${round} COMPLETE`,
      hint: 'HP carries over. Next picks are fresh.',
      tone: 'complete',
    };
  }
  if (status === BATTLE_STATUS.NEXT_ROUND) {
    return {
      title: `ROUND ${round} / ${MAX_ROUNDS}`,
      hint: 'Pick a new attack and defense.',
      tone: 'next',
    };
  }
  return null;
};

export const buildBattleView = (battle: BattleState): BattleView => {
  const status = battle.status;
  const inSelection = status === BATTLE_STATUS.SELECTION || status === BATTLE_STATUS.WAITING_FOR_CONFIRM;
  const player = battle.playerA;

  return {
    status,
    mode: battle.mode,
    battleId: battle.battleId,
    round: battle.currentRound,
    totalRounds: MAX_ROUNDS,
    roundLabel: `ROUND ${battle.currentRound} / ${MAX_ROUNDS}`,
    roundCompleteLabel: `ROUND ${battle.currentRound} COMPLETE`,
    countdown: battle.countdown,
    secondsLeft: battle.secondsRemaining,
    fighters: { A: fighterView(battle, 'A'), B: fighterView(battle, 'B') },
    attacker: ATTACKING[status] ?? null,
    selection: {
      attack: player.attackTarget,
      defense: player.defenseTarget,
      confirmed: player.confirmed,
      complete: player.attackTarget !== null && player.defenseTarget !== null,
      expired: battle.secondsRemaining === 0 && !player.confirmed,
      opponentLocked: battle.playerB.confirmed,
      visible: inSelection,
    },
    log: battle.currentRoundRecord?.attacks ?? [],
    summary: summariseBattle(battle),
    showCountdown: status === BATTLE_STATUS.COUNTDOWN,
    banner: roundBanner(status, battle.currentRound),
    showSelection: inSelection,
    showResult: status === BATTLE_STATUS.BATTLE_RESULT,
  };
};
