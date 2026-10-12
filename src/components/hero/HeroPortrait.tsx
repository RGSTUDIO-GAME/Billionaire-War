import { AssetImg } from '../../assets/AssetImg';
import { heroPortraitIds } from '../../assets/manifest';
import type { Hero } from '../../data/heroes/types';

type HeroPortraitProps = {
  hero: Hero;
  locked?: boolean;
  size?: 'md' | 'xs';
};

/**
 * Hero portrait rendered exactly like Home: the hero's portrait.jpg inside
 * .home-portrait (cover, 132x168). Used by Hero, Mining and Trade so every
 * menu shows the same face.
 */
export const HeroPortrait = ({ hero, locked = false, size = 'md' }: HeroPortraitProps) => (
  <div
    className={`home-portrait hero-portrait${size === 'xs' ? ' hero-portrait--xs' : ''}${locked ? ' is-locked' : ''}`}
  >
    <AssetImg assetId={heroPortraitIds[hero.id] ?? heroPortraitIds.durov} alt={hero.name} />
  </div>
);
