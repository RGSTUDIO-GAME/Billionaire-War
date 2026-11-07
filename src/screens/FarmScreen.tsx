import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { FARM_SEEDS, farmSeed, type FarmPlot, type FarmSeed, type FarmTier } from '../data/farming';
import { usePlayerStore } from '../state/playerStore';
import { playerProgression, unlockedPlotCount } from '../data/progression';
import { backgroundIds, farmItemIds, farmPlantIds, uiIds } from '../assets/manifest';
import { getAssetUrl } from '../assets/resolve';
import { AssetImg } from '../assets/AssetImg';

type Plot = FarmPlot;
type HarvestFx = { id: number; index: number; tier: FarmTier };

const format = (value: number) => new Intl.NumberFormat('en-US').format(value);
const growthMs = (seed: FarmSeed) => (seed.growingMinutes ?? seed.growingHours * 60) * 60 * 1000;
const growthLabel = (seed: FarmSeed) => seed.growingMinutes ? `${seed.growingMinutes}m` : `${seed.growingHours}h`;
const remainingLabel = (remaining: number) => {
  const totalMinutes = Math.max(0, Math.ceil(remaining / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
};
const plantStage = (seed: FarmSeed, remaining: number): 'seed' | 'sprout' | 'growing' | 'mature' => {
  const elapsed = Math.max(0, growthMs(seed) - remaining);
  const ratio = elapsed / growthMs(seed);
  if (ratio >= 1) return 'mature';
  if (ratio >= 0.35) return 'growing';
  if (ratio >= 0.1) return 'sprout';
  return 'seed';
};

export const FarmScreen = ({ onBack }: { onBack: () => void }) => {
  const gold = usePlayerStore((state) => state.gold);
  const debitGold = usePlayerStore((state) => state.debitGold);
  const addGold = usePlayerStore((state) => state.addGold);
  const playerXp = usePlayerStore((state) => state.playerXp);
  const addPlayerXp = usePlayerStore((state) => state.addPlayerXp);
  const addFarmItem = usePlayerStore((state) => state.addFarmItem);
  const savedPlots = usePlayerStore((state) => state.farmPlots);
  const setFarmPlots = usePlayerStore((state) => state.setFarmPlots);
  const [selectedTier, setSelectedTier] = useState<FarmTier>('common');
  const [plots, setPlots] = useState<Plot[]>(savedPlots);
  const [now, setNow] = useState(Date.now());
  const [harvestFx, setHarvestFx] = useState<HarvestFx[]>([]);
  const harvestFxId = useRef(0);
  const selected = farmSeed(selectedTier);
  const progression = playerProgression(playerXp);
  const unlockedPlots = unlockedPlotCount(progression.level);

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
    setPlots((current) => {
      const next = current.map((plot, plotIndex) => plotIndex === index ? { seed: selected.tier, plantedAt: Date.now() } : plot);
      setFarmPlots(next);
      return next;
    });
  };

  const harvest = (index: number, seed: FarmSeed) => {
    if (now - (plots[index]?.plantedAt ?? 0) < growthMs(seed)) return;
    const id = harvestFxId.current++;
    setHarvestFx((current) => [...current, { id, index, tier: seed.tier }]);
    setPlots((current) => {
      const next = current.map((plot, plotIndex) => plotIndex === index ? null : plot);
      setFarmPlots(next);
      return next;
    });
    addPlayerXp(seed.harvestXp);
    addGold(seed.harvestGold, { kind: 'GRANT' });
    addFarmItem(seed.tier);
  };

  return (
    <div className="farm-screen anim-fade">
      <ScreenHeader title="Farm" subtitle="Grow your fortune · 50 plots" onBack={onBack} />

      <div className="farm-stats">
        <div><span>Planted</span><strong>{planted}<small> / 50</small></strong></div>
        <div><span>Ready</span><strong>{ready}</strong></div>
        <div><span>Player XP</span><strong>{format(progression.totalXp)}</strong></div>
      </div>

      <Card flat className="farm-field-card">
        <div className="farm-field-head">
          <div><span className="farm-kicker">Billionaire soil</span><h2>Green Acres</h2></div>
          <span className="farm-weather">☀️ 24°C</span>
        </div>
        <div className="farm-field" aria-label="50 farming plots" style={{ backgroundImage: `url("${getAssetUrl(backgroundIds.farmGrass)}")` }}>
          {plots.map((plot, index) => {
            const seed = plot ? farmSeed(plot.seed) : null;
            const remaining = plot && seed ? growthMs(seed) - (now - plot.plantedAt) : 0;
            const isReady = Boolean(plot && remaining <= 0);
            const isLocked = index >= unlockedPlots;
            const stage = seed ? plantStage(seed, remaining) : null;
            return (
              <button key={index} type="button" disabled={isLocked} className={`farm-plot${seed ? ' is-planted' : ''}${isReady ? ' is-ready' : ''}${isLocked ? ' is-locked' : ''}`} onClick={() => seed ? harvest(index, seed) : plant(index)} aria-label={isLocked ? `Plot ${index + 1} locked` : seed ? `${seed.label} plot` : `Empty plot ${index + 1}`}>
                <AssetImg assetId={uiIds.farmPlot} alt="" className="farm-plot-art" />
                {isLocked ? <><span className="farm-lock">🔒</span><span className="farm-plot-label">LV {Math.ceil(1 + (index * 99) / 49)}</span></> : seed && stage ? <><AssetImg assetId={farmPlantIds[seed.tier][stage]} alt={`${seed.label} ${stage}`} className="farm-crop-art" /><span className="farm-plot-label">{isReady ? 'HARVEST' : remainingLabel(remaining)}</span></> : <span className="farm-plot-empty">+</span>}
                {harvestFx.filter((effect) => effect.index === index).map((effect) => (
                  <span
                    key={effect.id}
                    className="farm-harvest-fx"
                    onAnimationEnd={() => setHarvestFx((current) => current.filter((item) => item.id !== effect.id))}
                  >
                    <AssetImg assetId={farmItemIds[effect.tier]} alt="Harvested item" />
                  </span>
                ))}
              </button>
            );
          })}
        </div>
        <p className="farm-hint">Tap an empty plot to plant. Tap a glowing crop to harvest.</p>
      </Card>

      <div className="farm-section-title"><span>Seed bag</span><span className="muted">Level {progression.level} · {unlockedPlots}/50 plots · {format(gold)} GOLD</span></div>
      <div className="farm-seeds">
        {FARM_SEEDS.map((seed) => (
          <button key={seed.tier} type="button" className={`farm-seed${selectedTier === seed.tier ? ' is-selected' : ''} farm-seed--${seed.tier}`} onClick={() => setSelectedTier(seed.tier)}>
            <AssetImg assetId={farmPlantIds[seed.tier].growing} alt={`${seed.label} growing`} className="farm-seed-art" />
            <span className="farm-seed-name">{seed.tier}</span>
            <strong>{seed.label} seed</strong>
            <span className="farm-seed-price">{format(seed.price)} GOLD · {growthLabel(seed)}</span>
            <span className="farm-seed-reward">+{seed.harvestXp} XP · +{format(seed.harvestGold)} GOLD</span>
          </button>
        ))}
      </div>
    </div>
  );
};
