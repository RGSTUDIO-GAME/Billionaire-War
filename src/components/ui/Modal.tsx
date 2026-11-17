import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { iconIds } from '../../assets/manifest';
import { Icon } from './Icon';

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  centerTitle?: boolean;
};

export const Modal = ({ open, title, onClose, children, footer, centerTitle = false }: ModalProps) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="row-between modal__header" style={{ marginBottom: 'var(--s-4)' }}>
          <h3 className={`screen-head__title${centerTitle ? ' modal__title--center' : ''}`} style={{ fontSize: 18 }}>
            {title}
          </h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon assetId={iconIds.back} alt="" style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
};
