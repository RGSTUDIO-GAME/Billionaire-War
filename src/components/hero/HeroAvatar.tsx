import { AssetImg } from '../../assets/AssetImg';
import { iconIds } from '../../assets/manifest';
import { heroAssetChain } from '../../assets/heroAssets';
import type { Hero } from '../../data/heroes/types';
import type { HeroVisual } from '../../assets/types';

type HeroAvatarProps = {
  hero: Hero;
  size?: 'sm' | 'md' | 'lg';
  visual?: HeroVisual;
  locked?: boolean;
};

const DEFAULT_VISUAL: HeroVisual = { type: 'character' };

/**
 * Renders a hero through the asset layer only.
 * It never branches on `hero.id` - swapping DUROV for another hero changes
 * nothing here.
 */
export const HeroAvatar = ({ hero, size = 'md', visual = DEFAULT_VISUAL, locked = false }: HeroAvatarProps) => (
  <div className={`avatar avatar--${size}${locked ? ' is-locked' : ''}`}>
    <AssetImg chain={heroAssetChain(hero, visual)} alt={hero.name} />
    {locked ? (
      <span className="avatar__lock">
        <AssetImg assetId={iconIds.lock} alt="Locked" />
      </span>
    ) : null}
  </div>
);
