/**
 * Статистика игрока: считается из исходов партий.
 *
 * Модуль чистый: `applyMatch` берёт текущую статистику и результат партии,
 * возвращает новую. Никаких сайд-эффектов — поэтому всё проверяется тестами.
 */

import { MODES } from './modes';
import type { ModeId, ModeStats, Stats } from './types';

/** Победа быстрее этой отметки считается быстрой. */
export const FAST_WIN_MS = 60_000;

/** Пустая статистика по режиму. */
export const EMPTY_MODE_STATS: ModeStats = { played: 0, wins: 0, bestTimeMs: null };

/** Пустая статистика по всем режимам сразу. */
export function emptyByMode(): Readonly<Record<ModeId, ModeStats>> {
  const result = {} as Record<ModeId, ModeStats>;
  for (const mode of MODES) {
    result[mode.id] = EMPTY_MODE_STATS;
  }
  return result;
}

/** Статистика нового игрока. */
export const EMPTY_STATS: Stats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  currentStreak: 0,
  bestStreak: 0,
  cellsOpened: 0,
  flagsPlaced: 0,
  hintsUsed: 0,
  cleanWins: 0,
  fastWins: 0,
  playTimeMs: 0,
  byMode: emptyByMode(),
};

/** Итог партии, который уезжает в статистику. */
export interface MatchResult {
  readonly mode: ModeId;
  readonly won: boolean;
  /** Время партии, мс. */
  readonly timeMs: number;
  readonly cellsOpened: number;
  readonly flagsPlaced: number;
  readonly hintsUsed: number;
}

/** Добавить исход партии в статистику. */
export function applyMatch(stats: Stats, result: MatchResult): Stats {
  const streak = result.won ? stats.currentStreak + 1 : 0;
  const modeStats = stats.byMode[result.mode] ?? EMPTY_MODE_STATS;
  const bestTimeMs = result.won
    ? modeStats.bestTimeMs === null
      ? result.timeMs
      : Math.min(modeStats.bestTimeMs, result.timeMs)
    : modeStats.bestTimeMs;

  return {
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (result.won ? 1 : 0),
    losses: stats.losses + (result.won ? 0 : 1),
    currentStreak: streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    cellsOpened: stats.cellsOpened + result.cellsOpened,
    flagsPlaced: stats.flagsPlaced + result.flagsPlaced,
    hintsUsed: stats.hintsUsed + result.hintsUsed,
    cleanWins: stats.cleanWins + (result.won && result.hintsUsed === 0 ? 1 : 0),
    fastWins: stats.fastWins + (result.won && result.timeMs <= FAST_WIN_MS ? 1 : 0),
    playTimeMs: stats.playTimeMs + result.timeMs,
    byMode: {
      ...stats.byMode,
      [result.mode]: {
        played: modeStats.played + 1,
        wins: modeStats.wins + (result.won ? 1 : 0),
        bestTimeMs,
      },
    },
  };
}

/** Доля побед, 0..1. */
export function winRate(stats: Stats): number {
  if (stats.gamesPlayed === 0) return 0;
  return stats.wins / stats.gamesPlayed;
}

/** Среднее время партии, мс. */
export function averageTimeMs(stats: Stats): number | null {
  if (stats.gamesPlayed === 0) return null;
  return Math.round(stats.playTimeMs / stats.gamesPlayed);
}

/** Рекорд режима. */
export function bestTimeFor(stats: Stats, mode: ModeId): number | null {
  return stats.byMode[mode]?.bestTimeMs ?? null;
}

// ── Оценка уровня кампании ──────────────────────────────────────────────────

/** Сколько секунд даётся на мину, чтобы уложиться на три звезды. */
const SECONDS_PER_MINE = 5;
/** Минимальный «паритет» уровня, мс: совсем маленькие поля не должны быть злыми. */
const MIN_PAR_MS = 25_000;

/** Время, за которое уровень проходится на три звезды. */
export function parTimeMs(mines: number): number {
  return Math.max(MIN_PAR_MS, mines * SECONDS_PER_MINE * 1000);
}

/**
 * Оценка пройденного уровня: 1–3 звезды.
 *
 * Три — уложился в паритет и не брал подсказок, две — вдвое дольше или одна
 * подсказка, иначе одна звезда. Оценка нужна и как украшение карты, и как
 * награда: звёзды за первое прохождение падают в кошелёк.
 */
export function starsForLevel(mines: number, timeMs: number, hintsUsed: number): 1 | 2 | 3 {
  const par = parTimeMs(mines);
  if (hintsUsed === 0 && timeMs <= par) return 3;
  if (hintsUsed <= 1 && timeMs <= par * 2) return 2;
  return 1;
}
