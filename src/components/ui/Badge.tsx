import type { ReactNode } from 'react';

type BadgeProps = {
  tone?: 'default' | 'gold' | 'success' | 'danger' | 'muted';
  children: ReactNode;
};

export const Badge = ({ tone = 'default', children }: BadgeProps) => (
  <span className={`badge${tone !== 'default' ? ` badge--${tone}` : ''}`}>{children}</span>
);
