import { useState } from 'react';
import type { Hero } from '../../data/heroes/types';
import {
  COPIES_PER_SIX_STAR,
  formatStars,
  formatSupply,
  fusionCostCopies,
  heroCopiesOf,
  heroSerialOf,
  heroStarsOf,
  maxLevelForStars,
  maxSixStarCount,
  MAX_STARS,
  RARITY_SUPPLY,
} from '../../data/fusion';
import { heroLevelOf } from '../../data/economy';
import { usePlayerStore } from '../../state/playerStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { HeroAvatar } from './HeroAvatar';
import { RarityBadge } from './RarityBadge';

const SHOWN_SERIALS = 60;

export const FusionModal = ({ hero, onClose }: { hero: Hero; onClose: () => void }) => {
  const heroLevels = usePlayerStore((state) => state.heroLevels);
  const heroStars = usePlayerStore((state) => state.heroStars);
  const heroCopies = usePlayerStore((state) => state.heroCopies);
  const heroSerials = usePlayerStore((state) => state.heroSerials);
  const fuseHero = usePlayerStore((state) => state.fuseHero);
  const [notice, setNotice] = useState<string | null>(null);

  const stars = heroStarsOf(heroStars, hero.id);
  const level = heroLevelOf(heroLevels, hero.id);
  const serial = heroSerialOf(heroSerials, hero.id);
  const copies = heroCopiesOf(heroCopies, hero.id);
  const cost = fusionCostCopies(stars);
  const maxed = stars >= MAX_STARS;
  const canFuse = !maxed && cost !== null && copies.length >= cost;

  const fuse = () => {
    if (fuseHero(hero.id)) {
      setNotice(`Fused into ${'★'.repeat(stars + 1)}${'☆'.repeat(MAX_STARS - stars - 1)}.`);
    } else {
      setNotice('Fusion refused. Same-hero copies are burned, never $GOLD.');
    }
  };

  return (
    <Modal open title={`Fusion - ${hero.name}`} onClose={onClose}>
      <div className="stack">
        <Card flat tight>
          <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
            <HeroAvatar hero={hero} size="sm" />
            <div className="grow stack" style={{ gap: 2 }}>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <RarityBadge rarity={hero.rarity} />
                {serial !== null ? <Badge>ID #{serial}</Badge> : null}
              </div>
              <div style={{ fontSize: 20 }} aria-label={`${stars} of ${MAX_STARS} stars`}>
                {formatStars(stars)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Lv {level} / {maxLevelForStars(stars)}
              </div>
            </div>
          </div>
        </Card>

        <Card flat tight>
          <div className="row-between">
            <span className="muted" style={{ fontSize: 12 }}>
              Same-hero copies owned
            </span>
            <Badge tone={copies.length > 0 ? 'success' : 'muted'}>{copies.length}</Badge>
          </div>
          {copies.length > 0 ? (
            <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 'var(--s-2)' }}>
              {copies.slice(0, SHOWN_SERIALS).map((copySerial) => (
                <Badge key={copySerial}>#{copySerial}</Badge>
              ))}
              {copies.length > SHOWN_SERIALS ? (
                <span className="muted" style={{ fontSize: 12 }}>
                  +{copies.length - SHOWN_SERIALS} more
                </span>
              ) : null}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12, marginTop: 'var(--s-2)' }}>
              No duplicates yet. Pull the same hero in Gacha to add it to this stack.
            </div>
          )}
        </Card>

        <Card flat tight>
          {maxed ? (
            <div className="empty-state">MAX STARS - this hero cannot fuse further.</div>
          ) : (
            <div className="stack" style={{ gap: 'var(--s-2)' }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Next: {'★'.repeat(stars + 1)}{'☆'.repeat(MAX_STARS - stars - 1)} unlocks Lv{' '}
                {maxLevelForStars(stars) + 1}–{maxLevelForStars(stars + 1)} for {cost} {cost === 1 ? 'copy' : 'copies'}.
              </div>
              <Button variant="gold" block disabled={!canFuse} onClick={fuse}>
                {canFuse ? `Fuse ${cost} ${cost === 1 ? 'copy' : 'copies'}` : `Need ${cost} ${cost === 1 ? 'copy' : 'copies'}`}
              </Button>
            </div>
          )}
          {notice ? (
            <div className="trade-notice" role="status" style={{ marginTop: 'var(--s-2)' }}>
              {notice}
            </div>
          ) : null}
        </Card>

        <Card flat tight>
          <div className="muted" style={{ fontSize: 12 }}>
            Supply {formatSupply(supplyOf(hero))} • Max {maxSixStarCount(hero.rarity)} heroes at 6★ •{' '}
            {COPIES_PER_SIX_STAR} copies forge one 6★.
          </div>
        </Card>
      </div>
    </Modal>
  );
};

const supplyOf = (hero: Hero): number => RARITY_SUPPLY[hero.rarity] ?? 0;
