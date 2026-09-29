import { useEffect, useState } from 'react';
import { AssetImg } from '../assets/AssetImg';
import { iconIds } from '../assets/manifest';
import { HeroAvatar } from '../components/hero/HeroAvatar';
import { RarityBadge } from '../components/hero/RarityBadge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { formatHashrate, heroLevelOf } from '../data/economy';
import { getHeroById } from '../data/heroes';
import { miningProgress } from '../services/miningService';
import { usePlayerStore } from '../state/playerStore';

type MiningScreenProps = {
  onBack: () => void;
  onChangeHero: () => void;
};

const formatAmount = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 });

const formatCounter = (value: number): string => value.toFixed(6);

const formatRemaining = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};

export const MiningScreen = ({ onBack, onChangeHero }: MiningScreenProps) => {
  const mining = usePlayerStore((state) => state.mining);
  const heroLevels = usePlayerStore((state) => state.heroLevels);
  const claimMining = usePlayerStore((state) => state.claimMining);
  const [now, setNow] = useState(() => Date.now());
  const [confirmChange, setConfirmChange] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const hero = mining === null ? undefined : getHeroById(mining.heroId);

  if (mining === null || hero === undefined) {
    return (
      <div className="anim-fade">
        <ScreenHeader title="Mining Token BWAR" subtitle="No hero equipped" onBack={onBack} />
        <Card>
          <div className="empty-state">Choose a hero with hashrate to start mining.</div>
          <div style={{ marginTop: 'var(--s-3)' }}>
            <Button variant="gold" block onClick={onChangeHero}>
              Choose hero
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const progress = miningProgress(mining, now);
  const level = heroLevelOf(heroLevels, hero.id);
  const percent = Math.round(progress.ratio * 1000) / 10;

  const claim = () => {
    const amount = claimMining();
    if (amount > 0) {
      setClaimedAmount(amount);
      setNow(Date.now());
      window.setTimeout(() => setClaimedAmount(null), 5000);
    }
  };

  return (
    <div className="anim-fade">
      <ScreenHeader
        title="Mining Token BWAR"
        subtitle={progress.full ? 'Full - claim to continue' : 'Mining in progress'}
        onBack={onBack}
      />

      <div className="stack-lg">
        <Card>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <HeroAvatar hero={hero} size="lg" />
            <div className="grow stack" style={{ minWidth: 0 }}>
              <div className="row-between">
                <div>
                  <h2 className="display" style={{ fontSize: 24, color: 'var(--gold)' }}>
                    {hero.name}
                  </h2>
                  <div className="muted" style={{ fontSize: 12 }}>{hero.title}</div>
                </div>
                <Badge tone={progress.full ? 'success' : 'gold'}>
                  {progress.full ? 'Ready' : 'Mining'}
                </Badge>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <RarityBadge rarity={hero.rarity} />
                <Badge>Lv {level}</Badge>
              </div>
              <div className="row-between" style={{ fontSize: 12 }}>
                <span className="muted">Hashrate</span>
                <strong>{formatHashrate(mining.hashrate)} BWAR/s</strong>
              </div>
            </div>
          </div>
        </Card>

        <Card className="mining-card">
          <div className="mining-counter">
            <span className="mining-counter__value">{formatCounter(progress.amount)}</span>
            <span className="mining-counter__unit">$BWAR</span>
          </div>
          <div className="mining-progress" aria-label="Mining progress">
            <div className="mining-progress__fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="row-between mining-meta">
            <span>{percent.toFixed(1)}% filled</span>
            <span>{progress.full ? 'FULL' : `${formatRemaining(progress.remainingMs)} remaining`}</span>
          </div>
          <div className="row-between mining-meta">
            <span className="muted">Session target</span>
            <strong>{formatAmount(mining.rewardAmount)} $BWAR</strong>
          </div>
          {claimedAmount !== null ? (
            <div className="mining-claim-note" role="status">
              Claimed {formatAmount(claimedAmount)} $BWAR into your balance.
            </div>
          ) : null}
          <div className="stack" style={{ marginTop: 'var(--s-4)' }}>
            <Button variant="gold" block disabled={!progress.full} onClick={claim}>
              {progress.full ? `Claim ${formatAmount(mining.rewardAmount)} $BWAR` : 'Claim when full'}
            </Button>
            <Button variant="ghost" block onClick={() => setConfirmChange(true)}>
              Change hero
            </Button>
          </div>
        </Card>

        <Card flat tight>
          <div className="row">
            <AssetImg assetId={iconIds.clock} alt="" style={{ width: 20, height: 20 }} />
            <p className="muted" style={{ fontSize: 12 }}>
              Mining runs for 24 hours, then pauses at full. Claim once to receive the amount;
              the same hero starts its next cycle automatically.
            </p>
          </div>
        </Card>
      </div>

      <Modal open={confirmChange} title="Change mining hero?" onClose={() => setConfirmChange(false)}>
        <div className="stack">
          <p className="muted" style={{ fontSize: 13 }}>
            Equipping a different hero starts a new 24-hour session. Any unclaimed progress from
            this session will reset.
          </p>
          <Button
            variant="primary"
            block
            onClick={() => {
              setConfirmChange(false);
              onChangeHero();
            }}
          >
            Continue
          </Button>
          <Button variant="ghost" block onClick={() => setConfirmChange(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
};
