import { AssetImg } from '../../assets/AssetImg';
import { heroAssetChain } from '../../assets/heroAssets';
import { idleCue, resolveCue } from '../../assets/animationController';
import type { Hero } from '../../data/heroes/types';
import type { FighterView } from '../../presentation/battleView';

type FighterSpriteProps = {
  fighter: FighterView;
  hero: Hero;
};

/**
 * The character in the arena.
 *
 * Pure presentation: the engine event decides the pose, the Animation
 * Controller decides the asset, and the fallback chain guarantees something is
 * always drawn.
 */
export const FighterSprite = ({ fighter, hero }: FighterSpriteProps) => {
  const cue = fighter.event ? resolveCue(hero, fighter.event) : idleCue(hero);
  const isBlock = cue.motion === 'block';
  const isHit = cue.motion === 'hit';
  const isIdleOutcome = fighter.event?.type === 'NO_ACTION';

  return (
    <div
      className={[
        'sprite',
        fighter.id === 'A' ? 'sprite--left' : 'sprite--right',
        cue.motion === 'attack' ? 'is-attacking' : '',
        isHit ? 'is-hit' : '',
        isBlock ? 'is-blocking' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AssetImg chain={heroAssetChain(hero, cue.visual)} alt={fighter.name} />

      {cue.label ? (
        <span className={`popup ${isBlock || isIdleOutcome || cue.label === 'HIT 0' ? 'popup--block' : ''}`}>
          {cue.label}
        </span>
      ) : null}

      {cue.effect ? (
        <span className={`sprite__effect sprite__effect--${isBlock ? 'block' : 'hit'}`}>
          <AssetImg assetId={cue.effect} alt="" />
        </span>
      ) : null}
    </div>
  );
};
