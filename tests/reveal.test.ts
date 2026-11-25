/**
 * Тесты ходов: каскадное открытие, флажки, монеты, волна, победа, проигрыш, иммутабельность.
 */

import { describe, expect, it } from 'vitest';
import { cellAt, countSafeCells, getLevelConfig, neighborIndices } from '../src/game/board';
import { openCell, toggleFlag, WIN_BONUS_COINS } from '../src/game/reveal';
import { gameReducer } from '../src/game/useGame';
import type { Board, GameState, LevelConfig } from '../src/game/types';
import { CLASSIC_LEVEL, classicState } from './helpers';

const CONFIG: LevelConfig = getLevelConfig(CLASSIC_LEVEL); // 9×9, 15 мин
const SEED = 42;
const CENTER = 40; // row 4, col 4
const T0 = 1_700_000_000_000;

/** Партия, в которой уже сделан безопасный первый клик (мины расставлены). */
function startedState(seed: number = SEED): GameState {
  return openCell(classicState({ seed }), CENTER, T0);
}

/** Первая закрытая клетка без мины — чтобы сделать «обычный» ход. */
function firstHiddenSafeIndex(state: GameState): number {
  const cell = state.board.find((item) => item.state === 'hidden' && !item.hasMine);
  if (cell === undefined) throw new Error('нет закрытой безопасной клетки');
  return cell.index;
}

/** Индексы мин поля. */
function mineIndices(board: Board): readonly number[] {
  return board.filter((cell) => cell.hasMine).map((cell) => cell.index);
}

/** Довести партию до победы, открывая все безопасные клетки. */
function winGame(state: GameState, now: number): GameState {
  let current = state;
  const safeIndices = current.board.filter((cell) => !cell.hasMine).map((cell) => cell.index);
  for (const index of safeIndices) {
    if (current.status === 'won') break;
    current = openCell(current, index, now);
  }
  return current;
}

/** Рекурсивная заморозка — любая попытка мутации упадёт в strict mode. */
function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value;
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  Object.freeze(value);
  return value;
}

describe('reveal: первый клик', () => {
  it('расставляет мины и переводит партию в игру', () => {
    const before = classicState({ seed: SEED });
    expect(before.status).toBe('idle');
    expect(before.minesPlaced).toBe(false);
    expect(before.board.every((cell) => !cell.hasMine)).toBe(true);

    const after = openCell(before, CENTER, T0);
    expect(after.status).toBe('playing');
    expect(after.minesPlaced).toBe(true);
    expect(cellAt(after.board, CENTER).state).toBe('revealed');
    expect(mineIndices(after.board)).toHaveLength(CONFIG.mines);
  });

  it('открывает область, а не одну клетку: ни одна открытая клетка не мина', () => {
    const after = startedState();
    const revealed = after.board.filter((cell) => cell.state === 'revealed');

    expect(revealed.length).toBeGreaterThan(1);
    expect(revealed.every((cell) => !cell.hasMine)).toBe(true);
    expect(after.openedSafe).toBe(revealed.length);
  });
});

describe('reveal: каскадное открытие', () => {
  it('все соседи пустой клетки тоже открыты (рекурсия остановилась только на цифрах)', () => {
    const after = startedState();
    const emptyCells = after.board.filter(
      (cell) => cell.state === 'revealed' && cell.adjacentMines === 0,
    );
    expect(emptyCells.length).toBeGreaterThan(0);

    for (const cell of emptyCells) {
      for (const neighbor of neighborIndices(cell.index, CONFIG)) {
        expect(cellAt(after.board, neighbor).state, `сосед ${neighbor} клетки ${cell.index}`).toBe(
          'revealed',
        );
      }
    }
  });

  it('открытые цифры не «пробивают» дальше: у каждой открытой цифры есть причина быть открытой', () => {
    const after = startedState();
    const revealedDigits = after.board.filter(
      (cell) => cell.state === 'revealed' && cell.adjacentMines > 0,
    );

    for (const digit of revealedDigits) {
      const neighbors = neighborIndices(digit.index, CONFIG).map((index) =>
        cellAt(after.board, index),
      );
      const touchedByEmptyCell = neighbors.some(
        (neighbor) => neighbor.adjacentMines === 0 && neighbor.state === 'revealed',
      );
      expect(touchedByEmptyCell, `клетка ${digit.index}`).toBe(true);
    }
  });

  it('открытие клеток не меняет мины и цифры', () => {
    const after = startedState();
    const next = openCell(after, firstHiddenSafeIndex(after), T0 + 1000);

    next.board.forEach((cell) => {
      const previous = cellAt(after.board, cell.index);
      expect(cell.hasMine).toBe(previous.hasMine);
      expect(cell.adjacentMines).toBe(previous.adjacentMines);
    });
  });

  it('повторный клик по открытой клетке — не ход (возвращается то же состояние)', () => {
    const after = startedState();
    expect(openCell(after, CENTER, T0 + 1000)).toBe(after);
  });
});

describe('reveal: волна раскрытия для анимации', () => {
  it('событие reveal содержит точку клика и ring = расстояние по каскаду', () => {
    const state = startedState();
    const event = state.lastEvent;
    expect(event?.kind).toBe('reveal');
    if (event?.kind !== 'reveal') throw new Error('ожидалось событие reveal');

    expect(event.origin).toBe(CENTER);
    expect(event.id).toBe(state.moveId);
    expect(event.cells.find((wave) => wave.index === CENTER)?.ring).toBe(0);

    const ringOf = (index: number): number | undefined =>
      event.cells.find((wave) => wave.index === index)?.ring;

    for (const wave of event.cells) {
      if (wave.index === CENTER) continue;
      expect(wave.ring).toBeGreaterThanOrEqual(1);

      // Раскрывает только пустая клетка (у цифры соседей не открывают),
      // поэтому «родитель» волны — пустой сосед, уже попавший в каскад.
      const parentRings = neighborIndices(wave.index, CONFIG)
        .filter((neighbor) => cellAt(state.board, neighbor).adjacentMines === 0)
        .map((neighbor) => ringOf(neighbor))
        .filter((ring): ring is number => ring !== undefined);

      expect(
        parentRings.length,
        `у клетки ${wave.index} нет пустого соседа в каскаде`,
      ).toBeGreaterThan(0);
      expect(wave.ring, `клетка ${wave.index}`).toBe(Math.min(...parentRings) + 1);
    }
  });

  it('все открытые клетки попали в событие ровно один раз', () => {
    const state = startedState();
    const event = state.lastEvent;
    if (event?.kind !== 'reveal') throw new Error('ожидалось событие reveal');

    const revealed = state.board.filter((cell) => cell.state === 'revealed').map((cell) => cell.index);
    expect(event.cells.map((wave) => wave.index).sort((a, b) => a - b)).toEqual(
      [...revealed].sort((a, b) => a - b),
    );
  });
});

describe('reveal: монеты', () => {
  it('+1 монета за каждую открытую безопасную клетку, включая каскад', () => {
    const after = startedState();
    const revealed = after.board.filter((cell) => cell.state === 'revealed').length;

    expect(revealed).toBeGreaterThan(1);
    expect(after.coins).toBe(revealed);
    expect(after.coins).toBe(after.openedSafe);
  });

  it('монеты накапливаются между ходами', () => {
    const first = startedState();
    const second = openCell(first, firstHiddenSafeIndex(first), T0 + 1000);
    expect(second.coins).toBeGreaterThan(first.coins);
    expect(second.coins).toBe(second.openedSafe);
  });

  it('за победу начисляется бонус +50', () => {
    const won = winGame(startedState(), T0 + 30_000);
    const safeTotal = countSafeCells(CONFIG);

    expect(won.status).toBe('won');
    expect(won.openedSafe).toBe(safeTotal);
    expect(won.coins).toBe(safeTotal + WIN_BONUS_COINS);
  });
});

describe('reveal: флажки', () => {
  it('флажок нельзя поставить на открытую клетку — тап игнорируется', () => {
    const after = startedState();
    const flagged = toggleFlag(after, CENTER);

    expect(flagged).toBe(after); // тот же объект: ход не изменил состояние
    expect(flagged.flags).toBe(0);
    expect(cellAt(flagged.board, CENTER).state).toBe('revealed');
  });

  it('флажок ставится и снимается на закрытой клетке', () => {
    const after = startedState();
    const target = firstHiddenSafeIndex(after);

    const withFlag = toggleFlag(after, target);
    expect(cellAt(withFlag.board, target).state).toBe('flagged');
    expect(withFlag.flags).toBe(1);
    expect(withFlag.lastEvent).toEqual({
      kind: 'flag',
      id: withFlag.moveId,
      index: target,
      flagged: true,
    });

    const withoutFlag = toggleFlag(withFlag, target);
    expect(cellAt(withoutFlag.board, target).state).toBe('hidden');
    expect(withoutFlag.flags).toBe(0);
  });

  it('открытие клетки под флажком игнорируется', () => {
    const after = startedState();
    const target = firstHiddenSafeIndex(after);
    const withFlag = toggleFlag(after, target);

    expect(openCell(withFlag, target, T0 + 1000)).toBe(withFlag);
    expect(cellAt(withFlag.board, target).state).toBe('flagged');
  });

  it('флажок можно ставить до первого клика — мины при этом не расставляются', () => {
    const initial = classicState({ seed: SEED });
    const flagged = toggleFlag(initial, 0);

    expect(flagged.flags).toBe(1);
    expect(flagged.minesPlaced).toBe(false);
    expect(flagged.status).toBe('idle');
    expect(initial.flags).toBe(0); // исходное состояние не изменилось
  });
});

describe('reveal: победа', () => {
  it('победа — когда открыты все безопасные клетки', () => {
    const safeTotal = countSafeCells(CONFIG);
    const state = winGame(startedState(), T0 + 30_000);

    expect(state.status).toBe('won');
    expect(state.openedSafe).toBe(safeTotal);
    // Оставшиеся мины помечены флажками, безопасные клетки — открыты.
    expect(state.flags).toBe(CONFIG.mines);
    expect(state.board.filter((cell) => cell.hasMine).every((cell) => cell.state === 'flagged')).toBe(
      true,
    );
    expect(
      state.board.filter((cell) => !cell.hasMine).every((cell) => cell.state === 'revealed'),
    ).toBe(true);
  });

  it('флажки сами по себе победу не дают: все мины помечены, но безопасные клетки ещё закрыты', () => {
    let state = startedState();
    const safeTotal = countSafeCells(CONFIG);

    // «Читерски» ставим флажки на все мины.
    for (const index of mineIndices(state.board)) {
      state = toggleFlag(state, index);
    }

    const hiddenSafe = state.board.filter((cell) => !cell.hasMine && cell.state === 'hidden');
    expect(state.flags).toBe(CONFIG.mines);
    expect(hiddenSafe.length).toBeGreaterThan(0);
    expect(state.openedSafe).toBeLessThan(safeTotal);
    // Все мины помечены, но победы нет — она определяется открытыми клетками, а не флажками.
    expect(state.status).toBe('playing');
  });

  it('статус won наступает ровно тогда, когда открыты все безопасные клетки', () => {
    const safeTotal = countSafeCells(CONFIG);
    let state = startedState();
    const safeIndices = state.board.filter((cell) => !cell.hasMine).map((cell) => cell.index);

    let steps = 0;
    for (const index of safeIndices) {
      if (state.status === 'won') break;
      state = openCell(state, index, T0 + 30_000);
      steps += 1;
      if (state.status !== 'won') {
        expect(state.openedSafe).toBeLessThan(safeTotal);
      }
    }

    expect(steps).toBeGreaterThan(0);
    expect(state.status).toBe('won');
    expect(state.openedSafe).toBe(safeTotal);
  });
});

describe('reveal: проигрыш', () => {
  it('клик по мине: все мины раскрыты, взорвавшаяся клетка помечена', () => {
    const state = startedState();
    const mine = state.board.find((cell) => cell.hasMine);
    expect(mine).toBeDefined();
    if (mine === undefined) throw new Error('на поле нет мин');

    const lost = openCell(state, mine.index, T0 + 5000);

    expect(lost.status).toBe('lost');
    expect(lost.explodedIndex).toBe(mine.index);
    expect(cellAt(lost.board, mine.index).exploded).toBe(true);
    expect(lost.board.filter((cell) => cell.exploded)).toHaveLength(1);
    expect(
      lost.board.filter((cell) => cell.hasMine).every((cell) => cell.state === 'revealed'),
    ).toBe(true);
    expect(lost.lastEvent).toEqual({ kind: 'explode', id: lost.moveId, index: mine.index });
  });

  it('после завершения партии ходы игнорируются', () => {
    const state = startedState();
    const mine = state.board.find((cell) => cell.hasMine);
    if (mine === undefined) throw new Error('на поле нет мин');

    const lost = openCell(state, mine.index, T0 + 5000);
    const hidden = lost.board.find((cell) => cell.state === 'hidden');

    expect(openCell(lost, mine.index, T0 + 6000)).toBe(lost);
    expect(toggleFlag(lost, mine.index)).toBe(lost);
    if (hidden !== undefined) {
      expect(openCell(lost, hidden.index, T0 + 6000)).toBe(lost);
    }
  });
});

describe('reveal: пауза', () => {
  it('на паузе поле не принимает ходы', () => {
    const state = startedState();
    const paused = gameReducer(state, { type: 'PAUSE', now: T0 + 1000 });

    expect(paused.paused).toBe(true);
    expect(openCell(paused, firstHiddenSafeIndex(paused), T0 + 2000)).toBe(paused);
    expect(toggleFlag(paused, firstHiddenSafeIndex(paused))).toBe(paused);
  });
});

describe('reveal: иммутабельность', () => {
  it('исходное состояние не меняется после ходов', () => {
    const before = classicState({ seed: SEED });
    const snapshot = JSON.stringify(before);

    openCell(before, CENTER, T0);
    toggleFlag(before, 0);

    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('действия работают на глубоко замороженном состоянии (мутаций нет)', () => {
    const frozen = deepFreeze(classicState({ seed: SEED }));

    const afterReveal = openCell(frozen, CENTER, T0);
    expect(afterReveal).not.toBe(frozen);
    expect(afterReveal.board).not.toBe(frozen.board);

    const afterFlag = toggleFlag(afterReveal, firstHiddenSafeIndex(afterReveal));
    expect(afterFlag).not.toBe(afterReveal);

    const afterSecondReveal = openCell(afterFlag, firstHiddenSafeIndex(afterFlag), T0 + 1000);
    expect(afterSecondReveal.board).not.toBe(afterFlag.board);
  });
});
