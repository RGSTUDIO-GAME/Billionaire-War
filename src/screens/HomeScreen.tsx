import { AssetImg } from '../assets/AssetImg';
import { RarityBadge } from '../components/hero/RarityBadge';
import { backgroundIds, uiIds } from '../assets/manifest';
import { getHeroById } from '../data/heroes';
import { usePlayerStore } from '../state/playerStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SceneCard } from '../components/ui/SceneCard';
import { heroPortraitIds } from '../assets/manifest';
import { StatBar } from '../components/ui/StatBar';

type HomeScreenProps = {
  onPlay: () => void;
  onGacha: () => void;
  onMining: () => void;
  onTrade: () => void;
};

export const HomeScreen = ({ onPlay, onGacha, onMining, onTrade }: HomeScreenProps) => {
  const equippedHeroId = usePlayerStore((state) => state.equippedHeroId);
  const hero = getHeroById(equippedHeroId);

  if (!hero) return null;

  return (
    <div className="home-screen anim-fade">
      <SceneCard background={backgroundIds.home}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="home-portrait">
            <AssetImg assetId={heroPortraitIds[hero.id] ?? heroPortraitIds.durov} alt={hero.name} />
          </div>
          <div className="stack grow" style={{ minWidth: 0 }}>
            <Badge tone="gold">Equipped</Badge>
            <h2 className="display" style={{ fontSize: 26, color: 'var(--gold)' }}>
              {hero.name}
            </h2>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 12 }}>
                HP {hero.hp}
              </span>
              <RarityBadge rarity={hero.rarity} />
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

      <Button variant="ghost" block className="home-asset-button home-asset-button--wide home-asset-button--play" onClick={onPlay} aria-label="Play">
        <AssetImg assetId={uiIds.playButton} alt="Play" />
      </Button>

      <Button variant="ghost" block className="home-asset-button home-asset-button--wide home-asset-button--gacha" onClick={onGacha} aria-label="Gacha">
        <AssetImg assetId={uiIds.gachaButton} alt="Gacha" />
      </Button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-2)' }}>
        <Button variant="ghost" className="home-asset-button home-asset-button--small home-asset-button--trade" onClick={onTrade} aria-label="Trade">
          <AssetImg assetId={uiIds.tradeButton} alt="Trade" />
        </Button>
        <Button variant="ghost" className="home-asset-button home-asset-button--small home-asset-button--mining" onClick={onMining} aria-label="BWAR Mining">
          <AssetImg assetId={uiIds.bwarMiningButton} alt="BWAR Mining" />
        </Button>
      </div>

    </div>
  );
};
