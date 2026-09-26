import type { RoundBannerView } from '../../presentation/battleView';

type RoundBannerProps = {
  banner: RoundBannerView;
};

/**
 * The between-round beat. Replaces the selection panel while the round
 * summary is on screen, so the player is never asked to pick while the
 * previous round is still being read.
 */
export const RoundBanner = ({ banner }: RoundBannerProps) => (
  <div className={`round-banner round-banner--${banner.tone}`} role="status">
    <span className="round-banner__title">{banner.title}</span>
    <span className="round-banner__hint">{banner.hint}</span>
  </div>
);
