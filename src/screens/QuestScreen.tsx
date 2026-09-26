import { ComingSoon } from '../components/ui/ComingSoon';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { iconIds } from '../assets/manifest';

type QuestScreenProps = { onBack: () => void };

export const QuestScreen = ({ onBack }: QuestScreenProps) => (
  <div className="anim-fade">
    <ScreenHeader title="Quest" subtitle="Daily objectives" onBack={onBack} />
    <ComingSoon
      icon={iconIds.quest}
      title="Quest"
      description="Daily and weekly objectives are designed together with the reward system in the next stage. Nothing is faked here."
      onBack={onBack}
    />
  </div>
);
