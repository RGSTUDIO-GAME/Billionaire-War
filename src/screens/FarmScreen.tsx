import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { FARM_PLOT_COUNT, FARM_SEEDS, farmSeed, type FarmSeed, type FarmTier } from '../data/farming';
import { usePlayerStore } from '../state/playerStore';

type Plot = { seed: FarmTier; plantedAt: number } | null;

const emptyPlots = (): Plot[] => Array.from({ length: FARM_PLOT_COUNT }, () => null);
const format = (value: number) => new Intl.NumberFormat('en-US').format(value);
const growthMs = (seed: FarmSeed) => seed.growingHours * 60 * 60 * 1000;
const remainingLabel = (remaining: number) => {
  const totalMinutes = Math.max(0, Math.ceil(remaining / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};

export const FarmScreen = ({ onBack }: { onBack: () => void }) => {
  const gold = usePlayerStore((state) => state.gold);
  const bwar = usePlayerStore((state) => state.bwar);
  const debitGold = usePlayerStore((state) => state.debitGold);
  const addGold = usePlayerStore((state) => state.addGold);
  const [selectedTier, setSelectedTier] = useState<FarmTier>('common');
  const [plots, setPlots] = useState<Plot[]>(emptyPlots);
  const [now, setNow] = useState(Date.now());
  const [xp, setXp] = useState(0);
  const selected = farmSeed(selectedTier);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const planted = plots.filter(Boolean).length;
  const ready = useMemo(() => plots.filter((plot) => {
    if (!plot) return false;
    return now - plot.plantedAt >= growthMs(farmSeed(plot.seed));
  }).length, [now, plots]);

  const plant = (index: number) => {
    if (plots[index]) return;
    const paid = debitGold(selected.price, { kind: 'SPEND' });
    if (!paid) return;
    setPlots((current) => current.map((plot, plotIndex) => plotIndex === index ? { seed: selected.tier, plantedAt: Date.now() } : plot));
  };

  const harvest = (index: number, seed: FarmSeed) => {
    if (now - (plots[index]?.plantedAt ?? 0) < growthMs(seed)) return;
    setPlots((current) => current.map((plot, plotIndex) => plotIndex === index ? null : plot));
    setXp((value) => value + seed.harvestXp);
    addGold(seed.harvestGold, { kind: 'GRANT' });
  };

  return (
    <div className="farm-screen anim-fade">
      <ScreenHeader title="Farm" subtitle="Grow your fortune · 50 plots" onBack={onBack} />

      <div className="farm-stats">
        <div><span>Planted</span><strong>{planted}<small> / 50</small></strong></div>
        <div><span>Ready</span><strong>{ready}</strong></div>
        <div><span>Farm XP</span><strong>{format(xp)}</strong></div>
      </div>

      <Card flat className="farm-field-card">
        <div className="farm-field-head">
          <div><span className="farm-kicker">Billionaire soil</span><h2>Green Acres</h2></div>
          <span className="farm-weather">☀️ 24°C</span>
        </div>
        <div className="farm-field" aria-label="50 farming plots">
          {plots.map((plot, index) => {
            const seed = plot ? farmSeed(plot.seed) : null;
            const remaining = plot && seed ? growthMs(seed) - (now - plot.plantedAt) : 0;
            const isReady = Boolean(plot && remaining <= 0);
            return (
              <button key={index} type="button" className={`farm-plot${seed ? ' is-planted' : ''}${isReady ? ' is-ready' : ''}`} onClick={() => seed ? harvest(index, seed) : plant(index)} aria-label={seed ? `${seed.label} plot` : `Empty plot ${index + 1}`}>
                {seed ? <><span className="farm-crop" style={{ color: seed.color }}>{isReady ? '✦' : seed.symbol}</span><span className="farm-plot-label">{isReady ? 'HARVEST' : remainingLabel(remaining)}</span></> : <span className="farm-plot-empty">+</span>}
              </button>
            );
          })}
        </div>
        <p className="farm-hint">Tap an empty plot to plant. Tap a glowing crop to harvest.</p>
      </Card>

      <div className="farm-section-title"><span>Seed bag</span><span className="muted">Balance: {format(gold)} GOLD · {format(bwar)} BWAR</span></div>
      <div className="farm-seeds">
        {FARM_SEEDS.map((seed) => (
          <button key={seed.tier} type="button" className={`farm-seed${selectedTier === seed.tier ? ' is-selected' : ''} farm-seed--${seed.tier}`} onClick={() => setSelectedTier(seed.tier)}>
            <span className="farm-seed-art" style={{ color: seed.color }}>{seed.symbol}</span>
            <span className="farm-seed-name">{seed.tier}</span>
            <strong>{seed.label} seed</strong>
            <span className="farm-seed-price">{format(seed.price)} GOLD · {seed.growingHours}h</span>
            <span className="farm-seed-reward">+{seed.harvestXp} XP · +{format(seed.harvestGold)} GOLD</span>
          </button>
        ))}
      </div>
      <Button variant="ghost" block onClick={() => setPlots(emptyPlots())}>Reset field (prototype)</Button>
    </div>
  );
};
