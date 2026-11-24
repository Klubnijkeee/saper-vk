/**
 * Прогресс между сессиями: что сохраняем и как читаем обратно.
 *
 * Модуль чистый: превращает состояние партии в набор значений для хранилища
 * и разбирает то, что хранилище вернуло (включая мусор и подделанные значения).
 * Ошибки ввода-вывода живут отдельно — в `src/vk/storage.ts`.
 */

import type { GameState, StoredProgress } from './types';

/** Ключи в хранилище (по ТЗ). */
export const PROGRESS_KEYS = {
  coins: 'coins',
  level: 'level',
  bestTime: 'bestTime',
  soundEnabled: 'soundEnabled',
} as const;

/** Значения по умолчанию: первый запуск. */
export const DEFAULT_PROGRESS: StoredProgress = {
  coins: 0,
  level: 1,
  bestTime: null,
  soundEnabled: true,
};

/**
 * Что записываем по текущему состоянию партии.
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
  };
}

/** Прогресс не изменился? Тогда в хранилище не пишем. */
export function isSameProgress(left: StoredProgress, right: StoredProgress): boolean {
  return (
    left.coins === right.coins &&
    left.level === right.level &&
    left.bestTime === right.bestTime &&
    left.soundEnabled === right.soundEnabled
  );
}

/** Сериализация: в хранилище лежат только строки. */
export function progressToRaw(progress: StoredProgress): Readonly<Record<string, string>> {
  return {
    [PROGRESS_KEYS.coins]: String(progress.coins),
    [PROGRESS_KEYS.level]: String(progress.level),
    [PROGRESS_KEYS.bestTime]: progress.bestTime === null ? '' : String(progress.bestTime),
    [PROGRESS_KEYS.soundEnabled]: progress.soundEnabled ? 'true' : 'false',
  };
}

/**
 * Разбор значений из хранилища.
 * Всё нечисловое, отрицательное и невозможное заменяем дефолтами: данные
 * могли остаться от старой версии приложения или быть испорченными.
 */
export function progressFromRaw(values: ReadonlyMap<string, string>): StoredProgress {
  return {
    coins: parseCount(values.get(PROGRESS_KEYS.coins)),
    level: parseLevel(values.get(PROGRESS_KEYS.level)),
    bestTime: parseBestTime(values.get(PROGRESS_KEYS.bestTime)),
    soundEnabled: parseBoolean(values.get(PROGRESS_KEYS.soundEnabled)),
  };
}

function parseCount(raw: string | undefined): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_PROGRESS.coins;
}

function parseLevel(raw: string | undefined): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value >= 1 ? value : DEFAULT_PROGRESS.level;
}

function parseBestTime(raw: string | undefined): number | null {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseBoolean(raw: string | undefined): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return DEFAULT_PROGRESS.soundEnabled;
}
