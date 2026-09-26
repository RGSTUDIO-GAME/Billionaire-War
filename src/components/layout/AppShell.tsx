import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { getAssetUrl } from '../../assets/resolve';
import { backgroundIds } from '../../assets/manifest';
import { bindBackButton } from '../../services/telegram';
import type { Screen } from '../../state/uiStore';

type AppShellProps = {
  active: Screen;
  onBack: () => void;
  onNavigate: (screen: Screen) => void;
  onLeaderboard: () => void;
  onBwarPress: () => void;
  flush?: boolean;
  children: ReactNode;
};

export const AppShell = ({
  active,
  onBack,
  onNavigate,
  onLeaderboard,
  onBwarPress,
  flush = false,
  children,
}: AppShellProps) => {
  // Telegram's native back button mirrors the in-app one.
  useEffect(() => bindBackButton(onBack, active !== 'home'), [onBack, active]);

  return (
    <>
      <div
        className="app-bg"
        style={{ backgroundImage: `url("${getAssetUrl(backgroundIds.menu)}")` }}
        aria-hidden="true"
      />
      <div className="app-shell">
        <TopBar onLeaderboard={onLeaderboard} onBwarPress={onBwarPress} />
        <main className={`app-main${flush ? ' app-main--flush' : ''}`}>{children}</main>
        <BottomNav active={active} onNavigate={onNavigate} />
      </div>
    </>
  );
};
