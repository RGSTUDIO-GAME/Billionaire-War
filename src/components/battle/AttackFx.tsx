import { AnimatedSprite } from './AnimatedSprite';
import { hasAttackFx, heroExplosionUrls, heroProjectileUrls } from '../../assets/heroAssets';
import type { Hero } from '../../data/heroes/types';
import type { CombatantId } from '../../engine/types';

type AttackFxProps = {
  hero: Hero;
  /** Who launched the plane. Decides the flight direction and blast side. */
  attacker: CombatantId;
  /** Battle beat identity, so every swing restarts the flight at frame 1. */
  beatKey: string;
};

/**
 * Durov's attack cinema: a paper plane flies across the arena and bursts
 * into a blue explosion on the defender.
 *
 * Pure presentation. The parent renders this only while the attacker plays an
 * ATTACK event, and heroes without their own cinema render nothing at all.
 */
export const AttackFx = ({ hero, attacker, beatKey }: AttackFxProps) => {
  const plane = heroProjectileUrls(hero);
  const blast = heroExplosionUrls(hero);
  if (!hasAttackFx(hero)) return null;

  return (
    <div
      className={`attack-fx ${attacker === 'A' ? 'attack-fx--from-left' : 'attack-fx--from-right'}`}
      aria-hidden="true"
    >
      <div className="attack-fx__plane" key={`plane:${beatKey}`}>
        <AnimatedSprite frames={plane} still={[]} intervalMs={190} loop={false} alt="" />
      </div>
      <div className="attack-fx__boom" key={`boom:${beatKey}`}>
        <AnimatedSprite frames={blast} still={[]} intervalMs={160} loop={false} alt="" />
      </div>
    </div>
  );
};
