/**
 * Ввод-вывод прогресса: VKWebAppStorage внутри ВКонтакте, localStorage в браузере.
 *
 * Вся логика «что сохраняем и как разбираем» — в `src/game/progress.ts`.
 * Здесь только транспорт: выбрать бэкенд, прочитать строки, записать строки.
 *
 * Решение о бэкенде принимается после инициализации моста: иначе внутри ВК
 * можно прочитать из localStorage и «потерять» сохранённый прогресс.
 * Мини-приложение ВК всегда открывается в iframe, поэтому вне ВК ответ
 * приходит мгновенно (см. `initVkBridge`).
 */

import { PROGRESS_KEYS, progressFromRaw, progressToRaw } from '../game/progress';
import type { ProgressPersistence, StoredProgress } from '../game/types';
import { initVkBridge, isBridgeReady, storageGet, storageSet } from './bridge';

/** Все ключи прогресса. */
const ALL_KEYS: readonly string[] = Object.values(PROGRESS_KEYS);

/**
 * Префикс для localStorage-фолбэка: там ключи общие для всего origin,
 * поэтому хранить `level` и `coins` без префикса — плохая идея.
 */
const LOCAL_PREFIX = 'saper:';

function localGet(key: string): string | null {
  try {
    return window.localStorage.getItem(`${LOCAL_PREFIX}${key}`);
  } catch {
    // приватный режим или отключённое хранилище
    return null;
  }
}

function localSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(`${LOCAL_PREFIX}${key}`, value);
  } catch {
    // тишина: игра работает и без сохранения
  }
}

/** Чтение всех ключей прогресса из активного бэкенда. */
async function readAll(keys: readonly string[]): Promise<ReadonlyMap<string, string>> {
  await initVkBridge();

  if (isBridgeReady()) return storageGet(keys);

  const values = new Map<string, string>();
  for (const key of keys) {
    const raw = localGet(key);
    if (raw !== null) values.set(key, raw);
  }
  return values;
}

/** Запись значений в активный бэкенд. */
async function writeAll(values: Readonly<Record<string, string>>): Promise<void> {
  await initVkBridge();

  if (isBridgeReady()) {
    await storageSet(values);
    return;
  }

  for (const [key, value] of Object.entries(values)) {
    localSet(key, value);
  }
}

/** Загрузить прогресс. `null` — в хранилище пусто (первый запуск). */
export async function loadProgress(): Promise<Partial<StoredProgress> | null> {
  const values = await readAll(ALL_KEYS);
  if (values.size === 0) return null;
  return progressFromRaw(values);
}

/** Сохранить прогресс (монеты, уровень, рекорд, звук). */
export async function saveProgress(progress: StoredProgress): Promise<void> {
  await writeAll(progressToRaw(progress));
}

/** Готовый порт сохранения для `useGame`. */
export const vkPersistence: ProgressPersistence = {
  loadProgress,
  saveProgress,
};
