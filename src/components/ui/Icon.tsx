import type { CSSProperties } from 'react';
import { AssetImg } from '../../assets/AssetImg';
import type { AssetId } from '../../assets/types';

type IconProps = {
  assetId: AssetId;
  className?: string;
  style?: CSSProperties;
  alt?: string;
};

/** Renders a registered icon asset. Icons inherit `currentColor` for stroke. */
export const Icon = ({ assetId, className, style, alt = '' }: IconProps) => (
  <AssetImg assetId={assetId} className={className} style={style} alt={alt} />
);
