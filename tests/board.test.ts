/**
 * Тесты генерации поля: безопасный первый клик, количество мин, корректность цифр.
 */

import { describe, expect, it } from 'vitest';
import {
  cellAt,
  countCells,
  countSafeCells,
  createBoard,
  createEmptyBoard,
  getLevelConfig,
  getMinesForLevel,
  minesOf,
  neighborIndices,
} from '../src/game/board';
import { createRng, shuffle } from '../src/game/random';
import type { Board, LevelConfig } from '../src/game/types';

const CONFIG: LevelConfig = getLevelConfig(1); // 9×9, 10 мин

/** Эталонный подсчёт мин вокруг клетки — независимый от `withAdjacency`. */
function referenceAdjacency(board: Board, config: LevelConfig, index: number): number {
  return neighborIndices(index, config).filter((neighbor) => cellAt(board, neighbor).hasMine).length;
}

describe('board: структура поля', () => {
  it('пустое поле — 81 закрытая клетка без мин', () => {
    const board = createEmptyBoard(CONFIG);
    expect(board).toHaveLength(countCells(CONFIG));
    expect(countCells(CONFIG)).toBe(81);
    expect(countSafeCells(CONFIG)).toBe(71);
    expect(board.every((cell) => cell.state === 'hidden')).toBe(true);
    expect(board.every((cell) => !cell.hasMine && cell.adjacentMines === 0)).toBe(true);
    expect(board.some((cell) => cell.exploded)).toBe(false);
  });

  it('индекс, строка и столбец согласованы', () => {
    const board = createEmptyBoard(CONFIG);
    board.forEach((cell, position) => {
      expect(cell.index).toBe(position);
      expect(cell.row).toBe(Math.floor(position / CONFIG.cols));
      expect(cell.col).toBe(position % CONFIG.cols);
    });
  });
});

describe('board: первый клик всегда безопасен', () => {
  it('100 генераций — первая клетка и её окружение без мин', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const firstClick = (seed * 7) % countCells(CONFIG);
      const board = createBoard(CONFIG, firstClick, createRng(seed));

      expect(cellAt(board, firstClick).hasMine, `seed=${seed}, клик=${firstClick}`).toBe(false);
      for (const neighbor of neighborIndices(firstClick, CONFIG)) {
        expect(cellAt(board, neighbor).hasMine, `seed=${seed}, сосед ${neighbor}`).toBe(false);
      }
      expect(minesOf(board)).toHaveLength(CONFIG.mines);
    }
  });

  it('безопасен для любого из 81 вариантов первого клика', () => {
    for (let firstClick = 0; firstClick < countCells(CONFIG); firstClick += 1) {
      const board = createBoard(CONFIG, firstClick, createRng(1000 + firstClick));
      expect(cellAt(board, firstClick).hasMine, `клик=${firstClick}`).toBe(false);
      expect(cellAt(board, firstClick).adjacentMines, `клик=${firstClick}`).toBe(0);
    }
  });

  it('безопасен на сложном уровне (15 мин), включая клики по углам', () => {
    const hard = getLevelConfig(11);
    expect(hard.mines).toBe(15);

    const corners = [0, hard.cols - 1, countCells(hard) - hard.cols, countCells(hard) - 1];
    for (const corner of corners) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const board = createBoard(hard, corner, createRng(seed));
        expect(cellAt(board, corner).hasMine, `угол=${corner}, seed=${seed}`).toBe(false);
        expect(minesOf(board)).toHaveLength(hard.mines);
      }
    }
  });
});

describe('board: мины и цифры', () => {
  it('ставит ровно нужное количество мин', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const board = createBoard(CONFIG, 40, createRng(seed));
      expect(minesOf(board)).toHaveLength(CONFIG.mines);
      expect(board.filter((cell) => cell.hasMine)).toHaveLength(CONFIG.mines);
    }
  });

  it('цифра = количество мин среди 8 соседей', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const board = createBoard(CONFIG, 40, createRng(seed));
      for (const cell of board) {
        expect(cell.adjacentMines, `клетка ${cell.index}, seed=${seed}`).toBe(
          referenceAdjacency(board, CONFIG, cell.index),
        );
      }
    }
  });

  it('одно зерно даёт одно и то же поле (воспроизводимость)', () => {
    const first = createBoard(CONFIG, 40, createRng(777));
    const second = createBoard(CONFIG, 40, createRng(777));
    expect(second).toEqual(first);

    const other = createBoard(CONFIG, 40, createRng(778));
    expect(other).not.toEqual(first);
  });
});

describe('board: сложность по уровням', () => {
  it('1–5 → 10 мин, 6–10 → 12 мин, 11+ → 15 мин', () => {
    expect(getMinesForLevel(1)).toBe(10);
    expect(getMinesForLevel(5)).toBe(10);
    expect(getMinesForLevel(6)).toBe(12);
    expect(getMinesForLevel(10)).toBe(12);
    expect(getMinesForLevel(11)).toBe(15);
    expect(getMinesForLevel(99)).toBe(15);
  });

  it('некорректный номер уровня нормализуется', () => {
    expect(getMinesForLevel(0)).toBe(10);
    expect(getMinesForLevel(-5)).toBe(10);
    expect(getMinesForLevel(3.9)).toBe(10);
    expect(getMinesForLevel(Number.NaN)).toBe(10);
    expect(getMinesForLevel(12)).toBe(15);
  });

  it('поле всегда 9×9', () => {
    for (const level of [1, 6, 11, 42]) {
      const config = getLevelConfig(level);
      expect(config.rows).toBe(9);
      expect(config.cols).toBe(9);
    }
  });
});

describe('random: утилиты', () => {
  it('shuffle не мутирует исходный массив и сохраняет состав', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const frozenCopy = [...source];
    const shuffled = shuffle(source, createRng(5));

    expect(source).toEqual(frozenCopy);
    expect(shuffled).not.toBe(source);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(frozenCopy);
  });

  it('createRng детерминирован, значения в [0, 1)', () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 100; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
