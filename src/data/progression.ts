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

/** The number of plots available at a given level; plot 50 opens exactly at 100. */
export const unlockedPlotCount = (level: number): number => {
  const safeLevel = Math.max(1, Math.min(MAX_PLAYER_LEVEL, Math.floor(level)));
  return 1 + Math.floor(((safeLevel - 1) * 49) / (MAX_PLAYER_LEVEL - 1));
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
