import { useState } from 'react';
import { useSettingsStore } from '../state/settingsStore';
import { usePlayerStore } from '../state/playerStore';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { haptic } from '../services/telegram';

type SettingsScreenProps = { onBack: () => void };

const ToggleRow = ({ label, hint, value, onToggle }: {
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
}) => (
  <div className="toggle-row">
    <div className="toggle-row__text">
      <div className="toggle-row__label">{label}</div>
      <div className="toggle-row__hint">{hint}</div>
    </div>
    <button
      type="button"
      className={`toggle${value ? ' is-on' : ''}`}
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => {
        haptic.select();
        onToggle();
      }}
    />
  </div>
);

export const SettingsScreen = ({ onBack }: SettingsScreenProps) => {
  const sfx = useSettingsStore((state) => state.sfx);
  const music = useSettingsStore((state) => state.music);
  const toggleSfx = useSettingsStore((state) => state.toggleSfx);
  const toggleMusic = useSettingsStore((state) => state.toggleMusic);
  const resetProgress = usePlayerStore((state) => state.resetProgress);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="anim-fade">
      <ScreenHeader title="Settings" subtitle="Audio and game data" onBack={onBack} />

      <div className="stack">
        <Card>
          <div className="card__title" style={{ marginBottom: 'var(--s-1)' }}>
            Audio
          </div>
          <ToggleRow
            label="Sound effects"
            hint="Hits, blocks, countdown and UI clicks"
            value={sfx}
            onToggle={toggleSfx}
          />
          <hr className="divider" />
          <ToggleRow
            label="Battle music"
            hint="Loops while a battle is running"
            value={music}
            onToggle={toggleMusic}
          />
        </Card>

        <Card>
          <div className="card__title" style={{ marginBottom: 'var(--s-3)' }}>
            Game data
          </div>
          <div className="row-between" style={{ marginBottom: 'var(--s-3)' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Progress is stored locally on this device.
            </span>
            <Badge tone="muted">Local only</Badge>
          </div>
          <Button variant="ghost" block onClick={() => setConfirmReset(true)}>
            Reset progress
          </Button>
        </Card>

        <Card>
          <div className="card__title" style={{ marginBottom: 'var(--s-3)' }}>
            About
          </div>
          <div className="stack" style={{ gap: 'var(--s-2)', fontSize: 12 }}>
            <div className="row-between">
              <span className="muted">Version</span>
              <span>0.1.0 &middot; Foundation</span>
            </div>
            <div className="row-between">
              <span className="muted">Battle engine</span>
              <span>Deterministic &middot; 3 rounds</span>
            </div>
            <div className="row-between">
              <span className="muted">On-chain features</span>
              <span>None</span>
            </div>
          </div>
        </Card>
      </div>

      <Modal open={confirmReset} title="Reset progress?" onClose={() => setConfirmReset(false)}>
        <div className="stack">
          <p className="muted" style={{ fontSize: 13 }}>
            Currency, owned heroes and the equipped hero return to their starting values on this
            device.
          </p>
          <Button
            variant="primary"
            block
            onClick={() => {
              resetProgress();
              setConfirmReset(false);
            }}
          >
            Reset
          </Button>
          <Button variant="ghost" block onClick={() => setConfirmReset(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
};
