/**
 * Часы партии.
 *
 * Время хранится как «накопленное + момент старта текущего отрезка».
 * На каждом тике отрезок сворачивается в накопленное (`elapsedMs`),
 * поэтому пауза, победа и проигрыш просто останавливают отрезок,
 * а точность не зависит от частоты тиков — рекорд не «плывёт» от дрейфа
 * интервалов и от того, как часто браузер будит таймер.
 */

import type { Clock } from './types';

/** Сколько времени прошло на момент последнего пересчёта, мс. */
export function elapsedOf(clock: Clock): number {
  return clock.elapsedMs;
}

/** Часы идут? */
export function isClockRunning(clock: Clock): boolean {
  return clock.startedAt !== null;
}

/** Запустить часы, если они стоят (накопленное время сохраняется). */
export function startClock(clock: Clock, now: number): Clock {
  if (isClockRunning(clock)) return clock;
  return { startedAt: now, elapsedMs: clock.elapsedMs };
}

/**
 * Остановить часы, зафиксировав текущий отрезок
 * (пауза, победа, проигрыш). Идемпотентна.
 */
export function freezeClock(clock: Clock, now: number): Clock {
  if (clock.startedAt === null) return clock;
  return {
    startedAt: null,
    elapsedMs: clock.elapsedMs + Math.max(0, now - clock.startedAt),
  };
}

/**
 * Свернуть текущий отрезок в накопленное время и начать новый.
 * Возвращает тот же объект, если время не двигалось — чтобы не будить React.
 */
export function tickClock(clock: Clock, now: number): Clock {
  if (clock.startedAt === null) return clock;
  const delta = now - clock.startedAt;
  if (delta <= 0) return clock;
  return { startedAt: now, elapsedMs: clock.elapsedMs + delta };
}

/** Новые часы с нуля. */
export function resetClock(): Clock {
  return { startedAt: null, elapsedMs: 0 };
}

/** Время в формате MM:SS (для таймера и рекорда). */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
