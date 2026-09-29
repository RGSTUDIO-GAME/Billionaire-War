import { MINING_DURATION_MS } from '../data/balance';
import { hashrateFor, heroLevelOf } from '../data/economy';
import { getHeroById } from '../data/heroes';
import type { PlayerRepository } from '../repositories/playerRepository';
import type { MiningSession, PlayerProfile } from '../storage/records';

export type MiningProgress = {
  elapsedMs: number;
  remainingMs: number;
  ratio: number;
  amount: number;
  full: boolean;
};

export type MiningStartOutcome =
  | { ok: true; profile: PlayerProfile }
  | { ok: false; reason: 'INVALID_HERO' | 'NO_HASHRATE' | 'SAVE_FAILED'; profile: PlayerProfile };

export type MiningClaimOutcome =
  | { ok: true; profile: PlayerProfile; amount: number }
  | { ok: false; reason: 'NO_SESSION' | 'NOT_READY' | 'INVALID_REWARD' | 'SAVE_FAILED'; profile: PlayerProfile };

/** Never lets an elapsed session display more than its configured target. */
export const miningProgress = (session: MiningSession, now: number): MiningProgress => {
  const rawElapsed = Number.isFinite(now - session.startedAt) ? now - session.startedAt : 0;
  const elapsedMs = Math.max(0, Math.min(rawElapsed, MINING_DURATION_MS));
  const ratio = elapsedMs / MINING_DURATION_MS;
  return {
    elapsedMs,
    remainingMs: MINING_DURATION_MS - elapsedMs,
    ratio,
    amount: session.rewardAmount * ratio,
    full: elapsedMs >= MINING_DURATION_MS,
  };
};

/**
 * The one service allowed to start, pause and settle BWAR Mining.
 *
 * A session snapshots its rate and target when equipped, writes the profile
 * before the store changes, and can be claimed at any time. Claim credits the
 * accrued amount and immediately starts the same hero's next cycle.
 */
export class MiningService {
  private readonly players: PlayerRepository;

  constructor(players: PlayerRepository) {
    this.players = players;
  }

  start(profile: PlayerProfile, heroId: string, now: number): MiningStartOutcome {
    const hero = getHeroById(heroId);
    if (hero === undefined || !profile.ownedHeroes.includes(heroId)) {
      return { ok: false, reason: 'INVALID_HERO', profile };
    }

    const hashrate = hashrateFor(hero.rarity, heroLevelOf(profile.heroLevels, heroId));
    if (hashrate <= 0) return { ok: false, reason: 'NO_HASHRATE', profile };

    const mining: MiningSession = {
      heroId,
      hashrate,
      rewardAmount: (hashrate * MINING_DURATION_MS) / 1000,
      startedAt: now,
    };
    const next = { ...profile, mining };
    if (!this.players.save(next)) return { ok: false, reason: 'SAVE_FAILED', profile };
    return { ok: true, profile: next };
  }

  claim(profile: PlayerProfile, now: number): MiningClaimOutcome {
    const session = profile.mining;
    if (session === null) return { ok: false, reason: 'NO_SESSION', profile };
    const progress = miningProgress(session, now);
    if (progress.amount <= 0) return { ok: false, reason: 'NOT_READY', profile };
    if (!Number.isFinite(session.rewardAmount) || session.rewardAmount <= 0) {
      return { ok: false, reason: 'INVALID_REWARD', profile };
    }

    const balanceAfter = profile.bwarBalance + progress.amount;
    if (!Number.isFinite(balanceAfter) || balanceAfter < 0) {
      return { ok: false, reason: 'INVALID_REWARD', profile };
    }

    const next: PlayerProfile = {
      ...profile,
      bwarBalance: balanceAfter,
      mining: { ...session, startedAt: now },
    };
    if (!this.players.save(next)) return { ok: false, reason: 'SAVE_FAILED', profile };
    return { ok: true, profile: next, amount: progress.amount };
  }
}
