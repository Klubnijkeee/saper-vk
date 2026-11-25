/**
 * Логика ходов: открытие клеток, каскадное открытие пустых, флажки, монеты,
 * победа и проигрыш.
 *
 * Все функции — чистые: принимают состояние и возвращают новое.
 * Если ход невозможен (открытая клетка, флажок, партия завершена, пауза) —
 * возвращается **тот же самый объект** состояния, чтобы React не перерисовывал поле.
 */

import { cellAt, countSafeCells, createBoard, isValidIndex, neighborIndices } from './board';
import { freezeClock, startClock } from './clock';
import { applyMatchEnd } from './meta';
import { createRng } from './random';
import type { Board, Cell, CellState, GameState, LevelConfig, WaveCell } from './types';

/** Монет за каждую открытую безопасную клетку. */
export const COIN_PER_SAFE_CELL = 1;
/** Бонус за победу (начисляется один раз, поверх монет за клетки). */
export const WIN_BONUS_COINS = 50;

/** Сколько мин сейчас на поле (учитывает подсказку «Убрать мину»). */
export function remainingMines(state: GameState): number {
  return Math.max(0, state.config.mines - state.minesRemoved);
}

/** Сколько безопасных клеток нужно открыть для победы прямо сейчас. */
export function safeCellsTotal(state: GameState): number {
  return countSafeCells(state.config, state.minesRemoved);
}

/** Открытая клетка вместе с её расстоянием от точки клика (для волны анимации). */
interface OpenedCell {
  readonly cell: Cell;
  readonly ring: number;
}

/**
 * Открыть клетку (ход игрока).
 *
 * 1. Первый клик расставляет мины (сама клетка и её окружение гарантированно пусты).
 * 2. Мина → проигрыш.
 * 3. Пустая клетка → каскадное открытие соседей + монеты за каждую открытую клетку.
 */
export function openCell(state: GameState, index: number, now: number): GameState {
  if (state.paused) return state;
  if (state.status === 'won' || state.status === 'lost') return state;
  if (!isValidIndex(index, state.config)) return state;

  const cell = cellAt(state.board, index);
  // Открытая клетка или флажок — ход игнорируется.
  if (cell.state !== 'hidden') return state;

  // Мины ставятся на первом открытии: до этого поле пустое, поэтому клик безопасен.
  const board = state.minesPlaced
    ? state.board
    : createBoard(state.config, index, createRng(state.seed));
  const target = cellAt(board, index);

  if (target.hasMine) return lose(state, board, index, now);

  const opened = floodFill(board, state.config, index);
  const nextBoard = board.map((cell2) => opened.get(cell2.index)?.cell ?? cell2);
  const cells: readonly WaveCell[] = [...opened.values()].map(({ cell: item, ring }) => ({
    index: item.index,
    ring,
  }));

  return completeOpening(state, {
    board: nextBoard,
    cells,
    origin: index,
    coinDelta: opened.size * COIN_PER_SAFE_CELL,
    now,
  });
}

/**
 * Открыть ровно одну клетку без каскада и без монет — подсказка «Открыть клетку».
 *
 * Каскад здесь намеренно не запускается: игрок платит за одну клетку, а не за зону.
 * Монеты за неё тоже не начисляются, иначе подсказка частично окупала бы себя.
 */
export function openSingleCell(state: GameState, index: number, now: number): GameState {
  if (state.paused) return state;
  if (state.status !== 'playing') return state;
  if (!isValidIndex(index, state.config)) return state;

  const cell = cellAt(state.board, index);
  if (cell.state !== 'hidden' || cell.hasMine) return state;

  const board = state.board.map((item) =>
    item.index === index ? { ...item, state: 'revealed' as CellState } : item,
  );

  return completeOpening(state, {
    board,
    cells: [{ index, ring: 0 }],
    origin: index,
    coinDelta: 0,
    now,
  });
}

/** Результат открытия клеток, из которого собирается новое состояние. */
interface Opening {
  readonly board: Board;
  readonly cells: readonly WaveCell[];
  readonly origin: number;
  readonly coinDelta: number;
  readonly now: number;
}

/** Общая часть всех открытий: собрать состояние, начислить монеты, проверить победу. */
function completeOpening(state: GameState, opening: Opening): GameState {
  const openedSafe = state.openedSafe + opening.cells.length;
  const moveId = state.moveId + 1;

  const next: GameState = {
    ...state,
    board: opening.board,
    status: 'playing',
    minesPlaced: true,
    openedSafe,
    coins: state.coins + opening.coinDelta,
    // Счётчик открытых клеток за партию — уезжает в статистику на её исходе.
    cellsOpened: state.cellsOpened + opening.cells.length,
    // Часы стартуют на первом открытии.
    clock: startClock(state.clock, opening.now),
    moveId,
    lastEvent: {
      kind: 'reveal',
      id: moveId,
      origin: opening.origin,
      cells: opening.cells,
    },
  };

  // Победа — когда открыты ВСЕ безопасные клетки (а не когда помечены мины).
  return openedSafe >= safeCellsTotal(state) ? win(next, opening.now) : next;
}

/**
 * Стартовая зона уровня с фигурой.
 *
 * Мины на таком уровне расставлены заранее, поэтому «первый клик безопасен»
 * обеспечивается иначе: игра сама открывает клетку `S` и её окружение.
 * Часы при этом не запускаются (партия ещё `idle`), монеты не начисляются —
 * это подарок уровня, а не ход игрока. Волна раскрытия проигрывается та же,
 * что и при обычном клике.
 *
 * Открывается ровно 3×3, без каскада: на разреженных фигурах каскад от старта
 * мог бы раскрыть всё поле и выиграть уровень одним касанием.
 */
export function openStartZone(state: GameState, index: number): GameState {
  if (!isValidIndex(index, state.config)) return state;

  const startRow = Math.floor(index / state.config.cols);
  const startCol = index % state.config.cols;
  const cells: WaveCell[] = [];

  const board = state.board.map((cell) => {
    const inZone = Math.abs(cell.row - startRow) <= 1 && Math.abs(cell.col - startCol) <= 1;
    if (!inZone || cell.state !== 'hidden') return cell;

    cells.push({
      index: cell.index,
      ring: Math.max(Math.abs(cell.row - startRow), Math.abs(cell.col - startCol)),
    });
    return { ...cell, state: 'revealed' as CellState };
  });

  if (cells.length === 0) return state;

  const moveId = state.moveId + 1;
  return {
    ...state,
    board,
    status: 'idle',
    minesPlaced: true,
    openedSafe: state.openedSafe + cells.length,
    moveId,
    lastEvent: { kind: 'reveal', id: moveId, origin: index, cells },
  };
}

/**
 * Каскадное открытие: открываем клетку; если у неё нет мин рядом —
 * продолжаем с её соседями.
 *
 * Реализовано итеративно (очередь BFS), а не рекурсией: поведение «рекурсивное»,
 * но стек не растёт. Обход в ширину заодно даёт `ring` — расстояние от точки
 * клика, по которому UI строит волну раскрытия.
 */
function floodFill(
  board: Board,
  config: LevelConfig,
  startIndex: number,
): ReadonlyMap<number, OpenedCell> {
  const opened = new Map<number, OpenedCell>();
  const queue: Array<{ index: number; ring: number }> = [{ index: startIndex, ring: 0 }];

  for (let head = 0; head < queue.length; head += 1) {
    const entry = queue[head];
    if (entry === undefined) continue;

    const cell = cellAt(board, entry.index);
    // Флажки не открываем, уже открытые — пропускаем. Мина в каскад попасть не может:
    // раскрываемся только от клеток с нулём мин вокруг.
    if (cell.hasMine || cell.state !== 'hidden' || opened.has(entry.index)) continue;

    // Открываем клетку: в карту кладём уже новую клетку (state: 'revealed'),
    // иначе поле останется прежним, а монеты и счётчик открытых разойдутся с ним.
    opened.set(entry.index, { cell: { ...cell, state: 'revealed' as CellState }, ring: entry.ring });
    if (cell.adjacentMines > 0) continue;

    for (const neighbor of neighborIndices(entry.index, config)) {
      if (opened.has(neighbor)) continue;
      const neighborCell = cellAt(board, neighbor);
      if (neighborCell.state === 'hidden' && !neighborCell.hasMine) {
        queue.push({ index: neighbor, ring: entry.ring + 1 });
      }
    }
  }

  return opened;
}

/**
 * Победа: оставшиеся мины помечаем флажками, все безопасные клетки — открыты,
 * чтобы финальное поле выглядело цельным (и не оставалось «неверных» флажков).
 * Часы останавливаются, начисляется бонус, обновляется рекорд.
 */
function win(state: GameState, now: number): GameState {
  let flags = 0;
  const board = state.board.map((cell) => {
    if (cell.hasMine) {
      flags += 1;
      return cell.state === 'flagged' ? cell : { ...cell, state: 'flagged' as CellState };
    }
    return cell.state === 'revealed' ? cell : { ...cell, state: 'revealed' as CellState };
  });

  const clock = freezeClock(state.clock, now);
  const elapsedMs = clock.elapsedMs;
  const bestTime = state.bestTime === null ? elapsedMs : Math.min(state.bestTime, elapsedMs);

  // Исход партии уходит в мета-прогресс: статистика, рекорд режима,
  // счётчики дня, достижения и звёзды за них.
  const meta = applyMatchEnd(state.meta, {
    mode: state.mode,
    won: true,
    timeMs: elapsedMs,
    cellsOpened: state.cellsOpened,
    flagsPlaced: state.flagsPlaced,
    hintsUsed: state.hintsUsed,
    level: state.level,
    mines: state.config.mines,
    now,
  });

  return {
    ...state,
    board,
    status: 'won',
    flags,
    clock,
    coins: state.coins + WIN_BONUS_COINS,
    bestTime,
    hintedIndex: null,
    meta,
  };
}

/** Проигрыш: раскрываем все мины и помечаем клетку, на которой рвануло. Часы стоп. */
function lose(state: GameState, board: Board, explodedIndex: number, now: number): GameState {
  const nextBoard = board.map((cell) => {
    if (cell.index === explodedIndex) {
      return { ...cell, state: 'revealed' as CellState, exploded: true };
    }
    if (cell.hasMine) {
      return { ...cell, state: 'revealed' as CellState };
    }
    // Неверные флажки не стираем — UI покажет их перечёркнутыми.
    return cell;
  });

  const clock = freezeClock(startClock(state.clock, now), now);
  const moveId = state.moveId + 1;

  // Проигрыш тоже идёт в статистику: серия побед сбрасывается, партия засчитана.
  const meta = applyMatchEnd(state.meta, {
    mode: state.mode,
    won: false,
    timeMs: clock.elapsedMs,
    cellsOpened: state.cellsOpened,
    flagsPlaced: state.flagsPlaced,
    hintsUsed: state.hintsUsed,
    level: state.level,
    mines: state.config.mines,
    now,
  });

  return {
    ...state,
    board: nextBoard,
    status: 'lost',
    minesPlaced: true,
    explodedIndex,
    clock,
    moveId,
    hintedIndex: null,
    meta,
    lastEvent: { kind: 'explode', id: moveId, index: explodedIndex },
  };
}

/**
 * Поставить/снять флажок.
 * На открытую клетку флажок не ставится — ход игнорируется.
 */
export function toggleFlag(state: GameState, index: number): GameState {
  if (state.paused) return state;
  if (state.status === 'won' || state.status === 'lost') return state;
  if (!isValidIndex(index, state.config)) return state;

  const cell = cellAt(state.board, index);
  if (cell.state === 'revealed') return state;

  const nextState: CellState = cell.state === 'flagged' ? 'hidden' : 'flagged';
  const board = state.board.map((item) =>
    item.index === index ? { ...item, state: nextState } : item,
  );

  const moveId = state.moveId + 1;
  return {
    ...state,
    board,
    flags: state.flags + (nextState === 'flagged' ? 1 : -1),
    // Считаем только флажки, поставленные игроком (автофлажки на победе — не в счёт).
    flagsPlaced: state.flagsPlaced + (nextState === 'flagged' ? 1 : 0),
    moveId,
    lastEvent: { kind: 'flag', id: moveId, index, flagged: nextState === 'flagged' },
  };
}

/** Сколько флажков стоит на поле (для отображения «флажки / мины»). */
export function countFlags(board: Board): number {
  return board.filter((cell) => cell.state === 'flagged').length;
}
