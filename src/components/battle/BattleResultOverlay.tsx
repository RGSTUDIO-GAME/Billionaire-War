import { AnimatedSprite } from './AnimatedSprite';
import { heroAssetChain, heroFrameUrls } from '../../assets/heroAssets';
import type { Hero } from '../../data/heroes/types';
import type { GoldTransaction } from '../../rewards';
import type { BattleSummary } from '../../presentation/battleView';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

type BattleResultOverlayProps = {
  summary: BattleSummary;
  hero: Hero;
  /** The payout for THIS battle, or null while it is still being settled. */
  reward: GoldTransaction | null;
  /** $GOLD after the payout. */
  goldBalance: number;
  onRematch: () => void;
  onExit: () => void;
};

const TITLE: Record<'A' | 'B' | 'DRAW', { text: string; className: string }> = {
  A: { text: 'VICTORY', className: 'is-win' },
  B: { text: 'DEFEAT', className: 'is-lose' },
  DRAW: { text: 'DRAW', className: 'is-draw' },
};

const MODE_LABEL = { bot: 'VS BOT', pvp: 'PVP' } as const;

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="battle-result__stat">
    <span className="battle-result__stat-label">{label}</span>
    <span className="battle-result__stat-value">{value}</span>
  </div>
);

/**
 * End of battle card: the outcome, both final HP pools, the round count, the
 * damage totals the engine archived, and the $GOLD the Reward Engine granted.
 *
 * Every number is read from engine or reward state - the card decides nothing.
 */
export const BattleResultOverlay = ({
  summary,
  hero,
  reward,
  goldBalance,
  onRematch,
  onExit,
}: BattleResultOverlayProps) => {
  const key = summary.winner ?? 'DRAW';
  const title = TITLE[key];
  const pose = key === 'A' ? 'victory' : key === 'B' ? 'defeat' : 'idle';

  return (
    <Modal open title={`Round ${summary.rounds} complete`} onClose={onExit}>
      <div className="center stack">
        <div className="battle-result__sprite">
          <AnimatedSprite
            frames={heroFrameUrls(hero, { type: pose })}
            still={heroAssetChain(hero, { type: pose })}
            loop={pose === 'idle'}
            alt={hero.name}
          />
        </div>

        <h2 className={`battle-result__title ${title.className}`}>{title.text}</h2>

        <div className="battle-result__stats">
          <div>
            <div className="muted" style={{ fontSize: 10, letterSpacing: '0.14em' }}>
              {summary.playerA.name}
            </div>
            <div className="battle-result__hp-value">
              {summary.playerA.hp}
              <span className="muted" style={{ fontSize: 12 }}> / {summary.playerA.maxHp}</span>
            </div>
          </div>
          <span className="gold display">VS</span>
          <div>
            <div className="muted" style={{ fontSize: 10, letterSpacing: '0.14em' }}>
              {summary.playerB.name}
            </div>
            <div className="battle-result__hp-value">
              {summary.playerB.hp}
              <span className="muted" style={{ fontSize: 12 }}> / {summary.playerB.maxHp}</span>
            </div>
          </div>
        </div>

        <div className="battle-result__numbers">
          <Stat label="Rounds" value={`${summary.rounds} / 3`} />
          <Stat label="Damage dealt" value={`${summary.playerA.damageDealt}`} />
          <Stat label="Damage taken" value={`${summary.playerA.damageTaken}`} />
        </div>

        {reward ? (
          <div className="battle-result__reward is-granted">
            <div className="battle-result__reward-head">
              <span className="badge badge--gold">REWARD</span>
              <span className="muted" style={{ fontSize: 10, letterSpacing: '0.12em' }}>
                {reward.mode ? `${MODE_LABEL[reward.mode]} · ` : ''}
                {reward.result ?? 'REWARD'}
              </span>
            </div>
            <div className="battle-result__amount">
              +{reward.amount.toLocaleString('en-US')} <span className="gold">GOLD</span>
            </div>
            <div className="muted" style={{ fontSize: 11 }}>
              Balance {goldBalance.toLocaleString('en-US')} GOLD
            </div>
          </div>
        ) : (
          <div className="battle-result__reward">
            <span className="badge badge--gold">REWARD</span>
            <span className="muted" style={{ fontSize: 12 }}>
              Settling...
            </span>
          </div>
        )}

        <div className="battle-result__actions">
          <Button variant="primary" block onClick={onRematch}>
            Battle again
          </Button>
          <Button variant="ghost" block onClick={onExit}>
            Home
          </Button>
        </div>
      </div>
    </Modal>
  );
};
