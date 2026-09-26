import { useState } from 'react';
import { backgroundIds, iconIds } from '../assets/manifest';
import { getHeroById } from '../data/heroes';
import { usePlayerStore } from '../state/playerStore';
import { useBattleStore } from '../state/battleStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SceneCard } from '../components/ui/SceneCard';
import { ComingSoon } from '../components/ui/ComingSoon';
import { HeroAvatar } from '../components/hero/HeroAvatar';
import { Modal } from '../components/ui/Modal';
import { ScreenHeader } from '../components/ui/ScreenHeader';

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
  const ownedHeroIds = usePlayerStore((state) => state.ownedHeroIds);
  const startBattle = useBattleStore((state) => state.start);

  const playerHero = getHeroById(equippedHeroId);
  // The bot can only field heroes that exist. Until a second hero ships, this
  // is a mirror match - no placeholder opponent is invented.
  const opponentHeroId =
    ownedHeroIds.find((id) => id !== equippedHeroId) ?? equippedHeroId;
  const opponentHero = getHeroById(opponentHeroId);
  const isMirror = opponentHeroId === equippedHeroId;

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
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="center stack grow" style={{ gap: 'var(--s-2)' }}>
              <HeroAvatar hero={playerHero} size="md" />
              <div className="display" style={{ fontSize: 14 }}>
                {playerHero.name}
              </div>
            </div>
            <span className="battle__versus" style={{ paddingBottom: 0 }}>
              VS
            </span>
            <div className="center stack grow" style={{ gap: 'var(--s-2)' }}>
              <HeroAvatar hero={opponentHero} size="md" />
              <div className="display" style={{ fontSize: 14 }}>
                {opponentHero.name}
              </div>
            </div>
          </div>

          {isMirror ? (
            <p className="muted center" style={{ fontSize: 12, marginTop: 'var(--s-3)' }}>
              Mirror match - only one hero is available so far. Adding a hero needs data + assets only.
            </p>
          ) : null}
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
