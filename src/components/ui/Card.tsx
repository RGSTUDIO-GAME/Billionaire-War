import type { CSSProperties, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
  className?: string;
  flat?: boolean;
  tight?: boolean;
  style?: CSSProperties;
};

export const Card = ({ children, className = '', flat = false, tight = false, style }: CardProps) => (
  <div
    className={['card', flat ? 'card--flat' : '', tight ? 'card--tight' : '', className]
      .filter(Boolean)
      .join(' ')}
    style={style}
  >
    {children}
  </div>
);
