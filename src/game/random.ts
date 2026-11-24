/**
 * Случайность игры.
 *
 * Все «случайные» решения выводятся из зерна (`seed`), а не из глобального
 * `Math.random` внутри игровой логики. Это даёт:
 * - воспроизводимые тесты (одно зерно → одно поле);
 * - чистый редьюсер (одинаковый вход → одинаковый выход, важно для StrictMode);
 * - возможность повторить конкретную партию по зерну.
 */

import type { Rng } from './types';

/** Зерно по умолчанию — для новой партии в рантайме. */
export function createSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffff_ffff)) >>> 0;
}

/**
 * mulberry32 — компактный детерминированный PRNG.
 * Возвращает функцию, выдающую числа в диапазоне [0, 1).
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/** Целое число в диапазоне [0, maxExclusive). */
export function randomInt(maxExclusive: number, rng: Rng): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(`randomInt: ожидалось целое > 0, получено ${String(maxExclusive)}`);
  }
  return Math.floor(rng() * maxExclusive);
}

/** Копия массива в случайном порядке (Fisher–Yates). Исходный массив не мутируется. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1, rng);
    const a = result[i];
    const b = result[j];
    if (a === undefined || b === undefined) continue;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/** Случайный элемент или `undefined`, если массив пуст. */
export function pickOne<T>(items: readonly T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  return items[randomInt(items.length, rng)];
}

/** Детерминированное зерно-потомок: `base` + счётчик попыток. */
export function deriveSeed(base: number, attempt: number): number {
  return (base + Math.imul(attempt + 1, 0x9e37_79b9)) >>> 0;
}
