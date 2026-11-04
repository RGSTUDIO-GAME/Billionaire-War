import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { FARM_GROWTH_MS, FARM_PLOT_COUNT, FARM_SEEDS, farmSeed, type FarmSeed, type FarmTier } from '../data/farming';
import { usePlayerStore } from '../state/playerStore';

type Plot = { seed: FarmTier; plantedAt: number } | null;

const emptyPlots = (): Plot[] => Array.from({ length: FARM_PLOT_COUNT }, () => null);
const format = (value: number) => new Intl.NumberFormat('en-US').format(value);

export const FarmScreen = ({ onBack }: { onBack: () => void }) => {
  const gold = usePlayerStore((state) => state.gold);
  const bwar = usePlayerStore((state) => state.bwar);
  const debitGold = usePlayerStore((state) => state.debitGold);
  const debitBwar = usePlayerStore((state) => state.debitBwar);
  const addBwar = usePlayerStore((state) => state.addBwar);
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
  const ready = useMemo(() => plots.filter((plot) => plot && now - plot.plantedAt >= FARM_GROWTH_MS).length, [now, plots]);

  const plant = (index: number) => {
    if (plots[index]) return;
    const paid = selected.currency === 'GOLD'
      ? debitGold(selected.price, { kind: 'SPEND' })
      : debitBwar(selected.price);
    if (!paid) return;
    setPlots((current) => current.map((plot, plotIndex) => plotIndex === index ? { seed: selected.tier, plantedAt: Date.now() } : plot));
  };

  const harvest = (index: number, seed: FarmSeed) => {
    if (now - (plots[index]?.plantedAt ?? 0) < FARM_GROWTH_MS) return;
    setPlots((current) => current.map((plot, plotIndex) => plotIndex === index ? null : plot));
    setXp((value) => value + seed.harvestXp);
    if (seed.harvestBwar > 0) addBwar(seed.harvestBwar);
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
            const isReady = Boolean(plot && now - plot.plantedAt >= FARM_GROWTH_MS);
            return (
              <button key={index} type="button" className={`farm-plot${seed ? ' is-planted' : ''}${isReady ? ' is-ready' : ''}`} onClick={() => seed ? harvest(index, seed) : plant(index)} aria-label={seed ? `${seed.label} plot` : `Empty plot ${index + 1}`}>
                {seed ? <><span className="farm-crop" style={{ color: seed.color }}>{isReady ? '✦' : seed.symbol}</span><span className="farm-plot-label">{isReady ? 'HARVEST' : seed.label}</span></> : <span className="farm-plot-empty">+</span>}
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
            <span className="farm-seed-price">{format(seed.price)} {seed.currency}</span>
            <span className="farm-seed-reward">+{seed.harvestXp} XP{seed.harvestBwar ? ` · +${seed.harvestBwar} BWAR` : ''}</span>
          </button>
        ))}
      </div>
      <Button variant="ghost" block onClick={() => setPlots(emptyPlots())}>Reset field (prototype)</Button>
    </div>
  );
};

