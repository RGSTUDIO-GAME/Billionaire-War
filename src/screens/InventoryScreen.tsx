import { iconIds } from '../assets/manifest';
import { usePlayerStore } from '../state/playerStore';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ComingSoon } from '../components/ui/ComingSoon';
import { CurrencyPill } from '../components/ui/CurrencyPill';
import { ScreenHeader } from '../components/ui/ScreenHeader';

type InventoryScreenProps = { onBack: () => void; onBwarPress: () => void };

export const InventoryScreen = ({ onBack, onBwarPress }: InventoryScreenProps) => {
  const gold = usePlayerStore((state) => state.gold);
  const bwar = usePlayerStore((state) => state.bwar);

  return (
    <div className="anim-fade">
      <ScreenHeader title="Inventory" subtitle="Currencies and items" onBack={onBack} />

      <div className="stack">
        <Card>
          <div className="card__title" style={{ marginBottom: 'var(--s-3)' }}>
            Wallet
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <CurrencyPill kind="gold" value={gold} />
            <CurrencyPill kind="bwar" value={bwar} locked onClick={onBwarPress} />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 'var(--s-3)' }}>
            $GOLD is the internal game currency. $BWAR is shown for display only - there are no
            token transactions in this build.
          </p>
        </Card>

        <Card>
          <div className="card__title" style={{ marginBottom: 'var(--s-3)' }}>
            Equipment &amp; consumables
          </div>
          <div className="empty-state">No items yet. Item drops arrive with the reward system.</div>
        </Card>

        <ComingSoon
          icon={iconIds.inventory}
          title="Item system"
          description="Equipment, consumables and premium items are not implemented yet. Slots stay empty instead of showing fake items."
        />

        <Card flat tight>
          <div className="row-between">
            <span className="muted" style={{ fontSize: 12 }}>
              Character trading
            </span>
            <Badge tone="muted">Coming soon</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
};
