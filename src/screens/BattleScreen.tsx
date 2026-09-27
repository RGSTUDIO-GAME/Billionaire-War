import { useEffect } from 'react';
import { getAssetUrl } from '../assets/resolve';
import { prefetchHeroFrames } from '../assets/heroAssets';
import { backgroundIds, iconIds } from '../assets/manifest';
import { Icon } from '../components/ui/Icon';
import { getHeroById } from '../data/heroes';
import { useBattleFlow } from '../hooks/useBattleFlow';
import { useBattleReward } from '../hooks/useBattleReward';
import { useBattleStore } from '../state/battleStore';
import { usePlayerStore } from '../state/playerStore';
import { buildBattleView } from '../presentation/battleView';
import { isDebugEnabled } from '../engine/debug';
import { BattleLog } from '../components/battle/BattleLog';
import { BattleDebugPanel } from '../components/battle/BattleDebugPanel';
import { BattleResultOverlay } from '../components/battle/BattleResultOverlay';
import { FighterCard } from '../components/battle/FighterCard';
import { FighterSprite } from '../components/battle/FighterSprite';
import { RoundBanner } from '../components/battle/RoundBanner';
import { RoundTimer } from '../components/battle/RoundTimer';
import { SelectionPanel } from '../components/battle/SelectionPanel';

type BattleScreenProps = {
  onExit: () => void;
  onRematch: () => void;
};

/**
 * The battle arena.
 *
 * This screen holds no rules. It reads one view model built by the
 * presentation layer and sends back intent; the Battle Engine decides
 * everything that happens next.
 *
 *   ENGINE -> EVENTS -> PRESENTATION -> THIS SCREEN
 */
export const BattleScreen = ({ onExit, onRematch }: BattleScreenProps) => {
  const battle = useBattleStore((state) => state.battle);
  const lastReward = usePlayerStore((state) => state.lastReward);
  const gold = usePlayerStore((state) => state.gold);

  useBattleFlow();
  const heroAId = battle?.playerA.heroId;
  const heroBId = battle?.playerB.heroId;
  // Warm the frame strips when a battle opens so the first cue plays instantly.
  // Startup prefetch skips frames on purpose - 16MB has no business on boot.
  useEffect(() => {
    const a = heroAId ? getHeroById(heroAId) : undefined;
    const b = heroBId ? getHeroById(heroBId) : undefined;
    if (a) prefetchHeroFrames(a);
    if (b) prefetchHeroFrames(b);
  }, [heroAId, heroBId]);
  // The reward is a battle outcome, not a battle rule, so it lives in its own
  // hook. The view is built before it runs, because the reward is keyed by the
  // battle it belongs to.
  const view = battle ? buildBattleView(battle) : null;
  useBattleReward(view?.battleId ?? null, view?.showResult ?? false);

  const selectAttack = useBattleStore((state) => state.selectAttack);
  const selectDefense = useBattleStore((state) => state.selectDefense);
  const confirmPlayer = useBattleStore((state) => state.confirmPlayer);

  if (!battle || !view) return null;

  const playerHero = getHeroById(battle.playerA.heroId);
  const opponentHero = getHeroById(battle.playerB.heroId);
  if (!playerHero || !opponentHero) return null;

  // Only show a reward that belongs to THIS battle - a rematch never inherits
  // the previous payout.
  const reward = lastReward?.battleId === view.battleId ? lastReward : null;

  return (
    <div
      className="battle"
      style={{ backgroundImage: `url("${getAssetUrl(backgroundIds.battleArena)}")` }}
    >
      <div className="battle__top">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="Flee battle">
          <Icon assetId={iconIds.back} alt="" />
        </button>

        <div className="battle__round">
          <div className="battle__mode">{view.mode === 'bot' ? 'VS BOT' : 'VS PLAYER'}</div>
          <div className="battle__round-label">{view.roundLabel}</div>
          <div className="battle__pips" aria-hidden="true">
            {Array.from({ length: view.totalRounds }, (_, index) => {
              const round = index + 1;
              const done = battle.roundHistory.some((entry) => entry.round === round);
              return (
                <span
                  key={round}
                  className={`battle__pip${done ? ' is-done' : ''}${round === view.round ? ' is-current' : ''}`}
                />
              );
            })}
          </div>
        </div>

        {view.showSelection ? (
          <RoundTimer secondsLeft={view.secondsLeft} />
        ) : (
          <span className="grow" />
        )}
      </div>

      <div className="battle__cards">
        <FighterCard fighter={view.fighters.A} side="A" label="YOUR HP" />
        <FighterCard fighter={view.fighters.B} side="B" label="ENEMY HP" />
      </div>

      <div className="battle__arena">
        <FighterSprite fighter={view.fighters.A} hero={playerHero} />
        <span className="battle__versus">VS</span>
        <FighterSprite fighter={view.fighters.B} hero={opponentHero} />
      </div>

      <div className="battle__log">
        <BattleLog log={view.log} />
      </div>

      <div className="battle__panel">
        {view.showSelection ? (
          <SelectionPanel
            selection={view.selection}
            onAttack={selectAttack}
            onDefense={selectDefense}
            onConfirm={confirmPlayer}
          />
        ) : view.banner ? (
          <RoundBanner banner={view.banner} />
        ) : view.showCountdown ? (
          <div className="battle__locked">
            <span className="battle__locked-label">Both choices locked</span>
            <span className="muted" style={{ fontSize: 12 }}>
              Get ready.
            </span>
          </div>
        ) : (
          <div className="battle__locked">
            <span className="battle__locked-label">Round {view.round} in progress</span>
            <span className="muted" style={{ fontSize: 12 }}>
              Both fighters act in the same round.
            </span>
          </div>
        )}

        {isDebugEnabled() ? (
          <div style={{ marginTop: 'var(--s-3)' }}>
            <BattleDebugPanel battle={battle} />
          </div>
        ) : null}
      </div>

      {view.showCountdown && view.countdown !== null ? (
        <div className="battle__overlay">
          <span
            className={`countdown${view.countdown === 0 ? ' countdown--fight' : ''}`}
            key={view.countdown}
          >
            {view.countdown === 0 ? 'FIGHT!' : view.countdown}
          </span>
        </div>
      ) : null}

      {view.showResult && view.summary ? (
        <BattleResultOverlay
          summary={view.summary}
          hero={playerHero}
          reward={reward}
          goldBalance={gold}
          onRematch={onRematch}
          onExit={onExit}
        />
      ) : null}
    </div>
  );
};
