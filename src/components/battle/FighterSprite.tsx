import { useEffect, useState, type CSSProperties } from 'react';
import { AssetImg } from '../../assets/AssetImg';
import { AnimatedSprite, FRAME_INTERVAL_MS } from './AnimatedSprite';
import { heroAssetChain, heroFrameUrls, heroSpriteScale } from '../../assets/heroAssets';
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
  const impactSignature =
    fighter.reactionDelayMs === null
      ? null
      : `${fighter.id}:${beatKey}:${fighter.event?.type ?? 'none'}:${fighter.event?.round ?? ''}:${fighter.hp}`;
  const [landedSignature, setLandedSignature] = useState<string | null>(null);

  useEffect(() => {
    if (impactSignature === null || landedSignature === impactSignature) return undefined;
    const id = window.setTimeout(() => setLandedSignature(impactSignature), fighter.reactionDelayMs ?? 0);
    return () => window.clearTimeout(id);
  }, [fighter.reactionDelayMs, impactSignature, landedSignature]);

  const impactLanded = impactSignature === null || landedSignature === impactSignature;
  const event = impactLanded ? fighter.event : null;
  const resultEvent = impactLanded ? fighter.resultEvent : null;
  const cue = event ? resolveCue(hero, event) : idleCue(hero);
  const popupCue = resultEvent ? resolveCue(hero, resultEvent) : cue;
  const isHit = cue.motion === 'hit';
  const isBlocking = cue.motion === 'block';
  const isBlockPopup = popupCue.motion === 'block';
  const isIdleOutcome = event?.type === 'NO_ACTION';

  return (
    <div
      style={{ '--sprite-scale': String(heroSpriteScale(hero, cue.visual)) } as CSSProperties}
      data-impact-delay={fighter.reactionDelayMs ?? undefined}
      data-impact-state={fighter.reactionDelayMs === null ? undefined : impactLanded ? 'landed' : 'waiting'}
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
        key={`${fighter.id}:${beatKey}:${event ? `${event.type}:${event.round}:${fighter.hp}` : `idle:${fighter.hp}`}`}
        frames={heroFrameUrls(hero, cue.visual)}
        still={heroAssetChain(hero, cue.visual)}
        intervalMs={cue.visual.type === 'idle' ? (hero.idleIntervalMs ?? FRAME_INTERVAL_MS) : FRAME_INTERVAL_MS}
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
