import { AssetImg } from '../../assets/AssetImg';
import { rarityIds } from '../../assets/manifest';
import type { HeroRarity } from '../../data/heroes/types';

type RarityBadgeProps = {
  rarity: HeroRarity;
  /** Image height in px; width follows the plaque aspect. */
  height?: number;
};

/** Rarity plaque artwork. Replaces raw rarity text everywhere. */
export const RarityBadge = ({ rarity, height = 22 }: RarityBadgeProps) => (
  <AssetImg assetId={rarityIds[rarity]} alt={rarity} style={{ height, width: 'auto' }} />
);
