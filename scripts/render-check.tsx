/**
 * BATTLE SCREEN RENDER VERIFICATION
 * =================================
 * Renders the real BattleScreen to static markup at every phase of a real
 * DUROV vs DUROV battle and asserts what the player would actually be looking
 * at. This is the end-to-end acceptance walk from the specification, checked
 * against real output instead of against the store.
 *
 * Run with: npm run verify
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { DUROV } from '../src/data/heroes/durov';
import { setDebugEnabled } from '../src/engine/debug';
import { BATTLE_STATUS } from '../src/engine/types';
import { BattleScreen } from '../src/screens/BattleScreen';
import { TopBar } from '../src/components/layout/TopBar';
import { settleBattleReward } from '../src/rewards/settleBattleReward';
import { isSelectionPhase, nextFlowStep } from '../src/presentation/flowPlan';
import { runFlowStep } from '../src/hooks/useBattleFlow';
import { useBattleStore } from '../src/state/battleStore';
import { usePlayerStore } from '../src/state/playerStore';

let passed = 0;
const failures: string[] = [];

const check = (name: string, condition: boolean, detail = ''): void => {
  if (condition) passed += 1;
  else failures.push(`${name}${detail ? ` - ${detail}` : ''}`);
};

// React's static renderer reads a store's server snapshot from
// getInitialState(), so scripts/verify.mjs swaps in a store whose snapshot is
// the live state. Without that swap this screen would render nothing at all.

const ROOT = process.cwd();
const store = () => useBattleStore.getState();
const battle = () => useBattleStore.getState().battle;

/** React separates adjacent text nodes with comments; drop them to read words. */
const readable = (html: string): string =>
  html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const shot = (): { html: string; words: string } => {
  const html = renderToStaticMarkup(<BattleScreen onExit={() => {}} onRematch={() => {}} />);
  return { html, words: readable(html) };
};

/* ---------------------------------------------------------- 1. selection */

setDebugEnabled(false);
// The check bundles share one in-memory storage, so start from a fresh player.
usePlayerStore.getState().resetProgress();
store().start('bot', DUROV, DUROV, 20260926);

const opening = shot();
check('screen: the battle opens on round 1', opening.words.includes('ROUND 1 / 3'), opening.words.slice(0, 80));
check('screen: both HP panels are labelled', opening.words.includes('YOUR HP') && opening.words.includes('ENEMY HP'));
check('screen: both fighters are named', opening.words.includes('YOU') && opening.words.includes('ENEMY'));
check('screen: both full HP pools are shown', (opening.words.match(/1000 \/ 1000/g) ?? []).length === 2);
check('screen: neither choice is readable', (opening.words.match(/ATK \?\?\?/g) ?? []).length === 2);
check('screen: the round log hides the choices', opening.words.includes('CHOICES ARE HIDDEN UNTIL FIGHT'));
check('screen: confirm waits for a full pick', opening.words.includes('Pick attack'));
check('screen: the clock starts at 30', opening.html.includes('aria-label="30 seconds left"'));
check('screen: the attack row offers all four parts', ['HEAD', 'BODY', 'ARM', 'LEG'].every((part) => opening.words.includes(part)));

setDebugEnabled(true);
check('screen: the debug inspector can be switched on', shot().html.includes('battle-debug'));
setDebugEnabled(false);

/* ------------------------------------------------------------- 2. picking */

store().selectAttack('head');
store().selectDefense('leg');

const picked = shot();
check('screen: a picked part is marked as selected', picked.html.includes('is-picked'));
check('screen: confirm becomes available', picked.words.includes('Confirm'));
check('screen: the picks are echoed back', picked.words.includes('Attack · HEAD') && picked.words.includes('Defense · LEG'));
check('screen: the enemy choice is still unreadable', picked.words.includes('ATK ??? · DEF ???'));

/* ----------------------------------------------------------- 3. countdown */

store().confirmPlayer();
check('store: both sides locked in starts the countdown at once', battle()?.status === BATTLE_STATUS.COUNTDOWN, String(battle()?.status));

const counting = shot();
check('screen: the selection panel is gone', !counting.words.includes('Pick attack'));
check('screen: the countdown is on screen', counting.html.includes('countdown'));
check('screen: both choices are announced as locked', counting.words.includes('Both choices locked'));

store().tickCountdown();
store().tickCountdown();
store().tickCountdown();
check('screen: FIGHT is announced at the end of the countdown', shot().words.includes('FIGHT!'));

/* ---------------------------------------------------------- 4. execution */

store().tickCountdown();
check('store: FIGHT hands over to execution', battle()?.status === BATTLE_STATUS.EXECUTION_PLAYER_A, String(battle()?.status));

const swinging = shot();
check('screen: the attacker lunges', swinging.html.includes('is-attacking'));
check('screen: the choices are revealed at last', swinging.html.includes('chip--atk') && !swinging.html.includes('chip--locked'));
check('screen: the selection panel stays hidden', !swinging.words.includes('Pick attack'));

store().applyPlayerAAttack();
const firstLanded = shot();
const firstAttack = battle()?.currentRoundRecord?.attacks[0];
check('screen: the log reports the player attack', firstLanded.words.includes('YOU:'), firstLanded.words.slice(0, 120));
check(
  'screen: the damage popup matches the engine outcome',
  firstLanded.words.includes(firstAttack?.outcome === 'BLOCK' ? 'BLOCK 0' : `HIT -${firstAttack?.damage}`),
  `outcome=${firstAttack?.outcome} damage=${firstAttack?.damage}`,
);

store().applyPlayerBAttack();
const bothLanded = shot();
check('screen: both attacks appear in the log', bothLanded.words.includes('YOU:') && bothLanded.words.includes('ENEMY:'));
check('screen: the round summary is announced', bothLanded.words.includes('ROUND 1 COMPLETE'), bothLanded.words.slice(-160));

/* ------------------------------------------------------ 5. round transition */

store().finishRound();
const nextRound = shot();
check('screen: the next round is announced', nextRound.words.includes('ROUND 2 / 3'), nextRound.words.slice(-160));
check('screen: selection is not offered during the beat', !nextRound.words.includes('Pick attack'));

store().openNextRound();
const reopened = shot();
check('screen: selection reopens for the new round', reopened.words.includes('Pick attack'));
check('screen: the clock is reset to 30', reopened.html.includes('aria-label="30 seconds left"'));
check('screen: the previous picks are cleared', reopened.words.includes('Attack · NOT SET'));

/* ------------------------------------------------------------- 6. the end */

/**
 * Rounds two and three are advanced by the same flow plan the UI uses, so a
 * phase that loses its scheduled step fails this check too - the screen would
 * simply never show the next round's pickers.
 */
let guard = 0;
while (battle()?.status !== BATTLE_STATUS.BATTLE_RESULT && guard < 400) {
  guard += 1;
  const current = battle();
  if (!current) break;

  if (isSelectionPhase(current.status)) {
    const actions = store();
    if (current.playerA.attackTarget === null) actions.selectAttack('head');
    if (current.playerA.defenseTarget === null) actions.selectDefense('leg');
    if (current.playerA.confirmed) store().tickSecond();
    else store().confirmPlayer();
    continue;
  }

  const step = nextFlowStep(current.status);
  if (step.kind === 'HOLD') continue;
  runFlowStep(step);
}

check('screen: the battle runs its remaining rounds unattended', battle()?.status === BATTLE_STATUS.BATTLE_RESULT, `status=${battle()?.status}`);
check('screen: it got there in a sane number of steps', guard < 400, String(guard));

const finished = battle();

/**
 * The reward is fired from an effect, which a static render never runs, so the
 * check performs the exact call `useBattleReward` makes.
 */
const settled = settleBattleReward();
const goldAfterReward = usePlayerStore.getState().gold;
const result = shot();
check('screen: the battle reaches a result', finished?.status === BATTLE_STATUS.BATTLE_RESULT, String(finished?.status));
check('screen: it never runs a fourth round', (finished?.roundHistory.length ?? 0) <= 3, String(finished?.roundHistory.length));
check(
  'screen: the outcome headline is shown',
  result.words.includes(finished?.winner === 'A' ? 'VICTORY' : finished?.winner === 'B' ? 'DEFEAT' : 'DRAW'),
  `winner=${String(finished?.winner)}`,
);
check('screen: the final HP is reported', result.words.includes(String(finished?.playerA.currentHp)));
check('screen: damage dealt is reported', result.words.includes('Damage dealt'));
check('screen: damage taken is reported', result.words.includes('Damage taken'));
check('screen: the round count is reported', result.words.includes('Rounds'));
check('screen: the reward is granted for the finished battle', settled?.status === 'GRANTED', String(settled?.status));
check('screen: the reward is shown', result.words.includes('REWARD'));
const rewardAmount = usePlayerStore.getState().lastReward?.amount ?? 0;
check('screen: the reward amount comes from configuration',
  result.words.includes(`+${rewardAmount.toLocaleString('en-US')} GOLD`), result.words.slice(-200));
check('screen: the resulting balance is shown', result.words.includes(`Balance ${goldAfterReward.toLocaleString('en-US')} GOLD`));
check('screen: the mode is named on the reward', result.words.includes('VS BOT'));
check('screen: battle again is offered', result.words.includes('Battle again'));
check('screen: home is offered', result.words.includes('Home'));

/* ---------------------------------------- 7. the balance reaches the player */

const topbar = renderToStaticMarkup(<TopBar onLeaderboard={() => {}} onBwarPress={() => {}} />);
check('home: the $GOLD pill shows the rewarded balance', readable(topbar).includes(goldAfterReward.toLocaleString('en-US')),
  `${goldAfterReward.toLocaleString('en-US')} not in ${readable(topbar).slice(0, 160)}`);
check('home: $BWAR stays locked and untouched', topbar.includes('aria-label="$BWAR balance"') && topbar.includes('currency--bwar'));

/* -------------------------------------- 8. a new battle drops the reward */

const firstBattleId = finished?.battleId;
const beforeRematch = usePlayerStore.getState().gold;
store().rematch();
usePlayerStore.getState().clearLastReward();
const fresh = shot();
check('rematch: a new battle gets a new id', battle()?.battleId !== firstBattleId, String(battle()?.battleId));
check('rematch: the new battle shows no reward from the last one', !fresh.words.includes('+0 GOLD'), fresh.words.slice(-200));
check('rematch: the balance is carried over, not reset', usePlayerStore.getState().gold === beforeRematch);
check('rematch: the previous reward is still in the ledger', usePlayerStore.getState().goldTransactions.length === 1);
check('rematch: the new battle has full HP again', fresh.words.includes('1000 / 1000'));

/* ----------------------------------------- 9. the hook is actually wired */

{
  const hook = readFileSync(join(ROOT, 'src', 'hooks', 'useBattleReward.ts'), 'utf8');
  check('wiring: the reward hook calls the coordinator', hook.includes('settleBattleReward()'));
  check('wiring: the reward only fires on a finished battle', hook.includes('if (battleFinished)'));
}

/* ----------------------------------------------------------------- report */

if (failures.length > 0) {
  console.error(`\n${failures.length} render check(s) FAILED:\n`);
  for (const failure of failures) console.error(`  x ${failure}`);
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(1);
}

console.log(`All ${passed} battle screen render checks passed.`);
