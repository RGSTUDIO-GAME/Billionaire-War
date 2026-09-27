import { AssetImg } from '../../assets/AssetImg';
import { AnimatedSprite } from './AnimatedSprite';
import { heroAssetChain, heroFrameUrls } from '../../assets/heroAssets';
import { idleCue, resolveCue } from '../../assets/animationController';
import type { Hero } from '../../data/heroes/types';
import type { FighterView } from '../../presentation/battleView';

type FighterSpriteProps = {
  fighter: FighterView;
  hero: Hero;
  /**
   * Battle beat identity (battle + phase + resolved attacks). Included in the
   * sprite key so every beat restarts at frame 1 - without it a rematch can
   * reuse a finished frame strip and the fighter looks frozen.
   */
  beatKey?: string;
};

/**
 * The character in the arena.
 *
 * Pure presentation: the engine event decides the pose, the Animation
 * Controller decides the asset, and the fallback chain guarantees something is
 * always drawn.
 */
export const FighterSprite = ({ fighter, hero, beatKey = '' }: FighterSpriteProps) => {
  const cue = fighter.event ? resolveCue(hero, fighter.event) : idleCue(hero);
  const popupCue = fighter.resultEvent ? resolveCue(hero, fighter.resultEvent) : cue;
  const isHit = cue.motion === 'hit';
  const isBlocking = cue.motion === 'block';
  const isBlockPopup = popupCue.motion === 'block';
  const isIdleOutcome = fighter.event?.type === 'NO_ACTION';

  return (
    <div
      className={[
        'sprite',
        fighter.id === 'A' ? 'sprite--left' : 'sprite--right',
        cue.motion === 'attack' ? 'is-attacking' : '',
        isHit ? 'is-hit' : '',
        isBlocking ? 'is-blocking' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AnimatedSprite
        key={`${fighter.id}:${beatKey}:${fighter.event ? `${fighter.event.type}:${fighter.event.round}:${fighter.hp}` : `idle:${fighter.hp}`}`}
        frames={heroFrameUrls(hero, cue.visual)}
        still={heroAssetChain(hero, cue.visual)}
        loop={cue.visual.type === 'idle'}
        alt={fighter.name}
      />

      {popupCue.label ? (
        <span className={`popup ${isBlockPopup || isIdleOutcome || popupCue.label === 'HIT 0' ? 'popup--block' : ''}`}>
          {popupCue.label}
        </span>
      ) : null}

      {cue.motion === 'block' && cue.effect ? (
        <span className="sprite__effect sprite__effect--block">
          <AssetImg assetId={cue.effect} alt="" />
        </span>
      ) : null}
    </div>
  );
};
