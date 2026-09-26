import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import { haptic } from '../../services/telegram';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'gold' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: string;
  children: ReactNode;
};

export const Button = ({
  variant = 'default',
  size = 'md',
  block = false,
  icon,
  className = '',
  children,
  onClick,
  ...rest
}: ButtonProps) => (
  <button
    type="button"
    className={[
      'btn',
      variant !== 'default' ? `btn--${variant}` : '',
      size !== 'md' ? `btn--${size}` : '',
      block ? 'btn--block' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    onClick={(event) => {
      haptic.select();
      onClick?.(event);
    }}
    {...rest}
  >
    {icon ? <Icon assetId={icon} alt="" /> : null}
    {children}
  </button>
);
