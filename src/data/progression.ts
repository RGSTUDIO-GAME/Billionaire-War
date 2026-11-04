export const MAX_PLAYER_LEVEL = 100;

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

