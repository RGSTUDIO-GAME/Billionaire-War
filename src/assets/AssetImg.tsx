import { useState } from 'react';
import type { CSSProperties } from 'react';
import { getFallbackChain } from './resolve';
import type { AssetId } from './types';

type AssetImgProps = {
  /** Registered asset id. Ignored when `chain` is supplied. */
  assetId?: AssetId;
  /** Prebuilt fallback chain, e.g. a hero pose set. */
  chain?: string[];
  alt: string;
  className?: string;
  style?: CSSProperties;
  draggable?: boolean;
};

/**
 * Renders a registered asset and silently walks its fallback chain if a file
 * is missing. A broken or absent asset can never crash or blank the screen -
 * it degrades to the next fallback, and finally to inline artwork.
 */
export const AssetImg = ({ assetId, chain, alt, className, style, draggable }: AssetImgProps) => {
  const sources = chain && chain.length > 0 ? chain : getFallbackChain(assetId ?? '');
  const primary = sources[0] ?? '';

  // The cursor resets when the asset changes. Done during render rather than
  // in an effect so a swapped asset never paints a stale fallback.
  const [cursor, setCursor] = useState({ primary, index: 0 });
  if (cursor.primary !== primary) setCursor({ primary, index: 0 });
  const index = cursor.index;

  return (
    <img
      className={className}
      style={style}
      src={sources[Math.min(index, sources.length - 1)]}
      alt={alt}
      draggable={draggable ?? false}
      onError={() =>
        setCursor((current) => ({
          ...current,
          index: Math.min(current.index + 1, sources.length - 1),
        }))
      }
    />
  );
};
