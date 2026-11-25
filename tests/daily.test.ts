/**
 * Тесты задач дня: набор по дате, счётчики, смена дня и автонаграда.
 */

import { describe, expect, it } from 'vitest';
import {
  DAILY_TASKS,
  DAILY_TASK_COUNT,
  EMPTY_DAILY,
  addMatchToDaily,
  claimableTasks,
  dailyProgress,
  dailyTasksFor,
  dateKey,
  rollDaily,
} from '../src/game/daily';
import type { DailyMatch } from '../src/game/daily';

const MATCH: DailyMatch = {
  mode: 'campaign',
  won: true,
  timeMs: 30_000,
  cellsOpened: 71,
  flagsPlaced: 3,
  hintsUsed: 0,
};

describe('daily: дата', () => {
  it('ключ дня — локальная дата в формате YYYY-MM-DD', () => {
    const local = new Date(2026, 4, 9, 23, 30).getTime();
    expect(dateKey(local)).toBe('2026-05-09');
  });

  it('разные сутки дают разные ключи', () => {
    const first = new Date(2026, 4, 9, 23, 59).getTime();
    const second = new Date(2026, 4, 10, 0, 1).getTime();

    expect(dateKey(first)).not.toBe(dateKey(second));
  });
});

describe('daily: набор заданий', () => {
  it('на день выдаётся ровно три разных задания', () => {
    const tasks = dailyTasksFor('2026-05-09');
    const ids = tasks.map((task) => task.id);

    expect(tasks).toHaveLength(DAILY_TASK_COUNT);
    expect(new Set(ids).size).toBe(tasks.length);
  });

  it('набор воспроизводим: та же дата — те же задания', () => {
    expect(dailyTasksFor('2026-05-09').map((task) => task.id)).toEqual(
      dailyTasksFor('2026-05-09').map((task) => task.id),
    );
  });

  it('задания меняются от дня к дню', () => {
    const sets = new Set(
      ['2026-05-09', '2026-05-10', '2026-05-11', '2026-05-12'].map((key) =>
        dailyTasksFor(key)
          .map((task) => task.id)
          .sort()
          .join(','),
      ),
    );

    expect(sets.size).toBeGreaterThan(1);
  });

  it('у каждого задания есть цель, награда и измеритель', () => {
    for (const task of DAILY_TASKS) {
      expect(task.goal).toBeGreaterThan(0);
      expect(task.stars).toBeGreaterThan(0);
      expect(task.measure(EMPTY_DAILY.counters)).toBe(0);
    }
  });
});

describe('daily: прогресс и награда', () => {
  it('счётчики растут по итогам партии', () => {
    const daily = addMatchToDaily({ ...EMPTY_DAILY, date: '2026-05-09' }, MATCH);

    expect(daily.counters.gamesPlayed).toBe(1);
    expect(daily.counters.wins).toBe(1);
    expect(daily.counters.cellsOpened).toBe(71);
    expect(daily.counters.flagsPlaced).toBe(3);
    expect(daily.counters.cleanWins).toBe(1);
    expect(daily.counters.fastWins).toBe(1);
  });

  it('проигрыш не увеличивает победы и чистые победы', () => {
    const daily = addMatchToDaily(
      { ...EMPTY_DAILY, date: '2026-05-09' },
      { ...MATCH, won: false, hintsUsed: 0 },
    );

    expect(daily.counters.wins).toBe(0);
    expect(daily.counters.cleanWins).toBe(0);
    expect(daily.counters.gamesPlayed).toBe(1);
  });

  it('прогресс задания ограничен единицей', () => {
    const task = DAILY_TASKS.find((item) => item.id === 'open-150');
    expect(task).toBeDefined();
    if (task === undefined) return;

    const counters = { ...EMPTY_DAILY.counters, cellsOpened: 10_000 };
    expect(dailyProgress(task, counters)).toBe(1);
  });

  it('выполненные задания попадают в claimable и уходят после награды', () => {
    const task = DAILY_TASKS.find((item) => item.id === 'win-1');
    expect(task).toBeDefined();
    if (task === undefined) return;

    const key = '2026-05-09';
    const withWin = { date: key, counters: { ...EMPTY_DAILY.counters, wins: 1 }, claimed: [] };

    expect(claimableTasks(withWin).map((item) => item.id)).toContain('win-1');

    const claimed = { ...withWin, claimed: ['win-1'] };
    expect(claimableTasks(claimed).map((item) => item.id)).not.toContain('win-1');
  });

  it('смена дня обнуляет счётчики и награды', () => {
    const filled = {
      date: '2026-05-09',
      counters: { ...EMPTY_DAILY.counters, wins: 5 },
      claimed: ['win-1'],
    };

    const rolled = rollDaily(filled, '2026-05-10');
    expect(rolled.counters.wins).toBe(0);
    expect(rolled.claimed).toEqual([]);

    // Тот же день — состояние не меняется (важно для лишних перерисовок).
    expect(rollDaily(filled, '2026-05-09')).toBe(filled);
  });
});
