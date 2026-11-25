/**
 * Мета-прогресс: что происходит с прогрессом на исходе партии.
 *
 * Одна чистая функция собирает всё вместе: статистику, счётчики дня,
 * достижения и звёзды за них. Магазин тем — тоже здесь.
 */

import { newAchievements, starsFor } from './achievements';
import { addMatchToDaily, claimableTasks, dateKey, rollDaily, EMPTY_COUNTERS, EMPTY_DAILY } from './daily';
import { EMPTY_STATS, applyMatch } from './stats';
import { DEFAULT_THEME, findTheme, isThemeUnlocked } from './themes';
import type { MetaState, ModeId, ThemeId } from './types';

/** Мета-прогресс нового игрока. */
export const EMPTY_META: MetaState = {
  stars: 0,
  themeId: DEFAULT_THEME,
  unlockedThemes: [DEFAULT_THEME],
  stats: EMPTY_STATS,
  achievements: [],
  daily: EMPTY_DAILY,
  vibrationEnabled: true,
  tutorialSeen: false,
};

/** Итог партии, который уходит в мета-прогресс. */
export interface MatchEnd {
  readonly mode: ModeId;
  readonly won: boolean;
  readonly timeMs: number;
  readonly cellsOpened: number;
  readonly flagsPlaced: number;
  readonly hintsUsed: number;
  /** Уровень кампании на момент окончания партии. */
  readonly level: number;
  readonly now: number;
}

/**
 * Применить исход партии: статистика, счётчики дня, достижения и звёзды.
 * Задачи дня награждаются сами, как только цель достигнута.
 */
export function applyMatchEnd(meta: MetaState, end: MatchEnd): MetaState {
  const stats = applyMatch(meta.stats, end);
  const daily = addMatchToDaily(rollDaily(meta.daily, dateKey(end.now)), end);

  const unlocked = newAchievements({ stats, level: end.level }, meta.achievements);
  const achievements = [...meta.achievements, ...unlocked.map((item) => item.id)];
  const starred: MetaState = {
    ...meta,
    stats,
    daily,
    achievements,
    stars: meta.stars + starsFor(unlocked),
  };

  const claimable = claimableTasks(starred.daily);
  if (claimable.length === 0) return starred;

  return {
    ...starred,
    stars: starred.stars + claimable.reduce((sum, task) => sum + task.stars, 0),
    daily: {
      ...starred.daily,
      claimed: [...starred.daily.claimed, ...claimable.map((task) => task.id)],
    },
  };
}

/**
 * Купить тему за звёзды и сразу её включить.
 * Если звёзд не хватает или тема уже открыта — состояние не меняется.
 */
export function buyTheme(meta: MetaState, theme: ThemeId): MetaState {
  const preset = findTheme(theme);
  if (isThemeUnlocked(meta.unlockedThemes, theme)) return { ...meta, themeId: theme };
  if (meta.stars < preset.price) return meta;

  return {
    ...meta,
    stars: meta.stars - preset.price,
    themeId: theme,
    unlockedThemes: [...meta.unlockedThemes, theme],
  };
}

/** Включить уже открытую тему. */
export function setTheme(meta: MetaState, theme: ThemeId): MetaState {
  if (!isThemeUnlocked(meta.unlockedThemes, theme)) return meta;
  return meta.themeId === theme ? meta : { ...meta, themeId: theme };
}

/** Сбросить счётчики, если наступил новый день (вызывается при запуске). */
export function rollDailyIfNeeded(meta: MetaState, now: number): MetaState {
  const daily = rollDaily(meta.daily, dateKey(now));
  return daily === meta.daily ? meta : { ...meta, daily };
}

/** Пустые счётчики дня — реэкспорт для тестов и стора. */
export { EMPTY_COUNTERS };
