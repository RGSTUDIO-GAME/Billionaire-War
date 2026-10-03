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
import { usePlayerStore } from '../state/playerStore';

type GachaScreenProps = {
  onBack: () => void;
};

type GachaPhase = 'idle' | 'spinning' | 'revealed';
type GachaCount = 1 | 10;

const MYSTERY_CARD_COUNT = 5;
const MULTI_PULL_COUNT = 10;
const REVEAL_DELAY_MS = 1800;

export const GachaScreen = ({ onBack }: GachaScreenProps) => {
  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [results, setResults] = useState<Hero[]>([]);
  const [pullCount, setPullCount] = useState<GachaCount>(1);
  const [saveFailed, setSaveFailed] = useState(false);
  const revealTimer = useRef<number | null>(null);
  const grantGachaHeroes = usePlayerStore((state) => state.grantGachaHeroes);

  useEffect(
    () => () => {
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    },
    [],
  );

  const startGacha = (count: GachaCount) => {
    if (phase === 'spinning') return;

    const pulledResults: Hero[] = [];
    for (let index = 0; index < count; index += 1) {
      const hero = HEROES[Math.floor(Math.random() * HEROES.length)];
      if (hero) pulledResults.push(hero);
    }
    if (pulledResults.length !== count) return;

    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    setResults([]);
    setPullCount(count);
    setSaveFailed(false);
    setPhase('spinning');
    audio.playSfx(soundIds.uiConfirm, 0.45);

    revealTimer.current = window.setTimeout(() => {
      const saved = grantGachaHeroes(pulledResults.map((hero) => hero.id));
      setResults(pulledResults);
      setSaveFailed(!saved);
      setPhase('revealed');
      audio.playSfx(soundIds.victory, 0.55);
      haptic.notify(saved ? 'success' : 'error');
      revealTimer.current = null;
    }, REVEAL_DELAY_MS);
  };

  const renderHeroResult = (hero: Hero) => (
    <div className="gacha-card__hero">
      <AssetImg
        assetId={heroPortraitIds[hero.id] ?? heroPortraitIds.durov}
        alt={hero.name}
        className="gacha-card__portrait"
      />
      <div className="gacha-card__hero-copy">
        <RarityBadge rarity={hero.rarity} height={18} />
        <strong>{hero.name}</strong>
        <span>{hero.title}</span>
      </div>
    </div>
  );

  const isMultiResult = phase === 'revealed' && results.length === MULTI_PULL_COUNT;
  const singleResult = results.length === 1 ? results[0] : null;
  const status =
    phase === 'spinning'
      ? `Spinning ${pullCount === 1 ? '1X' : '10X'}... hold tight!`
      : phase === 'revealed' && saveFailed
        ? 'Heroes revealed · save failed'
        : phase === 'revealed' && isMultiResult
          ? '10 heroes saved to Hero'
          : phase === 'revealed' && singleResult
            ? `${singleResult.name} · ${singleResult.rarity.toUpperCase()} HERO · SAVED`
            : pullCount === 10
              ? 'Tap 10X Gacha to reveal ten random heroes.'
              : 'Tap Gacha to reveal a random hero.';

  return (
    <div className="gacha-screen anim-fade">
      <ScreenHeader title="Gacha" subtitle="Free pulls · saved to Hero" onBack={onBack} />

      <section
        className={`gacha-stage is-${phase}${isMultiResult ? ' has-ten-results' : ''}`}
        aria-live="polite"
      >
        <div className="gacha-stage__halo" aria-hidden="true" />
        <div
          className={`gacha-stage__cards${isMultiResult ? ' gacha-stage__cards--results' : ''}`}
        >
          {isMultiResult ? (
            results.map((hero, resultIndex) => (
              <div
                key={`${hero.id}-${resultIndex}`}
                className="gacha-card is-revealed"
                data-rarity={hero.rarity}
                style={{ '--reveal-index': resultIndex } as CSSProperties}
                aria-label={`${hero.name}, ${hero.rarity} hero`}
              >
                <div className="gacha-card__float">
                  <div className="gacha-card__surface">
                    {renderHeroResult(hero)}
                    <span className="gacha-card__shine" aria-hidden="true" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            Array.from({ length: MYSTERY_CARD_COUNT }, (_, stackIndex) => {
              const isFront = stackIndex === 0;
              const isRevealed = isFront && phase === 'revealed' && singleResult !== null;
              const cardOrder = MYSTERY_CARD_COUNT - stackIndex;

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
                  data-rarity={isRevealed ? singleResult?.rarity : undefined}
                  style={{ '--stack-index': cardOrder } as CSSProperties}
                  aria-hidden={!isFront}
                  aria-label={
                    isFront
                      ? isRevealed && singleResult
                        ? `${singleResult.name}, ${singleResult.rarity} hero`
                        : phase === 'spinning'
                          ? 'Gacha card spinning'
                          : 'Mystery hero card'
                      : undefined
                  }
                >
                  <div className="gacha-card__float">
                    <div className="gacha-card__surface">
                      {isRevealed && singleResult ? (
                        renderHeroResult(singleResult)
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
            })
          )}
        </div>
        <div className="gacha-stage__sparkles" aria-hidden="true" />
      </section>

      <div className="gacha-status" role="status">
        {status}
      </div>

      <div className="gacha-actions">
        <Button
          variant="gold"
          onClick={() => startGacha(1)}
          disabled={phase === 'spinning'}
        >
          {phase === 'spinning' && pullCount === 1
            ? 'Spinning...'
            : phase === 'revealed'
              ? 'Gacha again'
              : 'Gacha'}
        </Button>
        <Button
          variant="primary"
          onClick={() => startGacha(10)}
          disabled={phase === 'spinning'}
        >
          {phase === 'spinning' && pullCount === 10
            ? '10X Spinning...'
            : phase === 'revealed'
              ? '10X again'
              : '10X Gacha'}
        </Button>
      </div>
    </div>
  );
};
