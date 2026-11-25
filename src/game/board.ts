/**
 * Работа с полем: размеры, координаты, генерация, расстановка мин, подсчёт цифр.
 *
 * Всё чистое: ни одна функция не мутирует входной массив клеток,
 * а возвращает новое поле.
 */

import { shuffle } from './random';
import type { Board, Cell, CellState, Coord, LevelConfig, Mine, Rng } from './types';

/** Базовое поле 9×9 (ТЗ). */
export const GRID_ROWS = 9;
export const GRID_COLS = 9;

/** Количество мин по уровням (ТЗ): 1–5 → 10, 6–10 → 12, 11+ → 15. */
export function getMinesForLevel(level: number): number {
  const normalized = normalizeLevel(level);
  if (normalized <= 5) return 10;
  if (normalized <= 10) return 12;
  return 15;
}

/** Уровни нумеруются с 1; дробные и отрицательные значения приводятся к корректным. */
export function normalizeLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.floor(level));
}

/** Конфигурация уровня: размер поля + количество мин. */
export function getLevelConfig(level: number): LevelConfig {
  return { rows: GRID_ROWS, cols: GRID_COLS, mines: getMinesForLevel(level) };
}

/** Всего клеток на поле. */
export function countCells(config: LevelConfig): number {
  return config.rows * config.cols;
}

/** Сколько клеток реально есть на поле: остальное — пустота вокруг фигуры. */
export function countOpenCells(board: Board): number {
  return board.reduce((sum, cell) => sum + (cell.blocked ? 0 : 1), 0);
}

/** Всего безопасных клеток — ровно их нужно открыть для победы. */
export function countSafeCells(
  config: LevelConfig,
  minesRemoved: number = 0,
  openCells: number = countCells(config),
): number {
  return Math.max(0, openCells - config.mines + minesRemoved);
}

/** Индекс лежит внутри поля? */
export function isValidIndex(index: number, config: LevelConfig): boolean {
  return Number.isInteger(index) && index >= 0 && index < countCells(config);
}

/** Индекс по координатам. */
export function indexOf(row: number, col: number, config: LevelConfig): number {
  return row * config.cols + col;
}

/** Координаты по индексу. */
export function toCoord(index: number, config: LevelConfig): Coord {
  return { row: Math.floor(index / config.cols), col: index % config.cols };
}

/** Все индексы поля по порядку. */
export function allIndices(config: LevelConfig): readonly number[] {
  return Array.from({ length: countCells(config) }, (_unused, index) => index);
}

/** Индексы соседей клетки (до 8), без выхода за границы поля. */
export function neighborIndices(index: number, config: LevelConfig): readonly number[] {
  const { row, col } = toCoord(index, config);
  const result: number[] = [];
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      if (dRow === 0 && dCol === 0) continue;
      const row2 = row + dRow;
      const col2 = col + dCol;
      if (row2 < 0 || row2 >= config.rows || col2 < 0 || col2 >= config.cols) continue;
      result.push(indexOf(row2, col2, config));
    }
  }
  return result;
}

/**
 * Клетка по индексу.
 * Бросает исключение при выходе за границы: это ошибка программиста, а не игрока,
 * поэтому «тихо вернуть undefined» здесь хуже, чем упасть в тестах.
 */
export function cellAt(board: Board, index: number): Cell {
  const cell = board[index];
  if (cell === undefined) {
    throw new RangeError(`cellAt: клетки с индексом ${index} нет на поле`);
  }
  return cell;
}

/** Пустое поле: всё закрыто, мин нет, цифры нулевые. */
export function createEmptyBoard(
  config: LevelConfig,
  mask?: readonly boolean[] | null,
): Board {
  return Array.from({ length: countCells(config) }, (_unused, index) => {
    const { row, col } = toCoord(index, config);
    return {
      index,
      row,
      col,
      blocked: mask === null || mask === undefined ? false : mask[index] !== true,
      hasMine: false,
      adjacentMines: 0,
      state: 'hidden',
      exploded: false,
    } satisfies Cell;
  });
}

/** Индексы клеток, где реально может стоять мина. */
export function openIndices(board: Board): readonly number[] {
  return board.reduce<number[]>((list, cell) => {
    if (!cell.blocked) list.push(cell.index);
    return list;
  }, []);
}

/**
 * Зона, свободная от мин при первой расстановке: сама клетка первого клика
 * плюс её соседи. Тогда первый клик открывает область, а не «цифру 1» —
 * так же ведёт себя классический сапёр.
 *
 * Если клеток не хватает (фигура тонкая, мин много), гарантируем только саму клетку.
 */
function safeZone(board: Board, config: LevelConfig, safeIndex: number): ReadonlySet<number> {
  const zone = new Set<number>([safeIndex, ...neighborIndices(safeIndex, config)]);
  if (countOpenCells(board) - zone.size < config.mines) {
    return new Set<number>([safeIndex]);
  }
  return zone;
}

/**
 * Расставить мины, гарантированно не задев `safeIndex` и его окружение.
 * Возвращает новое поле. Мины встают только там, где есть клетка фигуры.
 */
export function placeMines(
  board: Board,
  config: LevelConfig,
  safeIndex: number,
  rng: Rng,
): Board {
  if (!isValidIndex(safeIndex, config)) {
    throw new RangeError(`placeMines: safeIndex ${safeIndex} вне поля`);
  }

  const forbidden = safeZone(board, config, safeIndex);
  const candidates = openIndices(board).filter((index) => !forbidden.has(index));
  if (candidates.length < config.mines) {
    throw new Error(
      `placeMines: не хватает клеток под мины (нужно ${config.mines}, доступно ${candidates.length})`,
    );
  }

  const mineIndices = new Set(shuffle(candidates, rng).slice(0, config.mines));
  return board.map((cell) => (mineIndices.has(cell.index) ? { ...cell, hasMine: true } : cell));
}

/**
 * Пересчитать цифры: для каждой клетки — количество мин среди 8 соседей.
 * Функция идемпотентна и используется в том числе после подсказки «Убрать мину».
 */
export function withAdjacency(board: Board, config: LevelConfig): Board {
  return board.map((cell) => {
    const adjacentMines = neighborIndices(cell.index, config).reduce(
      (acc, neighbor) => acc + (cellAt(board, neighbor).hasMine ? 1 : 0),
      0,
    );
    return cell.adjacentMines === adjacentMines ? cell : { ...cell, adjacentMines };
  });
}

/**
 * Полная генерация поля под первый клик: мины + цифры.
 * Мины ставятся после первого клика, поэтому первая клетка всегда безопасна.
 */
export function createBoard(
  board: Board,
  config: LevelConfig,
  safeIndex: number,
  rng: Rng,
): Board {
  const withMines = placeMines(board, config, safeIndex, rng);
  return withAdjacency(withMines, config);
}

/**
 * Убрать мину с поля (подсказка «Убрать мину»).
 *
 * Клетка становится обычной безопасной, а цифры у всех её соседей
 * пересчитываются заново — это фича, а не баг: игрок видит, что поле изменилось.
 * Если на клетке стоял флажок, он снимается: мины больше нет.
 */
export function removeMine(board: Board, config: LevelConfig, index: number): Board {
  const cleared = board.map((cell) => {
    if (cell.index !== index) return cell;
    return {
      ...cell,
      hasMine: false,
      adjacentMines: 0,
      exploded: false,
      state: cell.state === 'flagged' ? ('hidden' as CellState) : cell.state,
    } satisfies Cell;
  });
  return withAdjacency(cleared, config);
}

/** Все мины поля (для магазина и раскрытия после проигрыша). */
export function minesOf(board: Board): readonly Mine[] {
  return board
    .filter((cell) => cell.hasMine)
    .map((cell) => ({ index: cell.index, row: cell.row, col: cell.col }));
}

/** Индексы клеток, подходящих под условие-предикат. */
export function indicesWhere(board: Board, predicate: (cell: Cell) => boolean): readonly number[] {
  return board.filter(predicate).map((cell) => cell.index);
}
