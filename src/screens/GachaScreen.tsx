import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AssetImg } from '../assets/AssetImg';
import { heroPortraitIds } from '../assets/manifest';
import { RarityBadge } from '../components/hero/RarityBadge';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Button } from '../components/ui/Button';
import { HEROES } from '../data/heroes';
import type { Hero } from '../data/heroes/types';
import { audio } from '../audio/audioManager';
import { soundIds } from '../assets/manifest';
import { haptic } from '../services/telegram';

type GachaScreenProps = {
  onBack: () => void;
};

type GachaPhase = 'idle' | 'spinning' | 'revealed';

const CARD_COUNT = 5;
const REVEAL_DELAY_MS = 1800;

export const GachaScreen = ({ onBack }: GachaScreenProps) => {
  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [result, setResult] = useState<Hero | null>(null);
  const revealTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    },
    [],
  );

  const startGacha = () => {
    if (phase === 'spinning') return;

    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    setResult(null);
    setPhase('spinning');
    audio.playSfx(soundIds.uiConfirm, 0.45);

    revealTimer.current = window.setTimeout(() => {
      const hero = HEROES[Math.floor(Math.random() * HEROES.length)];
      if (!hero) return;
      setResult(hero);
      setPhase('revealed');
      audio.playSfx(soundIds.victory, 0.55);
      haptic.notify('success');
      revealTimer.current = null;
    }, REVEAL_DELAY_MS);
  };

  const status =
    phase === 'spinning'
      ? 'Spinning... hold tight!'
      : phase === 'revealed' && result
        ? `${result.name} · ${result.rarity.toUpperCase()} HERO`
        : 'Tap Gacha to reveal a random hero.';

  return (
    <div className="gacha-screen anim-fade">
      <ScreenHeader title="Gacha" subtitle="Free preview · visual only" onBack={onBack} />

      <section className={`gacha-stage is-${phase}`} aria-live="polite">
        <div className="gacha-stage__halo" aria-hidden="true" />
        <div className="gacha-stage__cards">
          {Array.from({ length: CARD_COUNT }, (_, stackIndex) => {
            const isFront = stackIndex === 0;
            const isRevealed = isFront && phase === 'revealed' && result !== null;
            const cardOrder = CARD_COUNT - stackIndex;

            return (
              <div
                key={stackIndex}
                className={[
                  'gacha-card',
                  isFront ? 'gacha-card--front' : '',
                  isRevealed ? 'is-revealed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-rarity={isRevealed ? result?.rarity : undefined}
                style={{ '--stack-index': cardOrder } as CSSProperties}
                aria-hidden={!isFront}
                aria-label={
                  isFront
                    ? isRevealed && result
                      ? `${result.name}, ${result.rarity} hero`
                      : phase === 'spinning'
                        ? 'Gacha card spinning'
                        : 'Mystery hero card'
                    : undefined
                }
              >
                <div className="gacha-card__float">
                  <div className="gacha-card__surface">
                    {isRevealed && result ? (
                      <div className="gacha-card__hero">
                        <AssetImg
                          assetId={heroPortraitIds[result.id] ?? heroPortraitIds.durov}
                          alt={result.name}
                          className="gacha-card__portrait"
                        />
                        <div className="gacha-card__hero-copy">
                          <RarityBadge rarity={result.rarity} height={20} />
                          <strong>{result.name}</strong>
                          <span>{result.title}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="gacha-card__mystery">
                        <span aria-hidden="true">?</span>
                        <small>HERO CARD</small>
                      </div>
                    )}
                    <span className="gacha-card__shine" aria-hidden="true" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="gacha-stage__sparkles" aria-hidden="true" />
      </section>

      <div className="gacha-status" role="status">
        {status}
      </div>

      <Button
        variant="gold"
        block
        onClick={startGacha}
        disabled={phase === 'spinning'}
      >
        {phase === 'spinning' ? 'Spinning...' : phase === 'revealed' ? 'Gacha again' : 'Gacha'}
      </Button>
    </div>
  );
};
