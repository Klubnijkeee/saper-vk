/**
 * Прогресс между сессиями: что сохраняем и как читаем обратно.
 *
 * Модуль чистый: превращает состояние игры в набор значений для хранилища
 * и разбирает то, что хранилище вернуло. Данные могут остаться от старой версии
 * или быть испорченными, поэтому разбор терпимый: неизвестное значение
 * заменяется дефолтом, а не ломает игру.
 *
 * Ошибки ввода-вывода живут отдельно — в `src/vk/storage.ts`.
 */

import { EMPTY_COUNTERS, EMPTY_DAILY } from './daily';
import { EMPTY_MODE_STATS, EMPTY_STATS } from './stats';
import { DEFAULT_THEME, THEMES } from './themes';
import { MODES } from './modes';
import type {
  DailyCounters,
  DailyState,
  GameState,
  ModeId,
  ModeStats,
  Stats,
  StoredProgress,
  ThemeId,
} from './types';

/** Ключи в хранилище. Простые значения — строкой, сложные — строкой JSON. */
export const PROGRESS_KEYS = {
  coins: 'coins',
  level: 'level',
  bestTime: 'bestTime',
  soundEnabled: 'soundEnabled',
  stars: 'stars',
  theme: 'theme',
  themes: 'themes',
  stats: 'stats',
  achievements: 'achievements',
  daily: 'daily',
  vibration: 'vibration',
  tutorial: 'tutorial',
} as const;

/** Значения по умолчанию: первый запуск. */
export const DEFAULT_PROGRESS: StoredProgress = {
  coins: 0,
  level: 1,
  bestTime: null,
  soundEnabled: true,
  stars: 0,
  themeId: DEFAULT_THEME,
  unlockedThemes: [DEFAULT_THEME],
  stats: EMPTY_STATS,
  achievements: [],
  daily: EMPTY_DAILY,
  vibrationEnabled: true,
  tutorialSeen: false,
};

/**
 * Что записываем по текущему состоянию игры.
 *
 * Уровень после победы сохраняем уже следующим: выиграл 1-й уровень — при
 * следующем запуске начинаем со 2-го. До победы сохраняем текущий уровень.
 */
export function progressOf(state: GameState): StoredProgress {
  return {
    coins: state.coins,
    level: state.status === 'won' ? state.level + 1 : state.level,
    bestTime: state.bestTime,
    soundEnabled: state.soundEnabled,
    stars: state.meta.stars,
    themeId: state.meta.themeId,
    unlockedThemes: state.meta.unlockedThemes,
    stats: state.meta.stats,
    achievements: state.meta.achievements,
    daily: state.meta.daily,
    vibrationEnabled: state.meta.vibrationEnabled,
    tutorialSeen: state.meta.tutorialSeen,
  };
}

/** Прогресс не изменился? Тогда в хранилище не пишем. */
export function isSameProgress(left: StoredProgress, right: StoredProgress): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

/** Сериализация: в хранилище лежат только строки. */
export function progressToRaw(progress: StoredProgress): Readonly<Record<string, string>> {
  return {
    [PROGRESS_KEYS.coins]: String(progress.coins),
    [PROGRESS_KEYS.level]: String(progress.level),
    [PROGRESS_KEYS.bestTime]: progress.bestTime === null ? '' : String(progress.bestTime),
    [PROGRESS_KEYS.soundEnabled]: progress.soundEnabled ? 'true' : 'false',
    [PROGRESS_KEYS.stars]: String(progress.stars),
    [PROGRESS_KEYS.theme]: progress.themeId,
    [PROGRESS_KEYS.themes]: JSON.stringify(progress.unlockedThemes),
    [PROGRESS_KEYS.stats]: JSON.stringify(progress.stats),
    [PROGRESS_KEYS.achievements]: JSON.stringify(progress.achievements),
    [PROGRESS_KEYS.daily]: JSON.stringify(progress.daily),
    [PROGRESS_KEYS.vibration]: progress.vibrationEnabled ? 'true' : 'false',
    [PROGRESS_KEYS.tutorial]: progress.tutorialSeen ? 'true' : 'false',
  };
}

/** Разбор всего, что вернуло хранилище. */
export function progressFromRaw(values: ReadonlyMap<string, string>): StoredProgress {
  return {
    coins: parseCount(values.get(PROGRESS_KEYS.coins)),
    level: parseLevel(values.get(PROGRESS_KEYS.level)),
    bestTime: parseBestTime(values.get(PROGRESS_KEYS.bestTime)),
    soundEnabled: parseBoolean(values.get(PROGRESS_KEYS.soundEnabled), true),
    stars: parseCount(values.get(PROGRESS_KEYS.stars)),
    themeId: parseThemeId(values.get(PROGRESS_KEYS.theme)),
    unlockedThemes: parseThemes(values.get(PROGRESS_KEYS.themes)),
    stats: parseStats(values.get(PROGRESS_KEYS.stats)),
    achievements: parseIds(values.get(PROGRESS_KEYS.achievements)),
    daily: parseDaily(values.get(PROGRESS_KEYS.daily)),
    vibrationEnabled: parseBoolean(values.get(PROGRESS_KEYS.vibration), true),
    tutorialSeen: parseBoolean(values.get(PROGRESS_KEYS.tutorial), false),
  };
}

// ── Разбор значений ─────────────────────────────────────────────────────────

function parseJson(raw: string | undefined): unknown {
  if (raw === undefined || raw === '') return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Неотрицательное целое или дефолт. */
function asCount(value: unknown, fallback: number = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}

/** Положительное время в мс или `null`. */
function asTime(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function parseCount(raw: string | undefined): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function parseLevel(raw: string | undefined): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value >= 1 ? value : DEFAULT_PROGRESS.level;
}

function parseBestTime(raw: string | undefined): number | null {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

function parseThemeId(raw: string | undefined): ThemeId {
  const known = THEMES.some((theme) => theme.id === raw);
  return known ? (raw as ThemeId) : DEFAULT_THEME;
}

/** Список открытых тем: только известные id, тема по умолчанию — всегда. */
function parseThemes(raw: string | undefined): readonly ThemeId[] {
  const value = parseJson(raw);
  const list: ThemeId[] = [DEFAULT_THEME];

  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== 'string') continue;
      if (!THEMES.some((theme) => theme.id === item)) continue;
      const id = item as ThemeId;
      if (!list.includes(id)) list.push(id);
    }
  }

  return list;
}

function parseIds(raw: string | undefined): readonly string[] {
  const value = parseJson(raw);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseModeStats(value: unknown): ModeStats {
  const record = asRecord(value);
  if (record === null) return EMPTY_MODE_STATS;
  return {
    played: asCount(record['played']),
    wins: asCount(record['wins']),
    bestTimeMs: asTime(record['bestTimeMs']),
  };
}

function parseStats(raw: string | undefined): Stats {
  const value = asRecord(parseJson(raw));
  if (value === null) return EMPTY_STATS;

  const byModeRaw = asRecord(value['byMode']) ?? {};
  const byMode = {} as Record<ModeId, ModeStats>;
  for (const mode of MODES) {
    byMode[mode.id] = parseModeStats(byModeRaw[mode.id]);
  }

  return {
    gamesPlayed: asCount(value['gamesPlayed']),
    wins: asCount(value['wins']),
    losses: asCount(value['losses']),
    currentStreak: asCount(value['currentStreak']),
    bestStreak: asCount(value['bestStreak']),
    cellsOpened: asCount(value['cellsOpened']),
    flagsPlaced: asCount(value['flagsPlaced']),
    hintsUsed: asCount(value['hintsUsed']),
    cleanWins: asCount(value['cleanWins']),
    fastWins: asCount(value['fastWins']),
    playTimeMs: asCount(value['playTimeMs']),
    byMode,
  };
}

function parseCounters(value: unknown): DailyCounters {
  const record = asRecord(value);
  if (record === null) return EMPTY_COUNTERS;
  return {
    gamesPlayed: asCount(record['gamesPlayed']),
    wins: asCount(record['wins']),
    cellsOpened: asCount(record['cellsOpened']),
    flagsPlaced: asCount(record['flagsPlaced']),
    hintsUsed: asCount(record['hintsUsed']),
    cleanWins: asCount(record['cleanWins']),
    fastWins: asCount(record['fastWins']),
  };
}

function parseDaily(raw: string | undefined): DailyState {
  const value = asRecord(parseJson(raw));
  if (value === null) return EMPTY_DAILY;

  const date = typeof value['date'] === 'string' ? value['date'] : '';
  const claimedRaw = value['claimed'];
  const claimed = Array.isArray(claimedRaw)
    ? claimedRaw.filter((item): item is string => typeof item === 'string')
    : [];

  return { date, counters: parseCounters(value['counters']), claimed };
}
