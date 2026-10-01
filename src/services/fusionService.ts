import { fusionCostCopies, heroCopiesOf, heroStarsOf, MAX_STARS } from '../data/fusion';
import { getHeroById } from '../data/heroes';
import type { PlayerRepository } from '../repositories/playerRepository';
import type { PlayerProfile } from '../storage/records';

export type FusionFailure =
  | 'UNKNOWN_HERO'
  | 'NOT_OWNED'
  | 'MAX_STARS'
  | 'NOT_ENOUGH_COPIES'
  | 'SAVE_FAILED';

export type FusionOutcome =
  | { ok: true; profile: PlayerProfile }
  | { ok: false; reason: FusionFailure; profile: PlayerProfile };

const refused = (profile: PlayerProfile, reason: FusionFailure): FusionOutcome => ({
  ok: false,
  reason,
  profile,
});

/**
 * Grants one spare copy of a hero with a fresh unique serial number.
 *
 * Copies are the fusion material: duplicates of a hero the player already
 * fields. Granting a hero that is not owned yet unlocks its roster (main)
 * instance instead of a spare copy, so this is the single acquisition
 * primitive the future ticket Gacha will call.
 */
export const withCopyGranted = (profile: PlayerProfile, heroId: string): PlayerProfile => {
  if (getHeroById(heroId) === undefined) return profile;
  if (!profile.ownedHeroes.includes(heroId)) {
    const counter = (profile.heroSerialCounter ?? 0) + 1;
    return {
      ...profile,
      ownedHeroes: [...profile.ownedHeroes, heroId],
      heroSerials: { ...(profile.heroSerials ?? {}), [heroId]: counter },
      heroSerialCounter: counter,
    };
  }
  const counter = (profile.heroSerialCounter ?? 0) + 1;
  const copies = heroCopiesOf(profile.heroCopies, heroId);
  return {
    ...profile,
    heroCopies: { ...(profile.heroCopies ?? {}), [heroId]: [...copies, counter] },
    heroSerialCounter: counter,
  };
};

/**
 * FUSION SERVICE
 * ==============
 * Burns spare same-hero copies to raise a roster hero one star tier.
 *
 * Fusion never moves $GOLD or $BWAR, so the ledger is untouched: only the
 * star map and the spare-copy serials change, then the profile is saved.
 */
export class FusionService {
  private readonly players: PlayerRepository;

  constructor(players: PlayerRepository) {
    this.players = players;
  }

  grantCopy(profile: PlayerProfile, heroId: string, _now?: number): FusionOutcome {
    void _now;
    if (getHeroById(heroId) === undefined) return refused(profile, 'UNKNOWN_HERO');
    const next = withCopyGranted(profile, heroId);
    if (!this.players.save(next)) return refused(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }

  fuse(profile: PlayerProfile, heroId: string, _now?: number): FusionOutcome {
    void _now;
    if (getHeroById(heroId) === undefined) return refused(profile, 'UNKNOWN_HERO');
    if (!profile.ownedHeroes.includes(heroId)) return refused(profile, 'NOT_OWNED');
    const stars = heroStarsOf(profile.heroStars, heroId);
    if (stars >= MAX_STARS) return refused(profile, 'MAX_STARS');
    const cost = fusionCostCopies(stars) ?? 0;
    const copies = heroCopiesOf(profile.heroCopies, heroId);
    if (copies.length < cost) return refused(profile, 'NOT_ENOUGH_COPIES');
    const next: PlayerProfile = {
      ...profile,
      heroStars: { ...(profile.heroStars ?? {}), [heroId]: stars + 1 },
      heroCopies: { ...(profile.heroCopies ?? {}), [heroId]: copies.slice(cost) },
    };
    if (!this.players.save(next)) return refused(profile, 'SAVE_FAILED');
    return { ok: true, profile: next };
  }
}
