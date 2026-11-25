/**
 * Общие помощники тестов.
 *
 * Уровни кампании 1..N идут с фигурой: поле — это силуэт, мины расставляются
 * после первого клика. Тесты игровой логики проверяются на уровне **без**
 * фигуры — там обычное поле 9×9, и первый клик по центру гарантированно
 * безопасен.
 */

import { LEVEL_SHAPES, SHAPE_LEVEL_COUNT } from '../src/game/shapes';
import { openCell } from '../src/game/reveal';
import type { GameState } from '../src/game/types';
import { createInitialState } from '../src/game/useGame';

/** Первый уровень кампании без фигуры: 9×9, 15 мин, классическая расстановка. */
export const CLASSIC_LEVEL = SHAPE_LEVEL_COUNT + 1;

/** Партия на классическом уровне кампании. */
export function classicState(
  options: { readonly seed?: number; readonly coins?: number; readonly bestTime?: number | null } = {},
): GameState {
  return createInitialState({ mode: 'campaign', level: CLASSIC_LEVEL, ...options });
}

/** Первый уровень с фигурой: у него поле — силуэт, а не прямоугольник. */
export const FIRST_SHAPE_LEVEL = 1;

/** Сколько всего уровней с фигурами. */
export const SHAPE_LEVELS_TOTAL = LEVEL_SHAPES.length;
/** Первая закрытая безопасная клетка (пустота вокруг фигуры не считается). */
export function firstSafeIndex(state: GameState): number {
  const cell = state.board.find(
    (item) => !item.blocked && item.state === 'hidden' && !item.hasMine,
  );
  if (cell === undefined) throw new Error('нет закрытой безопасной клетки');
  return cell.index;
}

/** Открыть первую безопасную клетку — безопасный «первый ход» в любом режиме. */
export function openFirstSafe(state: GameState, now: number): GameState {
  return openCell(state, firstSafeIndex(state), now);
}

/** Довести партию до победы, открывая только безопасные клетки. */
export function winGame(state: GameState, now: number): GameState {
  let current = state;
  for (const cell of current.board) {
    if (current.status === 'won') break;
    if (cell.blocked || cell.hasMine) continue;
    current = openCell(current, cell.index, now);
  }
  return current;
}
