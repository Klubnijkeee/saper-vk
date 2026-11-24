/**
 * Тесты часов: форматирование и чистые операции над отрезками времени.
 */

import { describe, expect, it } from 'vitest';
import {
  elapsedOf,
  formatClock,
  freezeClock,
  isClockRunning,
  resetClock,
  startClock,
  tickClock,
} from '../src/game/clock';

const T0 = 1_700_000_000_000;

describe('clock: формат', () => {
  it('MM:SS с ведущими нулями', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(999)).toBe('00:00');
    expect(formatClock(1000)).toBe('00:01');
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(600_000)).toBe('10:00');
    expect(formatClock(3_600_000)).toBe('60:00');
  });

  it('отрицательное время не показывается как мусор', () => {
    expect(formatClock(-5000)).toBe('00:00');
  });
});

describe('clock: операции', () => {
  it('resetClock — нулевые стоящие часы', () => {
    expect(resetClock()).toEqual({ startedAt: null, elapsedMs: 0 });
    expect(isClockRunning(resetClock())).toBe(false);
    expect(elapsedOf(resetClock())).toBe(0);
  });

  it('startClock запускает стоящие часы и не сбрасывает накопленное', () => {
    const stopped = { startedAt: null, elapsedMs: 4000 };
    expect(startClock(stopped, T0)).toEqual({ startedAt: T0, elapsedMs: 4000 });

    const running = { startedAt: T0, elapsedMs: 4000 };
    expect(startClock(running, T0 + 999)).toBe(running);
  });

  it('tickClock сворачивает отрезок в накопленное и начинает новый', () => {
    const running = { startedAt: T0, elapsedMs: 5000 };

    const ticked = tickClock(running, T0 + 1000);
    expect(ticked).toEqual({ startedAt: T0 + 1000, elapsedMs: 6000 });

    const again = tickClock(ticked, T0 + 1500);
    expect(again).toEqual({ startedAt: T0 + 1500, elapsedMs: 6500 });

    // Тот же момент — тот же объект (React не перерисовывается зря).
    expect(tickClock(again, T0 + 1500)).toBe(again);
    // Тик «назад» тоже ничего не меняет.
    expect(tickClock(again, T0 + 1000)).toBe(again);

    // Стоящие часы тик не двигает.
    expect(tickClock(resetClock(), T0 + 60_000)).toEqual({ startedAt: null, elapsedMs: 0 });
  });

  it('freezeClock фиксирует текущий отрезок и идемпотентен', () => {
    const frozen = freezeClock({ startedAt: T0, elapsedMs: 1000 }, T0 + 5000);
    expect(frozen).toEqual({ startedAt: null, elapsedMs: 6000 });
    expect(isClockRunning(frozen)).toBe(false);

    expect(freezeClock(frozen, T0 + 90_000)).toBe(frozen);
  });

  it('пауза и возобновление не теряют и не добавляют время', () => {
    let clock = startClock(resetClock(), T0);
    clock = tickClock(clock, T0 + 3000);
    expect(elapsedOf(clock)).toBe(3000);

    clock = freezeClock(clock, T0 + 4000); // пауза на 1 с внутри отрезка
    expect(elapsedOf(clock)).toBe(4000);

    clock = startClock(clock, T0 + 600_000); // пауза длилась 10 минут
    clock = tickClock(clock, T0 + 602_500);
    expect(elapsedOf(clock)).toBe(6500);
  });
});
