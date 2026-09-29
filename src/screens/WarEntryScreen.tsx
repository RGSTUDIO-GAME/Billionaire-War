import { useMemo, useState } from 'react';
import { AssetImg } from '../assets/AssetImg';
import { RarityBadge } from '../components/hero/RarityBadge';
import { backgroundIds, heroPortraitIds, iconIds } from '../assets/manifest';
import { HEROES, getHeroById } from '../data/heroes';
import { usePlayerStore } from '../state/playerStore';
import { useBattleStore } from '../state/battleStore';
import { runtime } from '../state/runtime';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SceneCard } from '../components/ui/SceneCard';
import { ComingSoon } from '../components/ui/ComingSoon';
import { Modal } from '../components/ui/Modal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { StatBar } from '../components/ui/StatBar';

type WarEntryScreenProps = {
  onBack: () => void;
  onBattleStart: () => void;
};

/**
 * WAR entry point.
 * VS BOT is playable. PVP shows the navigation only - matchmaking is not
 * implemented, so no fake queue or fake opponent is simulated.
 */
export const WarEntryScreen = ({ onBack, onBattleStart }: WarEntryScreenProps) => {
  const [pvpOpen, setPvpOpen] = useState(false);

  const equippedHeroId = usePlayerStore((state) => state.equippedHeroId);
  const playerId = usePlayerStore((state) => state.playerId);
  const startBattle = useBattleStore((state) => state.start);

  const playerHero = getHeroById(equippedHeroId);
  // The bot fields a random hero that differs from the player's. Mirror
  // matches only happen when a single hero exists at all.
  const botPool = HEROES.filter((hero) => hero.id !== equippedHeroId);
  const opponentHero =
    botPool[Math.floor(Math.random() * botPool.length)] ?? playerHero;

  const record = useMemo(() => {
    const history = runtime.battleService.history.list(playerId || undefined);
    return {
      wins: history.filter((entry) => entry.result === 'VICTORY').length,
      losses: history.filter((entry) => entry.result === 'DEFEAT').length,
      draws: history.filter((entry) => entry.result === 'DRAW').length,
    };
  }, [playerId]);

  if (!playerHero || !opponentHero) return null;

  const startBotBattle = () => {
    startBattle('bot', playerHero, opponentHero, Date.now() >>> 0);
    onBattleStart();
  };

  return (
    <div className="anim-fade">
      <ScreenHeader title="War" subtitle="1 vs 1 auto battle - 3 rounds" onBack={onBack} />

      <div className="stack-lg" style={{ gap: 'var(--s-4)' }}>
        <SceneCard background={backgroundIds.battleArena}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="home-portrait">
              <AssetImg
                assetId={heroPortraitIds[playerHero.id] ?? heroPortraitIds.durov}
                alt={playerHero.name}
              />
            </div>
            <div className="stack grow" style={{ minWidth: 0 }}>
              <Badge tone="gold">Your fighter</Badge>
              <h2 className="display" style={{ fontSize: 24, color: 'var(--gold)' }}>
                {playerHero.name}
              </h2>
              <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  HP {playerHero.hp}
                </span>
                <RarityBadge rarity={playerHero.rarity} />
              </div>
              <div style={{ marginTop: 'var(--s-2)' }}>
                <StatBar value={playerHero.hp} max={playerHero.hp} label="Base HP" />
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                W {record.wins} &middot; L {record.losses} &middot; D {record.draws}
              </div>
            </div>
          </div>
        </SceneCard>

        <div className="stack">
          <div className="section-title" style={{ margin: 0 }}>
            Battle mode
          </div>

          <button type="button" className="list-row" onClick={() => setPvpOpen(true)}>
            <Badge tone="gold">PVP</Badge>
            <span className="list-row__main">
              <span className="list-row__title">Player vs Player</span>
              <span className="list-row__sub">Matchmaking is not implemented yet</span>
            </span>
            <Badge tone="muted">Soon</Badge>
          </button>

          <Button variant="primary" size="lg" block icon={iconIds.robot} onClick={startBotBattle}>
            Vs Bot
          </Button>
        </div>

        <Card flat>
          <div className="card__title" style={{ marginBottom: 'var(--s-2)' }}>
            How a round works
          </div>
          <ol className="stack" style={{ gap: 'var(--s-1)', fontSize: 12, color: 'var(--text-dim)' }}>
            <li>1. Pick one ATTACK part and one DEFENSE part.</li>
            <li>2. Press CONFIRM - your choice is locked.</li>
            <li>3. 3 - 2 - 1 - FIGHT, then both heroes act in the same round.</li>
            <li>4. Hit the part your opponent defends and you deal 0 damage.</li>
            <li>5. After 3 rounds: HP 0 loses, higher HP wins, equal HP is a draw.</li>
          </ol>
        </Card>
      </div>

      <Modal open={pvpOpen} title="PvP" onClose={() => setPvpOpen(false)}>
        <ComingSoon
          icon={iconIds.user}
          title="Matchmaking"
          description="Player vs Player needs a real matchmaking service and a battle record to rank against. This build ships the navigation only - no fake queue and no fake opponent."
        />
      </Modal>
    </div>
  );
};
