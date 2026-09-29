import { AssetImg } from '../../assets/AssetImg';
import { iconIds } from '../../assets/manifest';
import { haptic } from '../../services/telegram';
import type { Screen } from '../../state/uiStore';

type NavItem = { screen: Screen; label: string; icon: string };

const ITEMS: NavItem[] = [
  { screen: 'quest', label: 'Quest', icon: iconIds.quest },
  { screen: 'hero', label: 'Hero', icon: iconIds.hero },
  { screen: 'home', label: 'Home', icon: iconIds.home },
  { screen: 'inventory', label: 'Items', icon: iconIds.inventory },
  { screen: 'settings', label: 'Settings', icon: iconIds.settings },
];

type BottomNavProps = {
  active: Screen;
  onNavigate: (screen: Screen) => void;
};

export const BottomNav = ({ active, onNavigate }: BottomNavProps) => (
  <nav className="bottomnav" aria-label="Main menu">
    {ITEMS.map((item) => (
      <button
        key={item.screen}
        type="button"
        className={`bottomnav__item${active === item.screen ? ' is-active' : ''}`}
        aria-label={item.label}
        aria-current={active === item.screen ? 'page' : undefined}
        onClick={() => {
          haptic.select();
          onNavigate(item.screen);
        }}
      >
        <AssetImg assetId={item.icon} alt={item.label} className="bottomnav__img" />
      </button>
    ))}
  </nav>
);
