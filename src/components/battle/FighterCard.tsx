import { BODY_PART_LABELS } from '../../data/balance';
import type { BodyPart } from '../../data/balance';
import type { FighterView } from '../../presentation/battleView';

const part = (value: BodyPart | null): string => (value === null ? '—' : BODY_PART_LABELS[value]);

type FighterCardProps = {
  fighter: FighterView;
  side: 'A' | 'B';
  label: string;
};

const hpTone = (percent: number): string => {
  if (percent > 60) return 'is-high';
  if (percent > 30) return 'is-mid';
  return 'is-low';
};

/**
 * The always-visible fighter readout: name, HP, HP bar and the two targets.
 *
 * Before execution the targets read LOCKED - the opponent's choice is never
 * shown early, and nothing here computes a value.
 */
export const FighterCard = ({ fighter, side, label }: FighterCardProps) => (
  <section className={`fighter-card fighter-card--${side === 'A' ? 'left' : 'right'}`}>
    <div className="fighter-card__head">
      <span className="fighter-card__label">{label}</span>
      <span className="fighter-card__name">{fighter.name}</span>
    </div>

    <div className="hp">
      <div className="hp__value">
        <span className="hp__current">{fighter.hp}</span>
        <span className="hp__max"> / {fighter.maxHp}</span>
      </div>
      <div
        className={`hp__track ${hpTone(fighter.hpPercent)}`}
        role="progressbar"
        aria-valuenow={fighter.hp}
        aria-valuemin={0}
        aria-valuemax={fighter.maxHp}
        aria-label={`${fighter.name} HP`}
      >
        <div className="hp__fill" style={{ width: `${fighter.hpPercent}%` }} />
      </div>
    </div>

    <div className="fighter-card__targets">
      {fighter.attack === null && fighter.defense === null ? (
        <span className="chip chip--locked">ATK ??? · DEF ???</span>
      ) : (
        <>
          <span className="chip chip--atk">
            ATK <b>{part(fighter.attack)}</b>
          </span>
          <span className="chip chip--def">
            DEF <b>{part(fighter.defense)}</b>
          </span>
        </>
      )}
    </div>

    {fighter.defeated ? <span className="fighter-card__ko">KO</span> : null}
  </section>
);
