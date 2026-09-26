import { AssetImg } from '../../assets/AssetImg';
import { iconIds } from '../../assets/manifest';
import { haptic } from '../../services/telegram';

export type CurrencyKind = 'gold' | 'bwar';

type CurrencyPillProps = {
  kind: CurrencyKind;
  value: number;
  onClick?: () => void;
  locked?: boolean;
};

const META: Record<CurrencyKind, { symbol: string; label: string }> = {
  gold: { symbol: '$G', label: '$GOLD' },
  bwar: { symbol: '$B', label: '$BWAR' },
};

const format = (value: number): string =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 10_000
      ? `${(value / 1_000).toFixed(1)}K`
      : value.toLocaleString('en-US');

/**
 * $GOLD is spendable in-game currency.
 * $BWAR is display-only for now - there are no token transactions here.
 */
export const CurrencyPill = ({ kind, value, onClick, locked = false }: CurrencyPillProps) => {
  const meta = META[kind];
  const content = (
    <>
      <span className={`currency__icon currency__icon--${kind}`}>{meta.symbol}</span>
      <span>{format(value)}</span>
      {locked ? <AssetImg assetId={iconIds.lock} className="currency__lock" alt="Coming soon" /> : null}
    </>
  );

  if (!onClick) return <div className={`currency${kind === 'bwar' ? ' currency--bwar' : ''}`}>{content}</div>;

  return (
    <button
      type="button"
      className={`currency${kind === 'bwar' ? ' currency--bwar' : ''}`}
      aria-label={`${meta.label} balance`}
      onClick={() => {
        haptic.select();
        onClick();
      }}
    >
      {content}
    </button>
  );
};
