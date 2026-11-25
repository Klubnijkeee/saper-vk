/**
 * Общие помощники тестов.
 *
 * Уровни кампании 1..16 идут с фигурой: мины расставлены заранее, а стартовая
 * зона уже открыта. Тесты игровой логики проверяются на уровне **без** фигуры —
 * там работает классическое «мины после первого клика», и первый клик по центру
 * гарантированно безопасен.
 */

import { PATTERN_LEVELS } from '../src/game/patterns';
import { openCell } from '../src/game/reveal';
import type { GameState } from '../src/game/types';
import { createInitialState } from '../src/game/useGame';

/** Первый уровень кампании без фигуры: 9×9, 15 мин, классическая расстановка. */
export const CLASSIC_LEVEL = PATTERN_LEVELS + 1;

/** Партия на классическом уровне кампании. */
export function classicState(
  options: { readonly seed?: number; readonly coins?: number; readonly bestTime?: number | null } = {},
): GameState {
  return createInitialState({ mode: 'campaign', level: CLASSIC_LEVEL, ...options });
}

/** Первая закрытая безопасная клетка. */
export function firstSafeIndex(state: GameState): number {
  const cell = state.board.find((item) => item.state === 'hidden' && !item.hasMine);
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
    if (cell.hasMine) continue;
    current = openCell(current, cell.index, now);
  }
  return current;
}
