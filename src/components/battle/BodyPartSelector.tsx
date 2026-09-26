import { BODY_PARTS, BODY_PART_LABELS } from '../../data/balance';
import type { BodyPart } from '../../data/balance';
import { AssetImg } from '../../assets/AssetImg';
import { iconIds } from '../../assets/manifest';

const PART_ICON: Record<BodyPart, string> = {
  head: iconIds.partHead,
  body: iconIds.partBody,
  arm: iconIds.partArm,
  leg: iconIds.partLeg,
};

type BodyPartSelectorProps = {
  label: string;
  value: BodyPart | null;
  onPick: (part: BodyPart) => void;
};

/**
 * One attack or defense row: pick exactly one body part.
 * The engine ignores input outside the selection states, so no disabled flag
 * is needed here.
 */
export const BodyPartSelector = ({ label, value, onPick }: BodyPartSelectorProps) => (
  <div>
    <div className={`selector__label${value !== null ? ' is-done' : ''}`}>
      {label}
      {value !== null ? ` · ${BODY_PART_LABELS[value]}` : ' · NOT SET'}
    </div>
    <div className="selector">
      {BODY_PARTS.map((part) => (
        <button
          key={part}
          type="button"
          className={`selector__btn${value === part ? ' is-picked' : ''}`}
          aria-pressed={value === part}
          onClick={() => onPick(part)}
        >
          <AssetImg assetId={PART_ICON[part]} alt="" style={{ width: 20, height: 20 }} />
          <span>{BODY_PART_LABELS[part]}</span>
        </button>
      ))}
    </div>
  </div>
);
