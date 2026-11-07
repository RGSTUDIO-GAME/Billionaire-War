import { farmItemIds } from '../assets/manifest';
import { FARM_SEEDS } from '../data/farming';
import { AssetImg } from '../assets/AssetImg';
import { usePlayerStore } from '../state/playerStore';
import { Card } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';

type InventoryScreenProps = { onBack: () => void; onBwarPress: () => void; onTrade: () => void };

export const InventoryScreen = ({ onBack }: InventoryScreenProps) => {
  const farmItems = usePlayerStore((state) => state.farmItems);
  const hasItems = FARM_SEEDS.some((seed) => (farmItems[seed.tier] ?? 0) > 0);

  return (
    <div className="anim-fade">
      <ScreenHeader title="Inventory" subtitle="Collected items" onBack={onBack} />

      <Card>
        <div className="card__title" style={{ marginBottom: 'var(--s-3)' }}>Items</div>
        {hasItems ? (
          <div className="farm-inventory-grid">
            {FARM_SEEDS.map((seed) => {
              const count = farmItems[seed.tier] ?? 0;
              if (count === 0) return null;
              return (
                <div key={seed.tier} className={`farm-inventory-item farm-inventory-item--${seed.tier}`}>
                  <AssetImg assetId={farmItemIds[seed.tier]} alt={`${seed.label} item`} />
                  <div className="farm-inventory-item__name">{seed.label}</div>
                  <div className="farm-inventory-item__count">×{count.toLocaleString('en-US')}</div>
                  <div className="farm-inventory-item__tier">{seed.tier}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">Belum ada item. Item yang diperoleh akan tersimpan di sini.</div>
        )}
      </Card>
    </div>
  );
};
