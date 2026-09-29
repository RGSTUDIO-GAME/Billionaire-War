import { useState } from 'react';
import { HEROES, getOwnedState } from '../data/heroes';
import type { Hero, HeroRarity } from '../data/heroes/types';
import { MAX_ROUNDS, ROUND_DAMAGE } from '../data/balance';
import { usePlayerStore } from '../state/playerStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { HeroAvatar } from '../components/hero/HeroAvatar';
import { RarityBadge } from '../components/hero/RarityBadge';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { haptic } from '../services/telegram';
import { soundIds } from '../assets/manifest';
import { audio } from '../audio/audioManager';

type HeroScreenProps = { onBack: () => void };

const OWNERSHIP_TONE = { equipped: 'gold', owned: 'success', locked: 'muted' } as const;
const OWNERSHIP_LABEL = { equipped: 'Equipped', owned: 'Owned', locked: 'Locked' } as const;

const HeroRow = ({ hero, ownership }: { hero: Hero; ownership: 'locked' | 'owned' | 'equipped' }) => {
  const equipHero = usePlayerStore((state) => state.equipHero);
  const isLocked = ownership === 'locked';

  return (
    <Card>
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
            <span className="muted" style={{ fontSize: 12 }}>
              HP {hero.hp}
            </span>
            <RarityBadge rarity={hero.rarity} />
          </div>
          <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
            <Badge>HP {hero.hp}</Badge>
            <Badge>{hero.free ? 'Free' : hero.priceInGold !== null ? `${hero.priceInGold} $GOLD` : 'Event'}</Badge>
            <Badge>{hero.skills.length} skill</Badge>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'var(--s-3)' }}>
        {ownership === 'equipped' ? (
          <div className="empty-state">Currently in battle</div>
        ) : isLocked ? (
          <div className="empty-state">
            Locked hero. More heroes are added in the next stage - the battle engine already
            supports them.
          </div>
        ) : (
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

type RarityTab = HeroRarity | 'all';

export const HeroScreen = ({ onBack }: HeroScreenProps) => {
  const ownedHeroIds = usePlayerStore((state) => state.ownedHeroIds);
  const equippedHeroId = usePlayerStore((state) => state.equippedHeroId);
  const [tab, setTab] = useState<RarityTab>('all');

  const pickTab = (next: RarityTab) => {
    if (next === tab) return;
    audio.playSfx(soundIds.uiConfirm, 0.3);
    haptic.impact('light');
    setTab(next);
  };

  const visibleRarities = tab === 'all' ? RARITY_ORDER : [tab];

  return (
    <div className="anim-fade">
      <ScreenHeader title="Hero" subtitle={`${HEROES.length} hero available`} onBack={onBack} />

      <div className="tabs" style={{ marginBottom: 'var(--s-3)' }}>
        <button
          key="all"
          type="button"
          className={`tabs__btn${tab === 'all' ? ' is-active' : ''}`}
          aria-pressed={tab === 'all'}
          onClick={() => pickTab('all')}
        >
          All · {HEROES.length}
        </button>
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
