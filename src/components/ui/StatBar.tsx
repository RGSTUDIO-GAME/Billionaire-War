type StatBarProps = {
  value: number;
  max: number;
  label?: string;
  showValue?: boolean;
};

const ratio = (value: number, max: number): number => (max <= 0 ? 0 : Math.max(0, Math.min(1, value / max)));

const toneClass = (percent: number): string => {
  if (percent > 0.6) return 'is-high';
  if (percent > 0.3) return 'is-mid';
  return '';
};

/** HP bar. Colour shifts green -> gold -> red as the value drops. */
export const StatBar = ({ value, max, label, showValue = true }: StatBarProps) => {
  const percent = ratio(value, max) * 100;
  return (
    <div>
      {label !== undefined || showValue ? (
        <div className="statbar__row">
          {label !== undefined ? <span>{label}</span> : <span />}
          {showValue ? <span className="statbar__value">{value} / {max}</span> : null}
        </div>
      ) : null}
      <div
        className={`statbar statbar--hp ${toneClass(ratio(value, max))}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className="statbar__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};
