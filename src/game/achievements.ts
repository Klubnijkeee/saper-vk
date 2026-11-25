/**
 * Достижения: цели, которые считаются по статистике игрока.
 *
 * У каждого достижения есть `measure` — числовой прогресс, поэтому шкала
 * заполняется сама, без отдельного счётчика «сколько осталось».
 * Награда (звёзды) начисляется в момент открытия.
 */

import type { ModeId, Stats } from './types';

/** Что видит игрок в карточке достижения. */
export interface Achievement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly stars: number;
  readonly goal: number;
  readonly measure: (input: AchievementInput) => number;
}

/** Данные, по которым считаются достижения. */
export interface AchievementInput {
  readonly stats: Stats;
  /** Текущий уровень кампании. */
  readonly level: number;
}

const winsIn = (stats: Stats, mode: ModeId): number => stats.byMode[mode]?.wins ?? 0;

/** Список достижений. Порядок = порядок показа. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-game',
    title: 'Первый шаг',
    description: 'Сыграть первую партию',
    stars: 3,
    goal: 1,
    measure: ({ stats }) => stats.gamesPlayed,
  },
  {
    id: 'first-win',
    title: 'Начало',
    description: 'Выиграть первую партию',
    stars: 5,
    goal: 1,
    measure: ({ stats }) => stats.wins,
  },
  {
    id: 'wins-10',
    title: 'Десять побед',
    description: 'Выиграть 10 партий',
    stars: 10,
    goal: 10,
    measure: ({ stats }) => stats.wins,
  },
  {
    id: 'wins-50',
    title: 'Полсотни',
    description: 'Выиграть 50 партий',
    stars: 25,
    goal: 50,
    measure: ({ stats }) => stats.wins,
  },
  {
    id: 'streak-3',
    title: 'Три подряд',
    description: 'Победить 3 раза подряд',
    stars: 8,
    goal: 3,
    measure: ({ stats }) => stats.bestStreak,
  },
  {
    id: 'streak-10',
    title: 'Десять подряд',
    description: 'Победить 10 раз подряд',
    stars: 30,
    goal: 10,
    measure: ({ stats }) => stats.bestStreak,
  },
  {
    id: 'cells-500',
    title: 'Землекоп',
    description: 'Открыть 500 клеток',
    stars: 5,
    goal: 500,
    measure: ({ stats }) => stats.cellsOpened,
  },
  {
    id: 'cells-5000',
    title: 'Крот',
    description: 'Открыть 5 000 клеток',
    stars: 20,
    goal: 5000,
    measure: ({ stats }) => stats.cellsOpened,
  },
  {
    id: 'cells-25000',
    title: 'Буровая',
    description: 'Открыть 25 000 клеток',
    stars: 50,
    goal: 25000,
    measure: ({ stats }) => stats.cellsOpened,
  },
  {
    id: 'flags-100',
    title: 'Флажковед',
    description: 'Поставить 100 флагов',
    stars: 8,
    goal: 100,
    measure: ({ stats }) => stats.flagsPlaced,
  },
  {
    id: 'flags-1000',
    title: 'Сапёр-снайпер',
    description: 'Поставить 1 000 флагов',
    stars: 25,
    goal: 1000,
    measure: ({ stats }) => stats.flagsPlaced,
  },
  {
    id: 'hints-1',
    title: 'Первая подсказка',
    description: 'Купить первую подсказку',
    stars: 2,
    goal: 1,
    measure: ({ stats }) => stats.hintsUsed,
  },
  {
    id: 'hints-50',
    title: 'Постоянный клиент',
    description: 'Использовать 50 подсказок',
    stars: 15,
    goal: 50,
    measure: ({ stats }) => stats.hintsUsed,
  },
  {
    id: 'clean-1',
    title: 'Своими руками',
    description: 'Победить без подсказок',
    stars: 5,
    goal: 1,
    measure: ({ stats }) => stats.cleanWins,
  },
  {
    id: 'clean-10',
    title: 'Чистая работа',
    description: 'Победить без подсказок 10 раз',
    stars: 20,
    goal: 10,
    measure: ({ stats }) => stats.cleanWins,
  },
  {
    id: 'fast-1',
    title: 'Скороход',
    description: 'Победить быстрее минуты',
    stars: 5,
    goal: 1,
    measure: ({ stats }) => stats.fastWins,
  },
  {
    id: 'fast-10',
    title: 'Реакция',
    description: 'Победить быстрее минуты 10 раз',
    stars: 25,
    goal: 10,
    measure: ({ stats }) => stats.fastWins,
  },
  {
    id: 'mode-novice',
    title: 'Новичок пройден',
    description: 'Победить на поле 9×9',
    stars: 5,
    goal: 1,
    measure: ({ stats }) => winsIn(stats, 'novice'),
  },
  {
    id: 'mode-amateur',
    title: 'Любитель пройден',
    description: 'Победить на поле 16×16',
    stars: 10,
    goal: 1,
    measure: ({ stats }) => winsIn(stats, 'amateur'),
  },
  {
    id: 'mode-professional',
    title: 'Профессионал пройден',
    description: 'Победить на поле 30×16',
    stars: 30,
    goal: 1,
    measure: ({ stats }) => winsIn(stats, 'professional'),
  },
  {
    id: 'mode-special',
    title: 'Особый пройден',
    description: 'Победить на поле 12×12',
    stars: 10,
    goal: 1,
    measure: ({ stats }) => winsIn(stats, 'special'),
  },
  {
    id: 'campaign-5',
    title: 'Пять уровней',
    description: 'Дойти до 5-го уровня кампании',
    stars: 10,
    goal: 5,
    measure: ({ level }) => level,
  },
  {
    id: 'campaign-15',
    title: 'Пятнадцать уровней',
    description: 'Дойти до 15-го уровня кампании',
    stars: 30,
    goal: 15,
    measure: ({ level }) => level,
  },
  {
    id: 'time-1h',
    title: 'Час за игрой',
    description: 'Провести в игре час',
    stars: 15,
    goal: 60,
    measure: ({ stats }) => Math.floor(stats.playTimeMs / 60_000),
  },
  {
    id: 'games-100',
    title: 'Сотня партий',
    description: 'Сыграть 100 партий',
    stars: 20,
    goal: 100,
    measure: ({ stats }) => stats.gamesPlayed,
  },
  {
    id: 'losses-10',
    title: 'На своих ошибках',
    description: 'Проиграть 10 партий',
    stars: 3,
    goal: 10,
    measure: ({ stats }) => stats.losses,
  },
];

/** Достижение по id. */
export function findAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}

/** Прогресс достижения: 0..1. */
export function achievementProgress(achievement: Achievement, input: AchievementInput): number {
  if (achievement.goal <= 0) return 1;
  return Math.min(1, achievement.measure(input) / achievement.goal);
}

/** Достижения, которые только что выполнились. */
export function newAchievements(
  input: AchievementInput,
  unlocked: readonly string[],
): readonly Achievement[] {
  return ACHIEVEMENTS.filter(
    (achievement) =>
      !unlocked.includes(achievement.id) &&
      achievement.measure(input) >= achievement.goal,
  );
}

/** Сумма звёзд за набор достижений. */
export function starsFor(achievements: readonly Achievement[]): number {
  return achievements.reduce((sum, achievement) => sum + achievement.stars, 0);
}
