/**
 * Тесты жизней: регенерация, трата, покупка и защита от переводов часов.
 */

import { describe, expect, it } from 'vitest';
import {
  LIFE_REGEN_MS,
  MAX_LIVES,
  addLives,
  canSpendLife,
  formatWaiting,
  msUntilNextLife,
  refreshLives,
  spendLife,
  type LivesState,
} from '../src/game/lives';

const T0 = 1_700_000_000_000;

function lives(count: number, updatedAt: number = T0): LivesState {
  return { lives: count, updatedAt };
}

describe('lives: регенерация', () => {
  it('полный набор не меняется и таймера не показывает', () => {
    const full = refreshLives(lives(MAX_LIVES), T0);

    expect(full.lives).toBe(MAX_LIVES);
    expect(msUntilNextLife(full, T0)).toBeNull();
  });

  it('через интервал возвращается ровно одна жизнь', () => {
    const spent = spendLife(lives(MAX_LIVES), T0);
    expect(spent.lives).toBe(MAX_LIVES - 1);

    expect(refreshLives(spent, T0 + LIFE_REGEN_MS - 1).lives).toBe(MAX_LIVES - 1);
    expect(refreshLives(spent, T0 + LIFE_REGEN_MS).lives).toBe(MAX_LIVES);
  });

  it('за долгое отсутствие накапливается несколько жизней', () => {
    const empty = lives(0, T0);

    expect(refreshLives(empty, T0 + LIFE_REGEN_MS * 2 + 1000).lives).toBe(2);
    expect(refreshLives(empty, T0 + LIFE_REGEN_MS * 50).lives).toBe(MAX_LIVES);
  });

  it('на полном наборе отсчёт не копится', () => {
    // Иначе после траты жизнь возвращалась бы мгновенно.
    const refilled = refreshLives(lives(MAX_LIVES - 1, T0), T0 + LIFE_REGEN_MS * 10);
    expect(refilled.lives).toBe(MAX_LIVES);

    const spent = spendLife(refilled, refilled.updatedAt + 1000);
    expect(spent.lives).toBe(MAX_LIVES - 1);
    expect(refreshLives(spent, spent.updatedAt + 1000).lives).toBe(MAX_LIVES - 1);
  });

  it('перевод часов назад не ломает состояние', () => {
    const spent = spendLife(lives(MAX_LIVES), T0);
    const back = refreshLives(spent, T0 - LIFE_REGEN_MS);

    expect(back.lives).toBe(MAX_LIVES - 1);
    expect(back.updatedAt).toBeGreaterThan(0);
  });

  it('мусор в числе жизней приводится к максимуму', () => {
    expect(refreshLives(lives(Number.NaN), T0).lives).toBe(MAX_LIVES);
    expect(refreshLives(lives(-5), T0).lives).toBe(0);
    expect(refreshLives(lives(99), T0).lives).toBe(MAX_LIVES);
  });
});

describe('lives: трата и покупка', () => {
  it('жизнь тратится, когда они есть', () => {
    expect(canSpendLife(lives(1), T0)).toBe(true);
    expect(spendLife(lives(1), T0).lives).toBe(0);
  });

  it('при нуле жизнь не уходит в минус', () => {
    expect(canSpendLife(lives(0), T0)).toBe(false);
    expect(spendLife(lives(0), T0).lives).toBe(0);
  });

  it('покупка добавляет жизнь, но не выше максимума', () => {
    expect(addLives(lives(MAX_LIVES - 1), 1, T0).lives).toBe(MAX_LIVES);
    expect(addLives(lives(1), 10, T0).lives).toBe(MAX_LIVES);
  });
});

describe('lives: подписи', () => {
  it('время до следующей жизни считается от накопленного', () => {
    const spent = spendLife(lives(MAX_LIVES), T0);

    expect(msUntilNextLife(spent, T0)).toBe(LIFE_REGEN_MS);
    expect(msUntilNextLife(spent, T0 + 60_000)).toBe(LIFE_REGEN_MS - 60_000);
  });

  it('формат ожидания — минуты и секунды', () => {
    expect(formatWaiting(LIFE_REGEN_MS)).toBe('8:00');
    expect(formatWaiting(65_000)).toBe('1:05');
    expect(formatWaiting(-100)).toBe('0:00');
  });
});
