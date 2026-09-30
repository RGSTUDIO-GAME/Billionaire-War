import { iconIds } from '../assets/manifest';
import { usePlayerStore } from '../state/playerStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ComingSoon } from '../components/ui/ComingSoon';
import { CurrencyPill } from '../components/ui/CurrencyPill';
import { ScreenHeader } from '../components/ui/ScreenHeader';

type InventoryScreenProps = { onBack: () => void; onBwarPress: () => void; onTrade: () => void };

export const InventoryScreen = ({ onBack, onBwarPress, onTrade }: InventoryScreenProps) => {
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
            <CurrencyPill kind="bwar" value={bwar} onClick={onBwarPress} />
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 'var(--s-3)' }}>
            $GOLD is the internal game currency. $BWAR is earned locally through Mining; there
            are no on-chain token transactions in this build.
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
            <Button size="sm" variant="ghost" onClick={onTrade}>
              Open
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
