/**
 * Тесты статистики: серии, рекорды по режимам, средние значения.
 */

import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATS,
  FAST_WIN_MS,
  applyMatch,
  averageTimeMs,
  bestTimeFor,
  emptyByMode,
  winRate,
} from '../src/game/stats';
import { MODES } from '../src/game/modes';
import type { MatchResult } from '../src/game/stats';

function match(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    mode: 'campaign',
    won: true,
    timeMs: 30_000,
    cellsOpened: 71,
    flagsPlaced: 4,
    hintsUsed: 0,
    ...overrides,
  };
}

describe('stats: накопление', () => {
  it('пустая статистика знает все режимы', () => {
    const byMode = emptyByMode();
    for (const mode of MODES) {
      expect(byMode[mode.id]).toEqual({ played: 0, wins: 0, bestTimeMs: null });
    }
  });

  it('победа увеличивает счётчики и серию', () => {
    const after = applyMatch(EMPTY_STATS, match());

    expect(after.gamesPlayed).toBe(1);
    expect(after.wins).toBe(1);
    expect(after.losses).toBe(0);
    expect(after.currentStreak).toBe(1);
    expect(after.bestStreak).toBe(1);
    expect(after.cellsOpened).toBe(71);
    expect(after.flagsPlaced).toBe(4);
    expect(after.playTimeMs).toBe(30_000);
  });

  it('проигрыш сбрасывает текущую серию, но не лучшую', () => {
    let stats = EMPTY_STATS;
    stats = applyMatch(stats, match());
    stats = applyMatch(stats, match());
    stats = applyMatch(stats, match({ won: false, timeMs: 12_000 }));

    expect(stats.currentStreak).toBe(0);
    expect(stats.bestStreak).toBe(2);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
  });

  it('победа без подсказок и быстрая победа считаются отдельно', () => {
    const clean = applyMatch(EMPTY_STATS, match({ hintsUsed: 0, timeMs: FAST_WIN_MS - 1 }));
    expect(clean.cleanWins).toBe(1);
    expect(clean.fastWins).toBe(1);

    const slow = applyMatch(EMPTY_STATS, match({ hintsUsed: 2, timeMs: FAST_WIN_MS + 1 }));
    expect(slow.cleanWins).toBe(0);
    expect(slow.fastWins).toBe(0);
  });

  it('проигрыш не портит чистые победы', () => {
    const lost = applyMatch(EMPTY_STATS, match({ won: false, hintsUsed: 0 }));
    expect(lost.cleanWins).toBe(0);
  });
});

describe('stats: рекорды и средние', () => {
  it('рекорд хранится по режиму и улучшается только быстрее', () => {
    let stats = EMPTY_STATS;
    stats = applyMatch(stats, match({ mode: 'novice', timeMs: 42_000 }));
    stats = applyMatch(stats, match({ mode: 'novice', timeMs: 60_000 }));

    expect(bestTimeFor(stats, 'novice')).toBe(42_000);

    stats = applyMatch(stats, match({ mode: 'novice', timeMs: 31_000 }));
    expect(bestTimeFor(stats, 'novice')).toBe(31_000);
  });

  it('проигранная партия рекорд не ставит', () => {
    const stats = applyMatch(EMPTY_STATS, match({ mode: 'amateur', won: false, timeMs: 5_000 }));

    expect(bestTimeFor(stats, 'amateur')).toBeNull();
    expect(stats.byMode.amateur.played).toBe(1);
    expect(stats.byMode.amateur.wins).toBe(0);
  });

  it('винрейт и среднее время считаются по всем партиям', () => {
    let stats = EMPTY_STATS;
    stats = applyMatch(stats, match({ timeMs: 20_000 }));
    stats = applyMatch(stats, match({ won: false, timeMs: 40_000 }));

    expect(winRate(stats)).toBeCloseTo(0.5);
    expect(averageTimeMs(stats)).toBe(30_000);
  });

  it('на пустой статистике нет деления на ноль', () => {
    expect(winRate(EMPTY_STATS)).toBe(0);
    expect(averageTimeMs(EMPTY_STATS)).toBeNull();
  });
});
