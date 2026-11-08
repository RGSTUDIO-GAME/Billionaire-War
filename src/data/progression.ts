export const MAX_PLAYER_LEVEL = 100;
export const MAX_BATTLE_LEVEL = 100;
export const BATTLE_XP_PER_WIN = { bot: 10, pvp: 20 } as const;

export const battleXpForNextLevel = (level: number): number => {
  const safeLevel = Math.max(1, Math.min(MAX_BATTLE_LEVEL - 1, Math.floor(level)));
  return Math.round(80 + safeLevel * 20 + 2.5 * Math.pow(safeLevel, 1.45));
};

export const totalBattleXpForLevel = (level: number): number => {
  const safeLevel = Math.max(1, Math.min(MAX_BATTLE_LEVEL, Math.floor(level)));
  let total = 0;
  for (let current = 1; current < safeLevel; current += 1) total += battleXpForNextLevel(current);
  return total;
};

export const maxBattleXp = (): number => totalBattleXpForLevel(MAX_BATTLE_LEVEL);

export type BattleProgression = {
  level: number;
  currentXp: number;
  requiredXp: number;
  totalXp: number;
  progress: number;
  maxed: boolean;
};

export const battleProgression = (rawXp: number): BattleProgression => {
  const totalXp = Math.max(0, Math.min(maxBattleXp(), Math.floor(rawXp)));
  let level = 1;
  while (level < MAX_BATTLE_LEVEL && totalXp >= totalBattleXpForLevel(level + 1)) level += 1;
  const levelStart = totalBattleXpForLevel(level);
  const requiredXp = level >= MAX_BATTLE_LEVEL ? 0 : battleXpForNextLevel(level);
  const currentXp = totalXp - levelStart;
  return {
    level,
    currentXp,
    requiredXp,
    totalXp,
    progress: level >= MAX_BATTLE_LEVEL ? 1 : Math.min(1, currentXp / requiredXp),
    maxed: level >= MAX_BATTLE_LEVEL,
  };
};

export const fusionBattleLevelRequirement = (nextStars: number): number =>
  [0, 1, 10, 25, 45, 70, 100][Math.max(1, Math.min(6, Math.floor(nextStars)))] ?? 100;

/**
 * XP needed for the next level. The curve starts at 147 XP (roughly two days
 * of one Common plot) and reaches about 5.9k XP at Level 99, keeping the late
 * game meaningful without making a full 50-plot farm feel stagnant.
 */
export const xpForNextLevel = (level: number): number => {
  const safeLevel = Math.max(1, Math.min(MAX_PLAYER_LEVEL - 1, Math.floor(level)));
  return Math.round(120 + safeLevel * 24 + 3.5 * Math.pow(safeLevel, 1.5));
};

export const totalXpForLevel = (level: number): number => {
  const safeLevel = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)));
  let total = 0;
  for (let current = 1; current < safeLevel; current += 1) total += xpForNextLevel(current);
  return total;
};

export const maxPlayerXp = (): number => totalXpForLevel(MAX_PLAYER_LEVEL);

/**
 * Farm plots unlock in a light progression. The first five plots are
 * available at Level 1, then the remaining 45 plots are spread evenly until
 * the final plot opens exactly at Level 100.
 */
export const unlockedPlotCount = (level: number): number => {
  const safeLevel = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)));
  return 5 + Math.floor(((safeLevel - 1) * 45) / (MAX_PLAYER_LEVEL - 1));
};

export const farmPlotUnlockLevel = (plotIndex: number): number => {
  if (plotIndex < 5) return 1;
  return Math.min(MAX_PLAYER_LEVEL, 1 + Math.ceil(((plotIndex - 4) * 99) / 45));
};

export type PlayerProgression = {
  level: number;
  currentXp: number;
  requiredXp: number;
  totalXp: number;
  progress: number;
  maxed: boolean;
};

export const playerProgression = (rawXp: number): PlayerProgression => {
  const totalXp = Math.max(0, Math.min(maxPlayerXp(), Math.floor(rawXp)));
  let level = 1;
  while (level < MAX_PLAYER_LEVEL && totalXp >= totalXpForLevel(level + 1)) level += 1;
  const levelStart = totalXpForLevel(level);
  const requiredXp = level >= MAX_PLAYER_LEVEL ? 0 : xpForNextLevel(level);
  const currentXp = totalXp - levelStart;
  return {
    level,
    currentXp,
    requiredXp,
    totalXp,
    progress: level >= MAX_PLAYER_LEVEL ? 1 : Math.min(1, currentXp / requiredXp),
    maxed: level >= MAX_PLAYER_LEVEL,
  };
};
