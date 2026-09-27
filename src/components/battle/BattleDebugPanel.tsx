import { BODY_PART_LABELS } from '../../data/balance';
import type { BodyPart } from '../../data/balance';
import type { BattleState } from '../../engine/types';
import { BATTLE_STATUS } from '../../engine/types';

type BattleDebugPanelProps = {
  battle: BattleState;
};

const part = (value: BodyPart | null): string => (value === null ? 'NONE' : BODY_PART_LABELS[value]);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="row-between" style={{ fontSize: 11 }}>
    <span className="muted">{label}</span>
    <span style={{ fontFamily: 'ui-monospace, monospace' }}>{value}</span>
  </div>
);

/**
 * Battle inspector. Reads the live engine state, so it can never disagree
 * with the real rules. Shown open once the round is confirmed; the rows live
 * in a fixed scrollbox so the arena above never moves.
 */
export const BattleDebugPanel = ({ battle }: BattleDebugPanelProps) => (
  <details className="card card--tight battle-debug" open>
    <summary style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)' }}>
      Debug · {BATTLE_STATUS[battle.status]}
    </summary>

    <div className="battle-debug__rows">
      <Row label="Battle" value={battle.battleId} />
      <Row label="Mode / Round" value={`${battle.mode.toUpperCase()} ${battle.currentRound}/3`} />
      <Row label="Clock" value={battle.countdown === null ? `${battle.secondsRemaining}s` : `CD ${battle.countdown}`} />
      <hr className="divider" />
      <Row label="A attack / defense" value={`${part(battle.playerA.attackTarget)} / ${part(battle.playerA.defenseTarget)}`} />
      <Row label="A confirmed / HP" value={`${battle.playerA.confirmed} · ${battle.playerA.currentHp}`} />
      <Row label="B attack / defense" value={`${part(battle.playerB.attackTarget)} / ${part(battle.playerB.defenseTarget)}`} />
      <Row label="B confirmed / HP" value={`${battle.playerB.confirmed} · ${battle.playerB.currentHp}`} />
      <hr className="divider" />
      <Row label="Rounds played" value={String(battle.roundHistory.length)} />
      <Row label="Winner" value={battle.winner ?? '-'} />
    </div>
  </details>
);
