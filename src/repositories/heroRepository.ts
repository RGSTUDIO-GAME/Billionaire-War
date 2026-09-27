import { getFreeHeroes, getHeroById } from '../data/heroes';
import type { PlayerProfile } from '../storage/records';

/**
 * HERO REPOSITORY
 * ===============
 * Ownership and the equipped hero, as rules over a profile.
 *
 * Free heroes are always owned and always selectable, so a new player can
 * never end up with an empty roster or an equipped hero they do not own. The
 * rules live here rather than in the UI so the Hero screen cannot invent its
 * own idea of what is owned.
 */

/** The roster as the game guarantees it. */
export const normaliseRoster = (profile: PlayerProfile): PlayerProfile => {
  const free = getFreeHeroes().map((hero) => hero.id);
  const owned = [...new Set([...profile.ownedHeroes.filter((id) => getHeroById(id) !== undefined), ...free])];
  const equipped =
    getHeroById(profile.equippedHeroId) !== undefined && owned.includes(profile.equippedHeroId)
      ? profile.equippedHeroId
      : (free[0] ?? owned[0] ?? 'durov');

  return { ...profile, ownedHeroes: owned, equippedHeroId: equipped };
};

export const ownsHero = (profile: PlayerProfile, heroId: string): boolean =>
  profile.ownedHeroes.includes(heroId);

/** Grants a hero. Granting something already owned changes nothing. */
export const withHero = (profile: PlayerProfile, heroId: string): PlayerProfile => {
  if (getHeroById(heroId) === undefined || ownsHero(profile, heroId)) return profile;
  return { ...profile, ownedHeroes: [...profile.ownedHeroes, heroId] };
};

/** Equips a hero. Refused unless the player actually owns it. */
export const withEquippedHero = (profile: PlayerProfile, heroId: string): PlayerProfile => {
  if (getHeroById(heroId) === undefined || !ownsHero(profile, heroId)) return profile;
  if (profile.equippedHeroId === heroId) return profile;
  return { ...profile, equippedHeroId: heroId };
};
