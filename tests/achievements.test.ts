/**
 * Тесты достижений: вычисление прогресса, выдача новых и сумма звёзд.
 */

import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  achievementProgress,
  findAchievement,
  newAchievements,
  starsFor,
} from '../src/game/achievements';
import { EMPTY_STATS, applyMatch } from '../src/game/stats';
import type { Stats } from '../src/game/types';

/** Статистика с нужными значениями — остальное по умолчанию. */
function statsWith(patch: Partial<Stats>): Stats {
  return { ...EMPTY_STATS, ...patch };
}

describe('achievements: каталог', () => {
  it('идентификаторы уникальны, у каждого достижения есть цель и награда', () => {
    const ids = ACHIEVEMENTS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThan(20);

    for (const item of ACHIEVEMENTS) {
      expect(item.goal).toBeGreaterThan(0);
      expect(item.stars).toBeGreaterThan(0);
      expect(item.title.length).toBeGreaterThan(0);
    }
  });

  it('новый игрок не получает ничего', () => {
    expect(newAchievements({ stats: EMPTY_STATS, level: 1 }, [])).toEqual([]);
  });

  it('findAchievement находит по id', () => {
    expect(findAchievement('first-game')?.title).toBe('Первый шаг');
    expect(findAchievement('нет-такого')).toBeUndefined();
  });
});

describe('achievements: выдача', () => {
  it('первая партия открывает «Первый шаг»', () => {
    const stats = applyMatch(EMPTY_STATS, {
      mode: 'campaign',
      won: false,
      timeMs: 10_000,
      cellsOpened: 5,
      flagsPlaced: 0,
      hintsUsed: 0,
    });

    const unlocked = newAchievements({ stats, level: 1 }, []);
    expect(unlocked.map((item) => item.id)).toContain('first-game');
    expect(unlocked.map((item) => item.id)).not.toContain('first-win');
  });

  it('уже открытые достижения не выдаются повторно', () => {
    const stats = statsWith({ wins: 1 });
    const unlocked = newAchievements({ stats, level: 1 }, ['first-win']);

    expect(unlocked.map((item) => item.id)).not.toContain('first-win');
  });

  it('победа в режиме открывает достижение этого режима', () => {
    const stats = applyMatch(EMPTY_STATS, {
      mode: 'professional',
      won: true,
      timeMs: 600_000,
      cellsOpened: 381,
      flagsPlaced: 99,
      hintsUsed: 0,
    });

    const ids = newAchievements({ stats, level: 1 }, []).map((item) => item.id);
    expect(ids).toContain('mode-professional');
    expect(ids).not.toContain('mode-amateur');
  });

  it('уровень кампании учитывается отдельно от статистики', () => {
    const ids = newAchievements({ stats: EMPTY_STATS, level: 5 }, []).map((item) => item.id);
    expect(ids).toContain('campaign-5');
  });

  it('звёзды за набор складываются', () => {
    const unlocked = ACHIEVEMENTS.slice(0, 3);
    expect(starsFor(unlocked)).toBe(
      unlocked.reduce((sum, item) => sum + item.stars, 0),
    );
    expect(starsFor([])).toBe(0);
  });
});

describe('achievements: прогресс', () => {
  it('прогресс считается от цели и не превышает единицу', () => {
    const achievement = findAchievement('wins-10');
    expect(achievement).toBeDefined();
    if (achievement === undefined) return;

    expect(achievementProgress(achievement, { stats: EMPTY_STATS, level: 1 })).toBe(0);
    expect(
      achievementProgress(achievement, { stats: statsWith({ wins: 5 }), level: 1 }),
    ).toBeCloseTo(0.5);
    expect(
      achievementProgress(achievement, { stats: statsWith({ wins: 50 }), level: 1 }),
    ).toBe(1);
  });
});
