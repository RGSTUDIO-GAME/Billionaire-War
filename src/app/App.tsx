import { useEffect, useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { HomeScreen } from '../screens/HomeScreen';
import { QuestScreen } from '../screens/QuestScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { HeroScreen } from '../screens/HeroScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { WarEntryScreen } from '../screens/WarEntryScreen';
import { BattleScreen } from '../screens/BattleScreen';
import { MiningScreen } from '../screens/MiningScreen';
import { MiningSelectScreen } from '../screens/MiningSelectScreen';
import { TradeScreen } from '../screens/TradeScreen';
import { GachaScreen } from '../screens/GachaScreen';
import { FarmScreen } from '../screens/FarmScreen';
import { prefetchAllAssets } from '../assets/resolve';
import { initTelegram } from '../services/telegram';
import { audio } from '../audio/audioManager';
import { useBattleStore } from '../state/battleStore';
import { usePlayerStore } from '../state/playerStore';
import { useSettingsStore } from '../state/settingsStore';
import { useUiStore } from '../state/uiStore';
import type { Screen } from '../state/uiStore';
import { ProfileModal } from '../components/player/ProfileModal';
import { Modal } from '../components/ui/Modal';
import { ComingSoon } from '../components/ui/ComingSoon';
import { Button } from '../components/ui/Button';

export const App = () => {
  const stack = useUiStore((state) => state.stack);
  const navigate = useUiStore((state) => state.navigate);
  const back = useUiStore((state) => state.back);
  const resetNav = useUiStore((state) => state.reset);

  const sfx = useSettingsStore((state) => state.sfx);
  const music = useSettingsStore((state) => state.music);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bwarActionsOpen, setBwarActionsOpen] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null);

  useEffect(() => {
    initTelegram();
    prefetchAllAssets();
  }, []);

  useEffect(() => {
    audio.setMuted(!sfx);
  }, [sfx]);

  useEffect(() => {
    audio.setMusicEnabled(music);
  }, [music]);

  const entry = stack[stack.length - 1] ?? { screen: 'home' as Screen };

  /** Bottom-nav navigation always restarts from the root. */
  const goTo = (screen: Screen) => {
    resetNav();
    navigate(screen);
  };

  const exitBattle = () => {
    useBattleStore.getState().reset();
    goTo('home');
  };

  const openMining = () => {
    const hasMining = usePlayerStore.getState().mining !== null;
    goTo(hasMining ? 'mining' : 'mining-select');
  };

  if (entry.screen === 'battle') {
    return (
      <BattleScreen
        onExit={exitBattle}
        onRematch={() => useBattleStore.getState().rematch()}
      />
    );
  }

  return (
    <AppShell
      active={entry.screen}
      onBack={back}
      onNavigate={goTo}
      onLeaderboard={() => goTo('leaderboard')}
      onProfile={() => setProfileOpen(true)}
      onBwarPress={() => setBwarActionsOpen(true)}
    >
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <Modal
        open={bwarActionsOpen}
        title="$BWAR Token"
        onClose={() => setBwarActionsOpen(false)}
        footer={(
          <div className="row" style={{ marginTop: 'var(--s-4)' }}>
            <Button variant="ghost" disabled style={{ flex: 1 }}>Swap</Button>
            <Button variant="ghost" disabled style={{ flex: 1 }}>Withdraw</Button>
          </div>
        )}
      >
        <ComingSoon
          title="Swap & Withdraw"
          description="$BWAR token exchange and withdrawal will be available in a future update."
        />
      </Modal>
      <Modal
        open={comingSoonFeature !== null}
        title={comingSoonFeature ?? 'Coming Soon'}
        onClose={() => setComingSoonFeature(null)}
      >
        <ComingSoon
          title={comingSoonFeature ?? 'Coming Soon'}
          description={`${comingSoonFeature ?? 'This feature'} will be available in a future update.`}
        />
      </Modal>
      {entry.screen === 'home' ? (
        <HomeScreen
          onPlay={() => navigate('war-entry')}
          onGacha={() => navigate('gacha')}
          onMining={() => goTo('mining-select')}
          onTrade={() => navigate('trade')}
          onShop={() => setComingSoonFeature('Shop')}
          onDailyMission={() => setComingSoonFeature('Daily Mission')}
          onCrafting={() => setComingSoonFeature('Crafting')}
        />
      ) : null}
      {entry.screen === 'gacha' ? <GachaScreen onBack={back} /> : null}
      {entry.screen === 'farm' ? <FarmScreen onBack={back} /> : null}
      {entry.screen === 'quest' ? <QuestScreen onBack={back} /> : null}
      {entry.screen === 'inventory' ? (
        <InventoryScreen onBack={back} onBwarPress={openMining} onTrade={() => navigate('trade')} />
      ) : null}
      {entry.screen === 'hero' ? <HeroScreen onBack={back} onMining={openMining} /> : null}
      {entry.screen === 'settings' ? <SettingsScreen onBack={back} /> : null}
      {entry.screen === 'leaderboard' ? <LeaderboardScreen onBack={back} /> : null}
      {entry.screen === 'war-entry' ? (
        <WarEntryScreen onBack={back} onBattleStart={() => navigate('battle')} onFarm={() => navigate('farm')} />
      ) : null}
      {entry.screen === 'mining-select' ? (
        <MiningSelectScreen onBack={back} onEquip={() => goTo('mining')} />
      ) : null}
      {entry.screen === 'mining' ? (
        <MiningScreen onBack={back} onChangeHero={() => navigate('mining-select')} />
      ) : null}
      {entry.screen === 'trade' ? <TradeScreen onBack={back} /> : null}
    </AppShell>
  );
};
