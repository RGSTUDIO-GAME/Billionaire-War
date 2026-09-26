import { CurrencyPill } from '../ui/CurrencyPill';
import { Icon } from '../ui/Icon';
import { iconIds } from '../../assets/manifest';
import { usePlayerStore } from '../../state/playerStore';

type TopBarProps = {
  onLeaderboard: () => void;
  onBwarPress: () => void;
};

export const TopBar = ({ onLeaderboard, onBwarPress }: TopBarProps) => {
  const gold = usePlayerStore((state) => state.gold);
  const bwar = usePlayerStore((state) => state.bwar);

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__title">BILLIONAIRE WAR</span>
        <span className="topbar__sub">Season 0 &middot; Foundation</span>
      </div>

      <div className="topbar__actions">
        <CurrencyPill kind="bwar" value={bwar} locked onClick={onBwarPress} />
        <CurrencyPill kind="gold" value={gold} />
        <button type="button" className="icon-btn" onClick={onLeaderboard} aria-label="Leaderboard">
          <Icon assetId={iconIds.trophy} alt="" />
        </button>
      </div>
    </header>
  );
};
