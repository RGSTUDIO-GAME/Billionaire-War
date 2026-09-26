import type { BattleState } from './types';

/**
 * Toggleable debug logging for the battle engine.
 *
 * Defaults to ON in development and OFF in production. It can also be flipped
 * at runtime from Settings so the exact same code path can be inspected.
 */
let enabled = detectDevelopment();

function detectDevelopment(): boolean {
  try {
    const meta = import.meta as unknown as { env?: { DEV?: boolean } };
    return meta.env?.DEV === true;
  } catch {
    return false;
  }
}

export const isDebugEnabled = (): boolean => enabled;

export const setDebugEnabled = (value: boolean): void => {
  enabled = value;
};

const PART = (value: string | null): string => (value === null ? 'NONE' : value.toUpperCase());

/** Logs a full round snapshot in the format used for manual verification. */
export const logRound = (state: BattleState): void => {
  if (!enabled) return;
  const { playerA: a, playerB: b, currentRound } = state;
  /* eslint-disable no-console */
  console.groupCollapsed(
    `%c[Battle ${state.battleId}] Round ${currentRound} - ${state.status}`,
    'color:#F5C542;font-weight:bold',
  );
  console.log(`A Attack : ${PART(a.attackTarget)}   A Defense: ${PART(a.defenseTarget)}   confirmed=${a.confirmed}`);
  console.log(`B Attack : ${PART(b.attackTarget)}   B Defense: ${PART(b.defenseTarget)}   confirmed=${b.confirmed}`);
  console.log(`A HP     : ${a.currentHp}/${a.maxHp}      B HP     : ${b.currentHp}/${b.maxHp}`);
  if (state.currentRoundRecord) {
    for (const attack of state.currentRoundRecord.attacks) {
      console.log(
        `#${attack.order} ${attack.attacker} -> ${attack.target} : ` +
          `${PART(attack.attackTarget)} vs ${PART(attack.targetDefense)} = ` +
          `${attack.outcome} (${attack.damage})`,
      );
    }
  }
  console.groupEnd();
  /* eslint-enable no-console */
};

/** Logs a battle-level message. Silent unless debug mode is on. */
export const logBattle = (message: string, state?: BattleState): void => {
  if (!enabled) return;
  const suffix = state ? ` [${state.battleId} ${state.status}]` : '';
  // eslint-disable-next-line no-console
  console.log(`[Battle]${suffix} ${message}`);
};
