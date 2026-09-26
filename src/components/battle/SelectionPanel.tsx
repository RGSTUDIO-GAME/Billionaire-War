import { BODY_PART_LABELS } from '../../data/balance';
import type { BodyPart } from '../../data/balance';
import type { SelectionView } from '../../presentation/battleView';
import { Button } from '../ui/Button';
import { BodyPartSelector } from './BodyPartSelector';

type SelectionPanelProps = {
  /** Everything the panel draws, already resolved by the presentation layer. */
  selection: SelectionView;
  onAttack: (part: BodyPart) => void;
  onDefense: (part: BodyPart) => void;
  onConfirm: () => void;
};

const part = (value: BodyPart | null): string => (value === null ? 'NONE' : BODY_PART_LABELS[value]);

/**
 * The pre-round pick phase: one attack, one defense, then CONFIRM.
 *
 * Reads only the view model and reports intent. It never decides whether a
 * choice is legal, whether it was locked in, or what the clock did.
 */
export const SelectionPanel = ({ selection, onAttack, onDefense, onConfirm }: SelectionPanelProps) => {
  if (selection.confirmed) {
    return (
      <div className="battle__locked">
        <span className="battle__locked-label">Your choice is locked</span>
        <span className="battle__locked-value">
          ATK {part(selection.attack)} / DEF {part(selection.defense)}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          {selection.opponentLocked ? 'Both locked in - get ready.' : 'Waiting for the opponent...'}
        </span>
      </div>
    );
  }

  if (selection.expired) {
    return (
      <div className="battle__locked">
        <span className="battle__locked-label">Time is up</span>
        <span className="battle__locked-value">ATTACK NONE &middot; DEFENSE NONE</span>
        <span className="muted" style={{ fontSize: 12 }}>
          Your hero does not act this round.
        </span>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="battle__prompt">
        <span className="battle__prompt-title">Pick your targets</span>
        <span className="battle__prompt-hint">1 attack + 1 defense, then confirm</span>
      </div>

      <BodyPartSelector label="Attack" value={selection.attack} onPick={onAttack} />
      <BodyPartSelector label="Defense" value={selection.defense} onPick={onDefense} />

      <Button variant={selection.complete ? 'gold' : 'default'} block onClick={onConfirm} disabled={!selection.complete}>
        {selection.complete ? 'Confirm' : 'Pick attack & defense'}
      </Button>
    </div>
  );
};
