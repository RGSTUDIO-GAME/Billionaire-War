import { useEffect } from 'react';
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
import { prefetchAllAssets } from '../assets/resolve';
import { initTelegram } from '../services/telegram';
import { audio } from '../audio/audioManager';
import { useBattleStore } from '../state/battleStore';
import { usePlayerStore } from '../state/playerStore';
import { useSettingsStore } from '../state/settingsStore';
import { useUiStore } from '../state/uiStore';
import type { Screen } from '../state/uiStore';

export const App = () => {
  const stack = useUiStore((state) => state.stack);
  const navigate = useUiStore((state) => state.navigate);
  const back = useUiStore((state) => state.back);
  const resetNav = useUiStore((state) => state.reset);

  const sfx = useSettingsStore((state) => state.sfx);
  const music = useSettingsStore((state) => state.music);

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
      onBwarPress={openMining}
    >
      {entry.screen === 'home' ? (
        <HomeScreen onWar={() => navigate('war-entry')} onMining={() => goTo('mining-select')} />
      ) : null}
      {entry.screen === 'quest' ? <QuestScreen onBack={back} /> : null}
      {entry.screen === 'inventory' ? <InventoryScreen onBack={back} onBwarPress={openMining} /> : null}
      {entry.screen === 'hero' ? <HeroScreen onBack={back} /> : null}
      {entry.screen === 'settings' ? <SettingsScreen onBack={back} /> : null}
      {entry.screen === 'leaderboard' ? <LeaderboardScreen onBack={back} /> : null}
      {entry.screen === 'war-entry' ? (
        <WarEntryScreen onBack={back} onBattleStart={() => navigate('battle')} />
      ) : null}
      {entry.screen === 'mining-select' ? (
        <MiningSelectScreen onBack={back} onEquip={() => goTo('mining')} />
      ) : null}
      {entry.screen === 'mining' ? (
        <MiningScreen onBack={back} onChangeHero={() => navigate('mining-select')} />
      ) : null}
    </AppShell>
  );
};
