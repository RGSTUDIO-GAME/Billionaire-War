import { AssetImg } from '../../assets/AssetImg';
import { heroPortraitIds } from '../../assets/manifest';
import { getHeroById } from '../../data/heroes';
import { MAX_PLAYER_LEVEL, MAX_BATTLE_LEVEL, battleProgression, playerProgression, unlockedPlotCount } from '../../data/progression';
import { usePlayerStore } from '../../state/playerStore';
import { Modal } from '../ui/Modal';

type ProfileModalProps = { open: boolean; onClose: () => void };

export const ProfileModal = ({ open, onClose }: ProfileModalProps) => {
  const username = usePlayerStore((state) => state.username);
  const equippedHeroId = usePlayerStore((state) => state.equippedHeroId);
  const playerXp = usePlayerStore((state) => state.playerXp);
  const battleXp = usePlayerStore((state) => state.battleXp);
  const hero = getHeroById(equippedHeroId);
  const progression = playerProgression(playerXp);
  const battle = battleProgression(battleXp);
  if (!hero) return null;

  return (
    <Modal open={open} title="Player Profile" onClose={onClose}>
      <div className="profile-card">
        <div className="profile-avatar">
          <AssetImg assetId={heroPortraitIds[hero.id] ?? heroPortraitIds.durov} alt={hero.name} />
        </div>
        <div className="profile-name">{username || 'PLAYER'}</div>
        <div className="profile-hero">{hero.name} · Equipped Hero</div>
        <div className="profile-level-row"><span>PLAYER LEVEL</span><strong>{progression.level}</strong><em>/ {MAX_PLAYER_LEVEL}</em></div>
        <div className="profile-progress-track"><div className="profile-progress-fill" style={{ width: `${progression.progress * 100}%` }} /></div>
        <div className="profile-xp-row">
          <span>{progression.currentXp.toLocaleString('en-US')} XP</span>
          <span>{progression.maxed ? 'MAX LEVEL' : `${progression.requiredXp.toLocaleString('en-US')} XP to next level`}</span>
        </div>
        <div className="profile-meta">
          <span><b>{unlockedPlotCount(progression.level)}</b> / 50 plots unlocked</span>
          <span>{progression.maxed ? 'Progress complete' : 'XP from crop harvests only'}</span>
        </div>
        <div className="profile-battle-block">
          <div className="profile-level-row"><span>BATTLE LEVEL</span><strong>{battle.level}</strong><em>/ {MAX_BATTLE_LEVEL}</em></div>
          <div className="profile-progress-track"><div className="profile-progress-fill profile-progress-fill--battle" style={{ width: `${battle.progress * 100}%` }} /></div>
          <div className="profile-xp-row">
            <span>{battle.currentXp.toLocaleString('en-US')} BATTLE XP</span>
            <span>{battle.maxed ? 'MAX LEVEL' : `${battle.requiredXp.toLocaleString('en-US')} XP to next level`}</span>
          </div>
          <div className="profile-battle-note">Win battles to unlock Hero upgrades and Fusion tiers.</div>
        </div>
      </div>
    </Modal>
  );
};
