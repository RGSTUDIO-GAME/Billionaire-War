import { Button } from './Button';
import { Icon } from './Icon';
import { iconIds } from '../../assets/manifest';

type ComingSoonProps = {
  title: string;
  description: string;
  icon?: string;
  onBack?: () => void;
  backLabel?: string;
};

/**
 * THE single "not implemented yet" component.
 * Every unfinished feature in the game must use this - never a fake
 * working screen and never a placeholder ranking or balance.
 */
export const ComingSoon = ({
  title,
  description,
  icon = iconIds.clock,
  onBack,
  backLabel = 'BACK',
}: ComingSoonProps) => (
  <div className="card anim-pop">
    <div className="coming-soon">
      <span className="coming-soon__badge">COMING SOON</span>
      <Icon assetId={icon} className="coming-soon__icon" alt="" />
      <h2 className="coming-soon__title">{title}</h2>
      <p className="coming-soon__text">{description}</p>
      {onBack ? (
        <Button variant="ghost" onClick={onBack}>
          {backLabel}
        </Button>
      ) : null}
    </div>
  </div>
);
