import { BODY_PART_LABELS } from '../../data/balance';
import type { BodyPart } from '../../data/balance';
import type { AttackRecord } from '../../engine/types';

type BattleLogProps = {
  /** The resolved attacks of the current round, in execution order. */
  log: AttackRecord[];
};

const describe = (label: string, attackTarget: BodyPart | null, outcome: string, damage: number) => {
  if (attackTarget === null) return `${label}: NO ACTION`;
  const part = BODY_PART_LABELS[attackTarget];
  if (outcome === 'BLOCK') return `${label}: ${part} BLOCKED`;
  return `${label}: ${part} -${damage}`;
};

/** Running commentary of the round. Reads the engine's attack records only. */
export const BattleLog = ({ log }: BattleLogProps) => {
  if (log.length === 0) {
    return <span className="battle__log-item">CHOICES ARE HIDDEN UNTIL FIGHT</span>;
  }

  return (
    <>
      {log.map((attack) => (
        <span
          key={`${attack.attacker}-${attack.order}`}
          className={`battle__log-item is-${
            attack.outcome === 'HIT' ? 'hit' : attack.outcome === 'BLOCK' ? 'blocked' : 'idle'
          }`}
        >
          {describe(attack.attacker === 'A' ? 'YOU' : 'ENEMY', attack.attackTarget, attack.outcome, attack.damage)}
        </span>
      ))}
    </>
  );
};
