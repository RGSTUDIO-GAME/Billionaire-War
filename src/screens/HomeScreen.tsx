import { AssetImg } from '../assets/AssetImg';
import { backgroundIds, iconIds, uiIds } from '../assets/manifest';
import { getHeroById } from '../data/heroes';
import { usePlayerStore } from '../state/playerStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SceneCard } from '../components/ui/SceneCard';
import { HeroAvatar } from '../components/hero/HeroAvatar';
import { Icon } from '../components/ui/Icon';
import { StatBar } from '../components/ui/StatBar';

type HomeScreenProps = {
  onWar: () => void;
  onHero: () => void;
  onQuest: () => void;
};

export const HomeScreen = ({ onWar, onHero, onQuest }: HomeScreenProps) => {
  const equippedHeroId = usePlayerStore((state) => state.equippedHeroId);
  const hero = getHeroById(equippedHeroId);

  if (!hero) return null;

  return (
    <div className="stack-lg anim-fade">
      <SceneCard background={backgroundIds.home}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <HeroAvatar hero={hero} size="lg" />
          <div className="stack grow" style={{ minWidth: 0 }}>
            <Badge tone="gold">Equipped</Badge>
            <h2 className="display" style={{ fontSize: 26, color: 'var(--gold)' }}>
              {hero.name}
            </h2>
            <div className="muted" style={{ fontSize: 12 }}>
              {hero.title}
            </div>
            <div style={{ marginTop: 'var(--s-2)' }}>
              <StatBar value={hero.hp} max={hero.hp} label="Base HP" />
            </div>
          </div>
        </div>

        <p className="muted" style={{ fontSize: 12, marginTop: 'var(--s-3)' }}>
          {hero.bio}
        </p>
      </SceneCard>

      <Button variant="primary" size="lg" block icon={iconIds.swords} onClick={onWar}>
        War
      </Button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' }}>
        <Button variant="ghost" icon={iconIds.hero} onClick={onHero}>
          Hero
        </Button>
        <Button variant="ghost" icon={iconIds.quest} onClick={onQuest}>
          Quest
        </Button>
      </div>

      <Card flat>
        <div className="row" style={{ gap: 'var(--s-3)' }}>
          <Icon assetId={iconIds.star} alt="" className="coming-soon__icon" style={{ width: 34, height: 34 }} />
          <div className="grow">
            <div className="card__title">Season 0 &middot; Foundation</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Core battle system, hero roster and $GOLD battle rewards. Quests, leaderboard and
              matchmaking arrive next.
            </div>
          </div>
        </div>
      </Card>

      <AssetImg
        assetId={uiIds.divider}
        alt=""
        style={{ opacity: 0.6, width: '100%' }}
      />

      <Card flat tight>
        <div className="row" style={{ gap: 'var(--s-2)', fontSize: 12 }}>
          <AssetImg assetId={iconIds.bwar} alt="" style={{ width: 18, height: 18 }} />
          <span className="muted">
            $BWAR utility features, trading and Web3 are marked COMING SOON. No wallet, no chain.
          </span>
        </div>
      </Card>
    </div>
  );
};
