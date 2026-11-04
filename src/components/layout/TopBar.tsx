import { AssetImg } from '../../assets/AssetImg';
import { CurrencyPill } from '../ui/CurrencyPill';
import { Icon } from '../ui/Icon';
import { iconIds } from '../../assets/manifest';
import { usePlayerStore } from '../../state/playerStore';

type TopBarProps = {
  onLeaderboard: () => void;
  onProfile: () => void;
  onBwarPress: () => void;
};

export const TopBar = ({ onLeaderboard, onProfile, onBwarPress }: TopBarProps) => {
  const gold = usePlayerStore((state) => state.gold);
  const bwar = usePlayerStore((state) => state.bwar);

  return (
    <header className="topbar">
      <button type="button" className="topbar__brand topbar__brand-button" onClick={onProfile} aria-label="Open player profile">
        <AssetImg assetId={iconIds.logo} alt="Billionaire War" className="topbar__logo" />
      </button>

      <div className="topbar__actions">
        <CurrencyPill kind="bwar" value={bwar} onClick={onBwarPress} />
        <CurrencyPill kind="gold" value={gold} />
        <button type="button" className="icon-btn" onClick={onLeaderboard} aria-label="Leaderboard">
          <Icon assetId={iconIds.trophy} alt="" />
        </button>
      </div>
    </header>
  );
};
