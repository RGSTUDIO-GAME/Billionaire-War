import { useState } from 'react';
import { HEROES, getOwnedState } from '../data/heroes';
import type { Hero, HeroRarity } from '../data/heroes/types';
import { MAX_ROUNDS, ROUND_DAMAGE } from '../data/balance';
import { formatGold, formatHashrate, hashrateFor, heroLevelOf, upgradeCost } from '../data/economy';
import { formatStars, heroSerialOf, heroStarsOf, maxLevelForStars, MAX_STARS } from '../data/fusion';
import { usePlayerStore } from '../state/playerStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FusionModal } from '../components/hero/FusionModal';
import { HeroAvatar } from '../components/hero/HeroAvatar';
import { RarityBadge } from '../components/hero/RarityBadge';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { haptic } from '../services/telegram';
import { soundIds } from '../assets/manifest';
import { audio } from '../audio/audioManager';

type HeroScreenProps = { onBack: () => void };

const OWNERSHIP_TONE = { equipped: 'gold', owned: 'success', locked: 'muted' } as const;
const OWNERSHIP_LABEL = { equipped: 'Equipped', owned: 'Owned', locked: 'Locked' } as const;

const HeroRow = ({
  hero,
  ownership,
  onFuse,
}: {
  hero: Hero;
  ownership: 'locked' | 'owned' | 'equipped';
  onFuse: (hero: Hero) => void;
}) => {
  const equipHero = usePlayerStore((state) => state.equipHero);
  const gold = usePlayerStore((state) => state.gold);
  const heroLevels = usePlayerStore((state) => state.heroLevels);
  const heroStars = usePlayerStore((state) => state.heroStars);
  const heroSerials = usePlayerStore((state) => state.heroSerials);
  const upgradeHero = usePlayerStore((state) => state.upgradeHero);
  const isLocked = ownership === 'locked';
  const level = heroLevelOf(heroLevels, hero.id);
  const stars = heroStarsOf(heroStars, hero.id);
  const serial = heroSerialOf(heroSerials, hero.id);
  const levelCap = maxLevelForStars(stars);
  const capped = level >= levelCap;
  const rate = hashrateFor(hero.rarity, level);
  const cost = upgradeCost(level);

  const accent = RARITY_ACCENT[hero.rarity];
  return (
    <Card style={{ borderColor: accent, boxShadow: `0 0 14px ${accent}40` }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <HeroAvatar hero={hero} size="md" locked={isLocked} />
        <div className="grow stack" style={{ minWidth: 0 }}>
          <div className="row-between">
            <h3 className="display" style={{ fontSize: 20, color: isLocked ? 'var(--text-muted)' : 'var(--gold)' }}>
              {hero.name}
            </h3>
            <Badge tone={OWNERSHIP_TONE[ownership]}>{OWNERSHIP_LABEL[ownership]}</Badge>
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <RarityBadge rarity={hero.rarity} />
            {!isLocked ? (
              <span aria-label={`${stars} of ${MAX_STARS} stars`} style={{ color: 'var(--gold)' }}>
                {formatStars(stars)}
              </span>
            ) : null}
          </div>
          <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
            <Badge>HP {hero.hp}</Badge>
            <Badge>
              Lv {level}/{levelCap}
            </Badge>
            {!isLocked && serial !== null ? <Badge>ID #{serial}</Badge> : null}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Hashrate {formatHashrate(rate)} BWAR/s
          </div>
        </div>
      </div>

      {!isLocked ? (
        <div style={{ marginTop: 'var(--s-3)' }}>
          {cost === null || (capped && stars >= MAX_STARS) ? (
            <div className="empty-state">MAX LEVEL - {formatHashrate(rate)} BWAR/s</div>
          ) : capped ? (
            <div className="stack" style={{ gap: 'var(--s-2)' }}>
              <div className="empty-state">
                Star cap reached at Lv {levelCap}. Fuse to {'★'.repeat(stars + 1)} to unlock Lv{' '}
                {levelCap + 1}–{maxLevelForStars(stars + 1)}.
              </div>
              <Button
                variant="gold"
                block
                onClick={() => {
                  audio.playSfx(soundIds.uiConfirm, 0.5);
                  haptic.impact('medium');
                  onFuse(hero);
                }}
              >
                Fusion
              </Button>
            </div>
          ) : (
            <Button
              variant="gold"
              block
              disabled={gold < cost}
              onClick={() => {
                audio.playSfx(soundIds.uiConfirm, 0.5);
                haptic.impact('medium');
                upgradeHero(hero.id);
              }}
            >
              Upgrade to Lv {level + 1} - {formatGold(cost)} $GOLD
            </Button>
          )}
        </div>
      ) : null}

      <div style={{ marginTop: 'var(--s-3)' }}>
        {ownership === 'equipped' ? (
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            <div className="empty-state">Currently in battle</div>
            <Button
              variant="ghost"
              block
              onClick={() => {
                audio.playSfx(soundIds.uiConfirm, 0.5);
                haptic.impact('light');
                onFuse(hero);
              }}
            >
              Fusion
            </Button>
          </div>
        ) : isLocked ? (
          <div className="empty-state">
            Locked hero. More heroes are added in the next stage - the battle engine already
            supports them.
          </div>
        ) : (
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            <Button
              variant="gold"
              block
              onClick={() => {
                audio.playSfx(soundIds.uiConfirm, 0.5);
                haptic.impact('medium');
                equipHero(hero.id);
              }}
            >
              Equip
            </Button>
            <Button
              variant="ghost"
              block
              onClick={() => {
                audio.playSfx(soundIds.uiConfirm, 0.5);
                haptic.impact('light');
                onFuse(hero);
              }}
            >
              Fusion
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

const RARITY_ORDER: HeroRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const RARITY_LABEL: Record<HeroRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

/** Card frame accent sampled from the rarity plaques. Text stays untouched. */
const RARITY_ACCENT: Record<HeroRarity, string> = {
  common: '#9aa3b2',
  uncommon: '#35c759',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f5c542',
};

export const HeroScreen = ({ onBack }: HeroScreenProps) => {
  const ownedHeroIds = usePlayerStore((state) => state.ownedHeroIds);
  const equippedHeroId = usePlayerStore((state) => state.equippedHeroId);
  const [tab, setTab] = useState<HeroRarity>(
    () => RARITY_ORDER.find((rarity) => HEROES.some((hero) => hero.rarity === rarity)) ?? 'common',
  );
  const [fusionTarget, setFusionTarget] = useState<Hero | null>(null);

  const pickTab = (next: HeroRarity) => {
    if (next === tab) return;
    audio.playSfx(soundIds.uiConfirm, 0.3);
    haptic.impact('light');
    setTab(next);
  };

  const visibleRarities = [tab];

  return (
    <div className="anim-fade">
      <ScreenHeader title="Hero" subtitle={`${HEROES.length} hero available`} onBack={onBack} />

      <div className="tabs" style={{ marginBottom: 'var(--s-3)' }}>
        {RARITY_ORDER.map((rarity) => {
          const count = HEROES.filter((hero) => hero.rarity === rarity).length;
          return (
            <button
              key={rarity}
              type="button"
              className={`tabs__btn${tab === rarity ? ' is-active' : ''}`}
              aria-pressed={tab === rarity}
              aria-label={RARITY_LABEL[rarity]}
              onClick={() => pickTab(rarity)}
            >
              <RarityBadge rarity={rarity} height={20} />
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="stack" style={{ gap: 'var(--s-4)' }}>
        {visibleRarities.map((rarity) => {
          const heroes = HEROES.filter((hero) => hero.rarity === rarity);
          return (
            <section key={rarity}>
              <div className="row-between" style={{ marginBottom: 'var(--s-2)' }}>
                <RarityBadge rarity={rarity} height={28} />
                <span className="muted" style={{ fontSize: 12 }}>
                  {heroes.length} hero
                </span>
              </div>
              {heroes.length > 0 ? (
                <div className="stack">
                  {heroes.map((hero) => (
                    <HeroRow
                      key={hero.id}
                      hero={hero}
                      ownership={getOwnedState(hero, ownedHeroIds, equippedHeroId)}
                      onFuse={setFusionTarget}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">No heroes here yet - coming soon.</div>
              )}
            </section>
          );
        })}
      </div>

      {fusionTarget ? <FusionModal hero={fusionTarget} onClose={() => setFusionTarget(null)} /> : null}

      <Card flat>
        <div className="card__title" style={{ marginBottom: 'var(--s-2)' }}>
          Battle rules
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {MAX_ROUNDS} rounds. Each round you pick one attack part and one defense part, then
          confirm. Damage per round:{' '}
          {[1, 2, 3].map((round) => `R${round} ${ROUND_DAMAGE[round]}`).join(' / ')}. Attacking the
          part your opponent defends deals 0.
        </div>
      </Card>
    </div>
  );
};
