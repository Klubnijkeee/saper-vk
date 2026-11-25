/**
 * Задачи дня: три задания, которые обновляются каждый день.
 *
 * Набор заданий детерминированно выводится из даты — сервер не нужен,
 * у всех игроков в один день одинаковый набор, а после полуночи он меняется.
 * Награда начисляется автоматически, как только цель достигнута.
 */

import type { DailyCounters, DailyState, ModeId } from './types';

/** Сколько заданий показываем в день. */
export const DAILY_TASK_COUNT = 3;

/** Задание дня. */
export interface DailyTask {
  readonly id: string;
  readonly title: string;
  readonly stars: number;
  readonly goal: number;
  readonly measure: (counters: DailyCounters) => number;
}

/** Пул заданий. Каждый день из него выбираются три. */
export const DAILY_TASKS: readonly DailyTask[] = [
  {
    id: 'open-150',
    title: 'Открыть 150 клеток',
    stars: 3,
    goal: 150,
    measure: (counters) => counters.cellsOpened,
  },
  {
    id: 'open-400',
    title: 'Открыть 400 клеток',
    stars: 5,
    goal: 400,
    measure: (counters) => counters.cellsOpened,
  },
  {
    id: 'win-1',
    title: 'Выиграть партию',
    stars: 3,
    goal: 1,
    measure: (counters) => counters.wins,
  },
  {
    id: 'win-3',
    title: 'Выиграть 3 партии',
    stars: 6,
    goal: 3,
    measure: (counters) => counters.wins,
  },
  {
    id: 'flags-40',
    title: 'Поставить 40 флагов',
    stars: 3,
    goal: 40,
    measure: (counters) => counters.flagsPlaced,
  },
  {
    id: 'hints-3',
    title: 'Использовать 3 подсказки',
    stars: 2,
    goal: 3,
    measure: (counters) => counters.hintsUsed,
  },
  {
    id: 'clean-1',
    title: 'Победить без подсказок',
    stars: 4,
    goal: 1,
    measure: (counters) => counters.cleanWins,
  },
  {
    id: 'fast-1',
    title: 'Победить быстрее минуты',
    stars: 4,
    goal: 1,
    measure: (counters) => counters.fastWins,
  },
  {
    id: 'play-3',
    title: 'Сыграть 3 партии',
    stars: 2,
    goal: 3,
    measure: (counters) => counters.gamesPlayed,
  },
];

/** Пустые счётчики дня. */
export const EMPTY_COUNTERS: DailyCounters = {
  gamesPlayed: 0,
  wins: 0,
  cellsOpened: 0,
  flagsPlaced: 0,
  hintsUsed: 0,
  cleanWins: 0,
  fastWins: 0,
};

/** Пустое состояние задач дня (до первого запуска). */
export const EMPTY_DAILY: DailyState = {
  date: '',
  counters: EMPTY_COUNTERS,
  claimed: [],
};

/**
 * Ключ дня в локальной зоне игрока: YYYY-MM-DD.
 * Локальная, а не UTC — иначе «новый день» наступал бы не в полночь по часам игрока.
 */
export function dateKey(now: number): string {
  const date = new Date(now);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Устойчивый хеш строки (FNV-1a) — чтобы набор заданий не «прыгал» при перерисовке. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Задания на конкретный день. */
export function dailyTasksFor(key: string): readonly DailyTask[] {
  const start = hashString(key) % DAILY_TASKS.length;
  // Шаг 4 взаимно прост с длиной пула (9), поэтому индексы не повторяются.
  const step = 4;
  const result: DailyTask[] = [];
  for (let offset = 0; offset < DAILY_TASK_COUNT; offset += 1) {
    const task = DAILY_TASKS[(start + offset * step) % DAILY_TASKS.length];
    if (task !== undefined) result.push(task);
  }
  return result;
}

/** Сколько задания выполнено: 0..1. */
export function dailyProgress(task: DailyTask, counters: DailyCounters): number {
  if (task.goal <= 0) return 1;
  return Math.min(1, task.measure(counters) / task.goal);
}

/** Задания, у которых цель достигнута, но награда ещё не начислена. */
export function claimableTasks(daily: DailyState): readonly DailyTask[] {
  return dailyTasksFor(daily.date).filter(
    (task) =>
      !daily.claimed.includes(task.id) && task.measure(daily.counters) >= task.goal,
  );
}

/** Сменить день: счётчики и награды обнуляются, набор заданий меняется. */
export function rollDaily(daily: DailyState, key: string): DailyState {
  if (daily.date === key) return daily;
  return { date: key, counters: EMPTY_COUNTERS, claimed: [] };
}

/** Итог партии для счётчиков дня. */
export interface DailyMatch {
  readonly mode: ModeId;
  readonly won: boolean;
  readonly timeMs: number;
  readonly cellsOpened: number;
  readonly flagsPlaced: number;
  readonly hintsUsed: number;
}

/** Добавить исход партии в счётчики дня. */
export function addMatchToDaily(daily: DailyState, match: DailyMatch): DailyState {
  const counters = daily.counters;
  return {
    ...daily,
    counters: {
      gamesPlayed: counters.gamesPlayed + 1,
      wins: counters.wins + (match.won ? 1 : 0),
      cellsOpened: counters.cellsOpened + match.cellsOpened,
      flagsPlaced: counters.flagsPlaced + match.flagsPlaced,
      hintsUsed: counters.hintsUsed + match.hintsUsed,
      cleanWins: counters.cleanWins + (match.won && match.hintsUsed === 0 ? 1 : 0),
      fastWins: counters.fastWins + (match.won && match.timeMs <= 60_000 ? 1 : 0),
    },
  };
}
