import { AssetImg } from '../../assets/AssetImg';
import { heroPortraitIds } from '../../assets/manifest';
import { getHeroById } from '../../data/heroes';
import { MAX_PLAYER_LEVEL, playerProgression, unlockedPlotCount } from '../../data/progression';
import { useEffect, useState } from 'react';
import { usePlayerStore } from '../../state/playerStore';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

type ProfileModalProps = { open: boolean; onClose: () => void };

export const ProfileModal = ({ open, onClose }: ProfileModalProps) => {
  const username = usePlayerStore((state) => state.username);
  const equippedHeroId = usePlayerStore((state) => state.equippedHeroId);
  const playerXp = usePlayerStore((state) => state.playerXp);
  const setUsername = usePlayerStore((state) => state.setUsername);
  const [draftName, setDraftName] = useState(username);
  const [nameNotice, setNameNotice] = useState<string | null>(null);
  const hero = getHeroById(equippedHeroId);
  const progression = playerProgression(playerXp);
  const progressPercent = progression.progress * 100;
  useEffect(() => {
    if (open) {
      setDraftName(username);
      setNameNotice(null);
    }
  }, [open, username]);
  if (!hero) return null;

  return (
    <Modal open={open} title="Player Profile" onClose={onClose}>
      <div className="profile-card">
        <div className="profile-avatar">
          <AssetImg assetId={heroPortraitIds[hero.id] ?? heroPortraitIds.durov} alt={hero.name} />
          <svg className="profile-avatar-progress" viewBox="0 0 120 120" aria-label={`${progression.level} level, ${Math.round(progressPercent)}% XP progress`} role="img">
            <circle className="profile-avatar-progress__track" cx="60" cy="60" r="55" />
            <circle className="profile-avatar-progress__value" cx="60" cy="60" r="55" pathLength="100" style={{ strokeDasharray: `${progressPercent} 100` }} />
          </svg>
          <span className="profile-avatar-level">{progression.level}</span>
        </div>
        <div className="profile-name">{username || 'PLAYER'}</div>
        <div className="profile-hero">{hero.name} · Equipped Hero</div>
        <div className="profile-name-edit">
          <label htmlFor="profile-name">Player name</label>
          <div className="profile-name-form">
            <input
              id="profile-name"
              value={draftName}
              maxLength={24}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Enter your name"
            />
            <Button variant="gold" size="sm" onClick={() => setNameNotice(setUsername(draftName) ? 'Name saved.' : 'Use 3–24 characters.')}>Save</Button>
          </div>
          {nameNotice ? <div className="profile-name-notice" role="status">{nameNotice}</div> : null}
        </div>
        <div className="profile-level-row"><span>PLAYER LEVEL</span><strong>{progression.level}</strong><em>/ {MAX_PLAYER_LEVEL}</em></div>
        <div className="profile-progress-track"><div className="profile-progress-fill" style={{ width: `${progression.progress * 100}%` }} /></div>
        <div className="profile-xp-row">
          <span>{progression.currentXp.toLocaleString('en-US')} XP</span>
          <span>{progression.maxed ? 'MAX LEVEL' : `${progression.requiredXp.toLocaleString('en-US')} XP to next level`}</span>
        </div>
        <div className="profile-meta">
          <span><b>{unlockedPlotCount(progression.level)}</b> / 50 plots unlocked</span>
          <span>{progression.maxed ? 'Progress complete' : 'XP from farming and battles'}</span>
        </div>
      </div>
    </Modal>
  );
};
