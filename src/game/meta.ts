/**
 * Мета-прогресс: что происходит с прогрессом на исходе партии.
 *
 * Одна чистая функция собирает всё вместе: статистику, счётчики дня,
 * достижения и звёзды за них. Магазин тем — тоже здесь.
 */

import { newAchievements, starsFor } from './achievements';
import { addMatchToDaily, claimableTasks, dateKey, rollDaily, EMPTY_COUNTERS, EMPTY_DAILY } from './daily';
import {
  LIFE_PRICE_STARS,
  MAX_LIVES,
  addLives,
  refreshLives,
  spendLife,
  type LivesState,
} from './lives';
import { EMPTY_STATS, applyMatch, starsForLevel } from './stats';
import { DEFAULT_THEME, findTheme, isThemeUnlocked } from './themes';
import type { MetaState, ModeId, ThemeId } from './types';

/** Мета-прогресс нового игрока. */
export const EMPTY_META: MetaState = {
  stars: 0,
  themeId: DEFAULT_THEME,
  unlockedThemes: [DEFAULT_THEME],
  stats: EMPTY_STATS,
  achievements: [],
  campaignLevel: 1,
  levelStars: {},
  lives: MAX_LIVES,
  livesAt: 0,
  daily: EMPTY_DAILY,
  vibrationEnabled: true,
  tutorialSeen: false,
};

/** Жизни в виде отдельного состояния. */
export function livesOf(meta: MetaState): LivesState {
  return { lives: meta.lives, updatedAt: meta.livesAt };
}

/** Пересчитать жизни по времени. Возвращает тот же объект, если менять нечего. */
export function refreshMetaLives(meta: MetaState, now: number): MetaState {
  const next = refreshLives(livesOf(meta), now);
  if (next.lives === meta.lives && next.updatedAt === meta.livesAt) return meta;
  return { ...meta, lives: next.lives, livesAt: next.updatedAt };
}

/**
 * Купить жизнь за звёзды.
 * Если жизни полны или звёзд не хватает — состояние не меняется.
 */
export function buyLife(meta: MetaState, now: number): MetaState {
  const current = refreshLives(livesOf(meta), now);
  if (current.lives >= MAX_LIVES) return meta;
  if (meta.stars < LIFE_PRICE_STARS) return meta;

  const next = addLives(current, 1, now);
  return {
    ...meta,
    stars: meta.stars - LIFE_PRICE_STARS,
    lives: next.lives,
    livesAt: next.updatedAt,
  };
}

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
  /** Сколько мин было на поле — от этого зависит оценка уровня. */
  readonly mines: number;
  readonly now: number;
}

/** Результат начисления звёзд за уровень. */
export interface LevelAward {
  readonly levelStars: Readonly<Record<string, number>>;
  /** Сколько звёзд добавлено в кошелёк (только за улучшение). */
  readonly gained: number;
  /** Лучшая оценка уровня после этой партии. */
  readonly earned: number;
}

/**
 * Оценка уровня кампании.
 *
 * Оценка только растёт: переиграл на три звезды — в кошелёк упадёт разница.
 * Так звёзды за уровни не фармятся бесконечными повторами.
 */
export function awardLevelStars(
  current: Readonly<Record<string, number>>,
  level: number,
  mines: number,
  timeMs: number,
  hintsUsed: number,
): LevelAward {
  const earned = starsForLevel(mines, timeMs, hintsUsed);
  const key = String(level);
  const previous = current[key] ?? 0;

  if (earned <= previous) {
    return { levelStars: current, gained: 0, earned: previous };
  }

  return {
    levelStars: { ...current, [key]: earned },
    gained: earned - previous,
    earned,
  };
}

/**
 * Применить исход партии: статистика, счётчики дня, достижения и звёзды.
 * Задачи дня награждаются сами, как только цель достигнута.
 */
export function applyMatchEnd(meta: MetaState, end: MatchEnd): MetaState {
  const stats = applyMatch(meta.stats, end);
  const daily = addMatchToDaily(rollDaily(meta.daily, dateKey(end.now)), end);

  // Уровни кампании получают оценку; в свободной игре оценивать нечего.
  const award =
    end.mode === 'campaign' && end.won
      ? awardLevelStars(meta.levelStars, end.level, end.mines, end.timeMs, end.hintsUsed)
      : { levelStars: meta.levelStars, gained: 0, earned: 0 };

  const unlocked = newAchievements({ stats, level: end.level }, meta.achievements);
  const achievements = [...meta.achievements, ...unlocked.map((item) => item.id)];

  // Жизнь списывается за проигрыш в кампании: свободная игра — тренировка.
  const lives =
    end.mode === 'campaign' && !end.won
      ? spendLife(livesOf(meta), end.now)
      : refreshLives(livesOf(meta), end.now);

  const starred: MetaState = {
    ...meta,
    stats,
    daily,
    achievements,
    lives: lives.lives,
    livesAt: lives.updatedAt,
    // Прогресс кампании только растёт: перепройденный старый уровень его не откатит.
    campaignLevel:
      end.mode === 'campaign' && end.won
        ? Math.max(meta.campaignLevel, end.level + 1)
        : meta.campaignLevel,
    levelStars: award.levelStars,
    stars: meta.stars + starsFor(unlocked) + award.gained,
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
