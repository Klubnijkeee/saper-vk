/**
 * Демонстрационный тест: печатает партию в консоль (ASCII-рендер поля).
 * Нужен, чтобы логику можно было увидеть глазами, а не только в ассертах.
 */

import { describe, expect, it } from 'vitest';
import { cellAt, indexOf } from '../src/game/board';
import { formatClock } from '../src/game/clock';
import { openCell, toggleFlag } from '../src/game/reveal';
import { createInitialState } from '../src/game/useGame';
import type { GameState } from '../src/game/types';

const T0 = 1_700_000_000_000;

/** ASCII-рендер поля: `·` закрыто, `F` флажок, `*` мина, цифры, пробел — пусто. */
function render(state: GameState): string {
  const lines: string[] = [];
  for (let row = 0; row < state.config.rows; row += 1) {
    let line = '';
    for (let col = 0; col < state.config.cols; col += 1) {
      const cell = cellAt(state.board, indexOf(row, col, state.config));
      if (cell.state === 'flagged') {
        line += 'F';
      } else if (cell.state === 'revealed') {
        line += cell.hasMine ? '*' : cell.adjacentMines === 0 ? ' ' : String(cell.adjacentMines);
      } else {
        line += '·';
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** Строка со статистикой партии. */
function stats(state: GameState): string {
  return `уровень ${state.level} · время ${formatClock(state.clock.elapsedMs)} · монеты ${state.coins} · открыто ${state.openedSafe} · флажков ${state.flags} · статус ${state.status}`;
}

function line(label: string): void {
  console.log(`\n${label}`);
}

describe('партия целиком', () => {
  it('печатает поле: старт, каскад, флажок, взрыв', () => {
    const seed = 2024;
    let state = createInitialState({ level: 1, seed });

    line(`До первого клика (мин ${state.config.mines}, seed ${seed}):`);
    console.log(render(state));

    // Первый клик — по центру: гарантированно безопасен и открывает область.
    state = openCell(state, 40, T0);
    line('После первого клика по центру (каскад):');
    console.log(render(state));
    console.log(stats(state));

    // Флажок на первую мину — так делает игрок.
    const mine = state.board.find((cell) => cell.hasMine);
    expect(mine).toBeDefined();
    if (mine === undefined) throw new Error('на поле нет мин');

    state = toggleFlag(state, mine.index);
    line(`Флажок на клетке ${mine.index}:`);
    console.log(render(state));

    // Снимаем флажок и наступаем на мину.
    state = toggleFlag(state, mine.index);
    state = openCell(state, mine.index, T0 + 42_000);
    line(`Проигрыш (взорвалась клетка ${String(state.explodedIndex)}):`);
    console.log(render(state));
    console.log(stats(state));

    expect(state.status).toBe('lost');
    expect(state.explodedIndex).toBe(mine.index);
    expect(state.clock.elapsedMs).toBe(42_000);
  });

  it('печатает выигранную партию с монетами и рекордом', () => {
    let state = createInitialState({ level: 1, seed: 2024 });
    state = openCell(state, 40, T0);

    for (const cell of state.board) {
      if (state.status === 'won') break;
      if (cell.hasMine) continue;
      state = openCell(state, cell.index, T0 + 68_000);
    }

    line('Победа:');
    console.log(render(state));
    console.log(stats(state));
    console.log(`рекорд: ${state.bestTime === null ? '—' : formatClock(state.bestTime)}`);

    expect(state.status).toBe('won');
    expect(state.bestTime).toBe(68_000);
  });
});
