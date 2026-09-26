import { SELECTION_TIME_SECONDS } from '../../data/balance';

const RADIUS = 15.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type RoundTimerProps = {
  secondsLeft: number;
  total?: number;
};

export const RoundTimer = ({ secondsLeft, total = SELECTION_TIME_SECONDS }: RoundTimerProps) => {
  const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, secondsLeft / total));
  const urgent = secondsLeft <= 5;

  return (
    <div className={`timer${urgent ? ' is-urgent' : ''}`} aria-label={`${secondsLeft} seconds left`}>
      <svg className="timer__ring" viewBox="0 0 36 36" aria-hidden="true">
        <circle className="bg" cx="18" cy="18" r={RADIUS} />
        <circle
          className="fg"
          cx="18"
          cy="18"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
        />
      </svg>
      <span>{secondsLeft}</span>
    </div>
  );
};
