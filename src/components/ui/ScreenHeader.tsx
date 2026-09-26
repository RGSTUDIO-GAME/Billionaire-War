import type { ReactNode } from 'react';
import { haptic } from '../../services/telegram';
import { Icon } from './Icon';
import { iconIds } from '../../assets/manifest';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
};

export const ScreenHeader = ({ title, subtitle, onBack, action }: ScreenHeaderProps) => (
  <div className="screen-head">
    {onBack ? (
      <button
        type="button"
        className="icon-btn"
        aria-label="Back"
        onClick={() => {
          haptic.select();
          onBack();
        }}
      >
        <Icon assetId={iconIds.back} alt="" />
      </button>
    ) : null}
    <div className="grow" style={{ minWidth: 0 }}>
      <h1 className="screen-head__title">{title}</h1>
      {subtitle ? <div className="screen-head__sub">{subtitle}</div> : null}
    </div>
    {action}
  </div>
);
