import { AssetImg } from '../assets/AssetImg';
import { iconIds } from '../assets/manifest';
import { HeroAvatar } from '../components/hero/HeroAvatar';
import { RarityBadge } from '../components/hero/RarityBadge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { formatHashrate, hashrateFor, heroLevelOf } from '../data/economy';
import { HASHRATE_PERIOD_MS, MINING_DURATION_MS } from '../data/balance';
import { HEROES } from '../data/heroes';
import type { Hero } from '../data/heroes/types';
import { usePlayerStore } from '../state/playerStore';

type MiningSelectScreenProps = {
  onBack: () => void;
  onEquip: () => void;
};

const formatAmount = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 });

export const MiningSelectScreen = ({ onBack, onEquip }: MiningSelectScreenProps) => {
  const ownedHeroIds = usePlayerStore((state) => state.ownedHeroIds);
  const heroLevels = usePlayerStore((state) => state.heroLevels);
  const activeMining = usePlayerStore((state) => state.mining);
  const equipMiningHero = usePlayerStore((state) => state.equipMiningHero);

  const eligibleHeroes = HEROES.filter((hero) => {
    if (!ownedHeroIds.includes(hero.id)) return false;
    return hashrateFor(hero.rarity, heroLevelOf(heroLevels, hero.id)) > 0;
  });

  const equip = (hero: Hero) => {
    if (equipMiningHero(hero.id)) onEquip();
  };

  return (
    <div className="anim-fade">
      <ScreenHeader title="BWAR Mining" subtitle="Select one hero to stack" onBack={onBack} />

      <div className="stack">
        <Card flat tight>
          <div className="row">
            <AssetImg assetId={iconIds.bwar} alt="" style={{ width: 22, height: 22 }} />
            <p className="muted" style={{ fontSize: 12 }}>
              Only owned heroes with a positive hashrate can mine. One hero is active at a time.
            </p>
          </div>
        </Card>

        {eligibleHeroes.length > 0 ? (
          eligibleHeroes.map((hero) => {
            const level = heroLevelOf(heroLevels, hero.id);
            const hashrate = hashrateFor(hero.rarity, level);
            const dailyReward = (hashrate * MINING_DURATION_MS) / HASHRATE_PERIOD_MS;
            const active = activeMining?.heroId === hero.id;
            return (
              <Card key={hero.id}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <HeroAvatar hero={hero} size="md" />
                  <div className="grow stack" style={{ minWidth: 0 }}>
                    <div className="row-between">
                      <div>
                        <h3 className="display" style={{ fontSize: 19, color: 'var(--gold)' }}>
                          {hero.name}
                        </h3>
                        <div className="muted" style={{ fontSize: 12 }}>{hero.title}</div>
                      </div>
                      {active ? <Badge tone="gold">Active</Badge> : null}
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <RarityBadge rarity={hero.rarity} />
                      <Badge>Lv {level}</Badge>
                    </div>
                    <div className="row-between" style={{ fontSize: 12 }}>
                      <span className="muted">Hashrate</span>
                      <strong>{formatHashrate(hashrate)} BWAR/10m</strong>
                    </div>
                    <div className="row-between" style={{ fontSize: 12 }}>
                      <span className="muted">24h target</span>
                      <strong className="gold">{formatAmount(dailyReward)} $BWAR</strong>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 'var(--s-3)' }}>
                  <Button
                    variant={active ? 'ghost' : 'gold'}
                    block
                    disabled={active}
                    onClick={() => equip(hero)}
                  >
                    {active ? 'Currently mining' : 'Equip'}
                  </Button>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="empty-state">
            No owned hero has hashrate yet. Upgrade a hero in the Hero menu, then return here.
          </div>
        )}

        <Card flat>
          <div className="card__title" style={{ marginBottom: 'var(--s-2)' }}>
            Mining rules
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            One session lasts 24 hours. Each completed 10-minute block pays the hero's hashrate
            in $BWAR. Mining pauses when full; claim to add it to your local balance.
          </div>
        </Card>
      </div>
    </div>
  );
};
