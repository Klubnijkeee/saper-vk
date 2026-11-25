/**
 * Тесты фигур уровней: арт, стартовая зона и расстановка мин по фигуре.
 */

import { describe, expect, it } from 'vitest';
import { createPatternBoard, getLevelConfig, neighborIndices } from '../src/game/board';
import {
  ALL_PATTERNS,
  LEVEL_PATTERNS,
  PATTERN_COLS,
  PATTERN_LEVELS,
  PATTERN_ROWS,
  PATTERN_VARIANTS,
  patternForAttempt,
  patternForLevel,
  patternMineCells,
  patternMineCount,
  patternStartCell,
  validatePattern,
  variantPattern,
} from '../src/game/patterns';
import type { LevelConfig } from '../src/game/types';

const CONFIG: LevelConfig = getLevelConfig(1);

describe('patterns: арт', () => {
  it('каждая фигура проходит проверку арта', () => {
    LEVEL_PATTERNS.forEach((pattern, index) => {
      expect(validatePattern(pattern), `уровень ${index + 1} (${pattern.title})`).toEqual([]);
    });
  });

  it('названия и раскладки не повторяются', () => {
    const titles = LEVEL_PATTERNS.map((pattern) => pattern.title);
    const layouts = LEVEL_PATTERNS.map((pattern) => pattern.art.join('|'));

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(layouts).size).toBe(layouts.length);
  });

  it('фигуры одинакового размера', () => {
    for (const pattern of LEVEL_PATTERNS) {
      expect(pattern.art).toHaveLength(PATTERN_ROWS);
      for (const row of pattern.art) expect(row).toHaveLength(PATTERN_COLS);
    }
  });

  it('сложность растёт от начала к финалу', () => {
    const counts = LEVEL_PATTERNS.map(patternMineCount);
    const average = (values: readonly number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(counts.length).toBeGreaterThanOrEqual(40);
    expect(average(counts.slice(0, 10))).toBeLessThan(average(counts.slice(-10)));
    // Старт — разминка: никаких плотных полей в первых уровнях.
    expect(Math.max(...counts.slice(0, 5))).toBeLessThanOrEqual(12);
  });

  it('лёгкие фигуры попадаются и дальше — это передыхи', () => {
    const counts = LEVEL_PATTERNS.map(patternMineCount);
    const late = counts.slice(14);
    const breathers = late.filter((value) => value <= 14);

    expect(breathers.length).toBeGreaterThanOrEqual(3);
  });

  it('сложность не прыгает: соседние уровни близки по числу мин', () => {
    const counts = LEVEL_PATTERNS.map(patternMineCount);

    for (let index = 1; index < counts.length; index += 1) {
      const jump = Math.abs((counts[index] ?? 0) - (counts[index - 1] ?? 0));
      expect(jump, `уровни ${index} и ${index + 1}`).toBeLessThanOrEqual(4);
    }
  });

  it('каждая фигура участвует в кампании ровно один раз', () => {
    const titles = LEVEL_PATTERNS.map((pattern) => pattern.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(titles).size).toBe(ALL_PATTERNS.length);
  });

  it('patternForLevel работает на границах', () => {
    expect(patternForLevel(1)).not.toBeNull();
    expect(patternForLevel(PATTERN_LEVELS)).not.toBeNull();
    expect(patternForLevel(PATTERN_LEVELS + 1)).toBeNull();
    expect(patternForLevel(0)).toBeNull();
    expect(patternForLevel(-5)).toBeNull();
    expect(patternForLevel(2.7)).toEqual(patternForLevel(2));
  });

  it('у каждого уровня с фигурой стартовая зона 3×3 свободна от мин', () => {
    LEVEL_PATTERNS.forEach((pattern, index) => {
      const start = patternStartCell(pattern, CONFIG);
      const startRow = Math.floor(start / CONFIG.cols);
      const startCol = start % CONFIG.cols;

      for (const mine of patternMineCells(pattern, CONFIG)) {
        const row = Math.floor(mine / CONFIG.cols);
        const col = mine % CONFIG.cols;
        const nearStart = Math.abs(row - startRow) <= 1 && Math.abs(col - startCol) <= 1;
        expect(nearStart, `уровень ${index + 1}: мина в зоне старта`).toBe(false);
      }
    });
  });
});

describe('patterns: варианты отражения', () => {
  it('отражение сохраняет число мин и свободную зону вокруг старта', () => {
    for (const pattern of LEVEL_PATTERNS) {
      const mines = patternMineCount(pattern);

      for (let variant = 0; variant < PATTERN_VARIANTS; variant += 1) {
        const mirrored = variantPattern(pattern, variant);
        expect(validatePattern(mirrored), `${pattern.title}, вариант ${variant}`).toEqual([]);
        expect(patternMineCount(mirrored)).toBe(mines);
      }
    }
  });

  it('вариант выбирается по зерну и повторяется при том же зерне', () => {
    const level = 1;
    const first = patternForAttempt(level, 2);
    const again = patternForAttempt(level, 2);

    expect(again).toEqual(first);
    if (first === null) return;
    expect(patternMineCount(first)).toBe(patternMineCount(LEVEL_PATTERNS[level - 1] ?? first));
  });

  it('на асимметричной фигуре варианты действительно разные', () => {
    const pattern = LEVEL_PATTERNS.find((item) => item.title === 'Молния');
    expect(pattern).toBeDefined();
    if (pattern === undefined) return;

    const layouts = new Set(
      [0, 1, 2, 3].map((variant) => variantPattern(pattern, variant).art.join('|')),
    );
    expect(layouts.size).toBeGreaterThan(1);
  });
});

describe('patterns: поле', () => {
  it('мины встают ровно по фигуре, цифры считаются по соседям', () => {
    const pattern = LEVEL_PATTERNS[0];
    expect(pattern).toBeDefined();
    if (pattern === undefined) return;

    const config: LevelConfig = { ...CONFIG, mines: patternMineCount(pattern) };
    const board = createPatternBoard(config, pattern);
    const expected = patternMineCells(pattern, config);

    expect(board.filter((cell) => cell.hasMine).map((cell) => cell.index)).toEqual(expected);

    for (const cell of board) {
      if (cell.hasMine) continue;
      const neighbours = neighborIndices(cell.index, CONFIG).filter(
        (index) => board[index]?.hasMine === true,
      ).length;
      expect(cell.adjacentMines).toBe(neighbours);
    }
  });

  it('поле уровня воспроизводимо: одна и та же фигура каждый заход', () => {
    const pattern = LEVEL_PATTERNS[3];
    if (pattern === undefined) return;

    const first = createPatternBoard(CONFIG, pattern);
    const second = createPatternBoard(CONFIG, pattern);

    expect(second).toEqual(first);
  });

  it('мин в фигуре меньше, чем безопасных клеток: победа достижима', () => {
    LEVEL_PATTERNS.forEach((pattern, index) => {
      const mines = patternMineCount(pattern);
      expect(mines).toBeLessThan(CONFIG.rows * CONFIG.cols - 9);
      expect(mines, `уровень ${index + 1}`).toBeGreaterThan(0);
    });
  });
});
