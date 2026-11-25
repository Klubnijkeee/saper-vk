/**
 * Тесты магазина: каталог, доступность и применение трёх подсказок.
 *
 * Главный сценарий Шага 3 — «убрал мину → цифры пересчитались» — проверяется
 * целиком: счётчик мин, пересчёт цифр, рост числа безопасных клеток и победа
 * уже по новому порогу.
 */

import { describe, expect, it } from 'vitest';
import {
  cellAt,
  countSafeCells,
  getLevelConfig,
  minesOf,
  neighborIndices,
} from '../src/game/board';
import { openCell, remainingMines, safeCellsTotal, toggleFlag } from '../src/game/reveal';
import {
  applyHint,
  canAfford,
  findShopItem,
  hasHintTarget,
  hintTargets,
  isShopAvailable,
  SHOP_ITEMS,
} from '../src/game/shop';
import { gameReducer } from '../src/game/useGame';
import type { GameState, LevelConfig, ShopItemId } from '../src/game/types';
import { CLASSIC_LEVEL, classicState } from './helpers';

const CONFIG: LevelConfig = getLevelConfig(CLASSIC_LEVEL); // 9×9, 15 мин
const SEED = 42;
const CENTER = 40;
const T0 = 1_700_000_000_000;

/** Партия, в которой сделан первый безопасный ход. Монет по умолчанию хватает на всё. */
function playingState(coins = 500): GameState {
  const initial = classicState({ seed: SEED, coins });
  return openCell(initial, CENTER, T0);
}

/** Индекс клетки, на которой сработало последнее событие. */
function eventIndex(state: GameState): number {
  const event = state.lastEvent;
  if (event === null) throw new Error('у состояния нет события');
  return event.kind === 'reveal' ? event.origin : event.index;
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

describe('shop: каталог', () => {
  it('цены и порядок кнопок соответствуют ТЗ', () => {
    expect(SHOP_ITEMS.map((item) => item.id)).toEqual(['show-mine', 'open-cell', 'remove-mine']);
    expect(findShopItem('show-mine').price).toBe(50);
    expect(findShopItem('open-cell').price).toBe(30);
    expect(findShopItem('remove-mine').price).toBe(100);
  });

  it('у каждого товара есть название, описание и тексты тостов', () => {
    for (const item of SHOP_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.appliedMessage.length).toBeGreaterThan(0);
      expect(item.emptyMessage.length).toBeGreaterThan(0);
      expect(item.price).toBeGreaterThan(0);
    }
  });

  it('неизвестный id — ошибка программиста', () => {
    expect(() => findShopItem('unknown' as ShopItemId)).toThrow();
  });
});

describe('shop: доступность', () => {
  it('ровно на цену — уже можно купить', () => {
    const item = findShopItem('open-cell');
    expect(canAfford(29, item)).toBe(false);
    expect(canAfford(30, item)).toBe(true);
    expect(canAfford(31, item)).toBe(true);
  });

  it('на старте (0 монет) недоступна ни одна подсказка', () => {
    for (const item of SHOP_ITEMS) {
      expect(canAfford(0, item)).toBe(false);
    }
  });

  it('магазин работает только в идущей партии', () => {
    const idle = classicState({ seed: SEED, coins: 500 });
    expect(isShopAvailable(idle)).toBe(false);
    expect(applyHint(idle, 'open-cell', T0)).toBe(idle);

    const playing = playingState();
    expect(isShopAvailable(playing)).toBe(true);

    const paused = gameReducer(playing, { type: 'PAUSE', now: T0 + 1000 });
    expect(isShopAvailable(paused)).toBe(false);
    expect(applyHint(paused, 'open-cell', T0 + 2000)).toBe(paused);
  });

  it('не хватает монет — подсказка не применяется и деньги не списываются', () => {
    // Начинаем с нуля: после каскада монет хватает на дешёвые подсказки,
    // но на «Убрать мину» за 100 — нет.
    const state = openCell(classicState({ seed: SEED, coins: 0 }), CENTER, T0);
    const coins = state.coins;
    expect(canAfford(coins, findShopItem('remove-mine'))).toBe(false);

    const blocked = applyHint(state, 'remove-mine', T0);
    expect(blocked).toBe(state); // то же состояние: ни хода, ни списания
    expect(blocked.coins).toBe(coins);

    // Контроль: на доступную подсказку монет хватает, и она применяется.
    if (canAfford(coins, findShopItem('open-cell'))) {
      expect(applyHint(state, 'open-cell', T0)).not.toBe(state);
    }
  });
});

describe('shop: цели подсказок', () => {
  it('«Показать мину» целится только в закрытые мины', () => {
    const state = playingState();
    const hiddenMines = state.board.filter((cell) => cell.hasMine && cell.state === 'hidden');
    expect(hintTargets(state, 'show-mine')).toHaveLength(hiddenMines.length);
    expect(hintTargets(state, 'show-mine').length).toBeGreaterThan(0);
  });

  it('«Открыть клетку» целится только в закрытые безопасные клетки', () => {
    const state = playingState();
    const hiddenSafe = state.board.filter((cell) => !cell.hasMine && cell.state === 'hidden');
    expect(hintTargets(state, 'open-cell')).toHaveLength(hiddenSafe.length);
  });

  it('«Убрать мину» берёт любую мину, включая помеченную флажком', () => {
    let state = playingState();
    const mine = state.board.find((cell) => cell.hasMine && cell.state === 'hidden');
    if (mine === undefined) throw new Error('нет мины');
    state = toggleFlag(state, mine.index);

    expect(hintTargets(state, 'remove-mine')).toHaveLength(CONFIG.mines);
  });

  it('когда цели нет — подсказка не применяется и не списывает монеты', () => {
    let state = playingState();
    // Помечаем все мины флажками: закрытых мин для подсветки не остаётся.
    for (const cell of state.board) {
      if (cell.hasMine) state = toggleFlag(state, cell.index);
    }
    expect(hasHintTarget(state, 'show-mine')).toBe(false);

    const coins = state.coins;
    expect(applyHint(state, 'show-mine', T0)).toBe(state);
    expect(state.coins).toBe(coins);
  });
});

describe('shop: «Показать мину»', () => {
  it('подсвечивает мину, не открывая и не помечая её', () => {
    const before = playingState();
    const revealedBefore = before.board.filter((cell) => cell.state === 'revealed').length;

    const after = applyHint(before, 'show-mine', T0 + 1000);
    const hinted = after.hintedIndex;
    expect(hinted).not.toBeNull();
    if (hinted === null) throw new Error('нет подсветки');

    expect(cellAt(after.board, hinted).hasMine).toBe(true);
    expect(cellAt(after.board, hinted).state).toBe('hidden');
    expect(after.flags).toBe(before.flags);
    expect(after.board.filter((cell) => cell.state === 'revealed')).toHaveLength(revealedBefore);
    expect(after.coins).toBe(before.coins - findShopItem('show-mine').price);
    expect(after.hintId).toBe(before.hintId + 1);
    expect(after.lastEvent?.kind).toBe('hint');
    expect(eventIndex(after)).toBe(hinted);
  });

  it('подсветка гаснет по CLEAR_HINT и не гаснет дважды', () => {
    const hinted = applyHint(playingState(), 'show-mine', T0);
    const cleared = gameReducer(hinted, { type: 'CLEAR_HINT' });

    expect(cleared.hintedIndex).toBeNull();
    expect(gameReducer(cleared, { type: 'CLEAR_HINT' })).toBe(cleared);
  });

  it('тап по подсвеченной клетке — обычный ход: мина взрывается', () => {
    const hinted = applyHint(playingState(), 'show-mine', T0);
    const index = hinted.hintedIndex;
    if (index === null) throw new Error('нет подсветки');

    const lost = openCell(hinted, index, T0 + 1000);
    expect(lost.status).toBe('lost');
    expect(lost.explodedIndex).toBe(index);
    expect(lost.hintedIndex).toBeNull();
  });

  it('повторная подсказка перезапускает отсчёт 2 секунд (hintId растёт)', () => {
    const first = applyHint(playingState(), 'show-mine', T0);
    const second = applyHint(first, 'show-mine', T0 + 1000);
    expect(second.hintId).toBe(first.hintId + 1);
  });
});

describe('shop: «Открыть клетку»', () => {
  it('открывает ровно одну клетку: без каскада и без монет', () => {
    const before = playingState();
    const revealedBefore = before.board.filter((cell) => cell.state === 'revealed').length;

    const after = applyHint(before, 'open-cell', T0 + 1000);
    const revealedAfter = after.board.filter((cell) => cell.state === 'revealed').length;

    expect(revealedAfter).toBe(revealedBefore + 1);
    expect(after.openedSafe).toBe(before.openedSafe + 1);
    // Только списание цены: за подсказанную клетку монеты не начисляются.
    expect(after.coins).toBe(before.coins - findShopItem('open-cell').price);

    const opened = eventIndex(after);
    expect(cellAt(after.board, opened).state).toBe('revealed');
    expect(cellAt(after.board, opened).hasMine).toBe(false);
  });

  it('даже если подсказанная клетка пустая, соседи не раскрываются', () => {
    const before = playingState();
    const after = applyHint(before, 'open-cell', T0 + 1000);
    const opened = eventIndex(after);

    if (cellAt(after.board, opened).adjacentMines === 0) {
      for (const neighbor of neighborIndices(opened, CONFIG)) {
        expect(cellAt(after.board, neighbor).state, `сосед ${neighbor}`).not.toBe('revealed');
      }
    }
    // В любом случае открыта ровно одна клетка.
    expect(after.openedSafe).toBe(before.openedSafe + 1);
  });
});

describe('shop: «Убрать мину» — обязательный сценарий Шага 3', () => {
  it('мина исчезает, цифры пересчитываются, победа — по новому порогу', () => {
    const before = playingState();
    expect(minesOf(before.board)).toHaveLength(CONFIG.mines);
    expect(safeCellsTotal(before)).toBe(countSafeCells(CONFIG));

    const removed = applyHint(before, 'remove-mine', T0 + 1000);

    // 1. Мина убрана: счётчик уменьшился, деньги списаны ровно на цену.
    expect(removed.minesRemoved).toBe(1);
    expect(remainingMines(removed)).toBe(CONFIG.mines - 1);
    expect(minesOf(removed.board)).toHaveLength(CONFIG.mines - 1);
    expect(removed.coins).toBe(before.coins - findShopItem('remove-mine').price);

    const removedIndex = eventIndex(removed);
    expect(cellAt(before.board, removedIndex).hasMine).toBe(true);
    expect(cellAt(removed.board, removedIndex).hasMine).toBe(false);
    expect(cellAt(removed.board, removedIndex).state).toBe('hidden');

    // 2. Цифра у соседа уменьшилась на 1 — ещё до всякого открытия.
    const neighbour = neighborIndices(removedIndex, CONFIG).find((index) => {
      const cell = cellAt(removed.board, index);
      return !cell.hasMine && cell.state === 'hidden' && cell.adjacentMines > 0;
    });
    expect(neighbour, 'у убранной мины нет соседа-цифры').toBeDefined();
    if (neighbour === undefined) throw new Error('нет соседа-цифры');

    const digitBefore = cellAt(before.board, neighbour).adjacentMines;
    const digitAfter = cellAt(removed.board, neighbour).adjacentMines;
    expect(digitAfter).toBe(digitBefore - 1);

    // Все цифры поля пересчитаны (не только у соседей).
    removed.board.forEach((cell) => {
      const expected = neighborIndices(cell.index, CONFIG).filter(
        (index) => cellAt(removed.board, index).hasMine,
      ).length;
      expect(cell.adjacentMines, `клетка ${cell.index}`).toBe(expected);
    });

    // 3. Безопасных клеток стало на одну больше.
    expect(safeCellsTotal(removed)).toBe(countSafeCells(CONFIG) + 1);

    // 4. Открытие соседа показывает уже новую цифру.
    const opened = openCell(removed, neighbour, T0 + 2000);
    expect(cellAt(opened.board, neighbour).state).toBe('revealed');
    expect(cellAt(opened.board, neighbour).adjacentMines).toBe(digitBefore - 1);

    // 5. Победа наступает по новому порогу безопасных клеток.
    let state = removed;
    for (const cell of removed.board) {
      if (state.status === 'won') break;
      if (cell.hasMine || cell.state !== 'hidden') continue;
      state = openCell(state, cell.index, T0 + 3000);
    }

    expect(state.status).toBe('won');
    expect(state.openedSafe).toBe(countSafeCells(CONFIG) + 1);
    expect(state.flags).toBe(CONFIG.mines - 1);
  });

  it('снимает флажок с убранной мины', () => {
    // Убираем мины, пока не останется одна: тогда выбор цели однозначен.
    let state = playingState(2000);
    for (let i = 0; i < CONFIG.mines - 1; i += 1) {
      state = applyHint(state, 'remove-mine', T0);
    }
    expect(remainingMines(state)).toBe(1);

    const lastMine = state.board.find((cell) => cell.hasMine);
    if (lastMine === undefined) throw new Error('нет мины');
    state = toggleFlag(state, lastMine.index);
    expect(state.flags).toBe(1);

    const after = applyHint(state, 'remove-mine', T0);

    expect(minesOf(after.board)).toHaveLength(0);
    expect(remainingMines(after)).toBe(0);
    expect(after.flags).toBe(0);
    expect(cellAt(after.board, lastMine.index).state).toBe('hidden');
    expect(safeCellsTotal(after)).toBe(81); // всё поле безопасно
    expect(hasHintTarget(after, 'remove-mine')).toBe(false);
    expect(applyHint(after, 'remove-mine', T0)).toBe(after);
  });
});

describe('shop: чистота и иммутабельность', () => {
  it('одно и то же состояние даёт одну и ту же подсказку', () => {
    const state = playingState();
    const freeze = JSON.stringify(state);

    const first = applyHint(state, 'remove-mine', T0);
    const second = applyHint(state, 'remove-mine', T0);

    expect(second).toEqual(first);
    expect(eventIndex(second)).toBe(eventIndex(first));
    expect(JSON.stringify(state)).toBe(freeze);
  });

  it('подсказки работают на глубоко замороженном состоянии', () => {
    const frozen = deepFreeze(playingState());

    expect(() => applyHint(frozen, 'show-mine', T0)).not.toThrow();
    expect(() => applyHint(frozen, 'open-cell', T0)).not.toThrow();
    expect(() => applyHint(frozen, 'remove-mine', T0)).not.toThrow();
  });

  it('действие APPLY_HINT проходит через редьюсер', () => {
    const state = playingState();
    const next = gameReducer(state, { type: 'APPLY_HINT', hint: 'open-cell', now: T0 + 1000 });

    expect(next).not.toBe(state);
    expect(next.coins).toBe(state.coins - findShopItem('open-cell').price);
    expect(next.openedSafe).toBe(state.openedSafe + 1);
  });
});
