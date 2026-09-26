import { BODY_PARTS } from '../data/balance';
import type { BodyPart } from '../data/balance';
import { createRng, pickOne } from '../engine/random';
import type { CombatantId } from '../engine/types';

export type BotDifficulty = 'easy' | 'normal';

export type BotChoice = {
  attackTarget: BodyPart;
  defenseTarget: BodyPart;
};

/**
 * Bot decision maker.
 *
 * Deliberately outside the Battle Engine: the engine stays deterministic and
 * pure, while the bot is the only "random" actor. It is fully derived from the
 * battle seed and the round number, so the same battle always replays exactly.
 *
 * The bot cannot see the player's choice - both decisions are simultaneous,
 * exactly like a real opponent. It drives the same confirm/lock transitions a
 * remote player would, so PvP and VS BOT share one engine path.
 */
export const decideBotChoice = (
  id: CombatantId,
  seed: number,
  round: number,
  difficulty: BotDifficulty = 'normal',
): BotChoice => {
  const rng = createRng(seed + round * 7919);
  const attackTarget = pickOne(rng, BODY_PARTS);
  // 'easy' always guards where it strikes - predictable and exploitable.
  // 'normal' guards independently. This is a bot-only tuning knob and never
  // changes the battle rules themselves.
  const defenseTarget = difficulty === 'easy' ? attackTarget : pickOne(rng, BODY_PARTS);

  return { id, attackTarget, defenseTarget } as BotChoice;
};
