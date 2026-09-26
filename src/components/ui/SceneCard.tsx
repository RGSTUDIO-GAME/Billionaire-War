import type { CSSProperties, ReactNode } from 'react';
import { getAssetUrl } from '../../assets/resolve';
import type { AssetId } from '../../assets/types';

type SceneCardProps = {
  /** Registered background asset id - never a raw path. */
  background: AssetId;
  children: ReactNode;
  className?: string;
};

/**
 * A card layered over a scene background with a readability scrim.
 * The image still comes from the asset registry, so it stays replaceable.
 */
export const SceneCard = ({ background, children, className = '' }: SceneCardProps) => (
  <div
    className={`card card--scene ${className}`.trim()}
    style={{ '--scene': `url("${getAssetUrl(background)}")` } as CSSProperties}
  >
    {children}
  </div>
);
