import { iconIds } from '../assets/manifest';
import { ComingSoon } from '../components/ui/ComingSoon';
import { ScreenHeader } from '../components/ui/ScreenHeader';

type LeaderboardScreenProps = { onBack: () => void };

/**
 * The leaderboard is intentionally not implemented.
 * No dummy rankings, no fake players - just a clear "coming soon".
 */
export const LeaderboardScreen = ({ onBack }: LeaderboardScreenProps) => (
  <div className="anim-fade">
    <ScreenHeader title="Leaderboard" subtitle="Global rankings" onBack={onBack} />
    <ComingSoon
      icon={iconIds.trophy}
      title="Leaderboard"
      description="Rankings require a real backend and a finished battle record. Nothing is faked here - it ships when the ranking system does."
      onBack={onBack}
    />
  </div>
);
