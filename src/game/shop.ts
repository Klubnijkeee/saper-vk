/**
 * Магазин подсказок: каталог, выбор цели и применение.
 *
 * Логика чистая: `applyHint` возвращает новое состояние, а если применять
 * нечего (партия не идёт, не хватает монет, нет подходящей клетки) — возвращает
 * **тот же** объект, и монеты не списываются.
 *
 * Цель подсказки выбирается детерминированно из `seed` и номера хода,
 * поэтому редьюсер остаётся чистой функцией, а тесты воспроизводимы.
 */

import { cellAt, indicesWhere, removeMine } from './board';
import { createRng, deriveSeed, pickOne } from './random';
import { openSingleCell } from './reveal';
import type { GameState, ShopItem, ShopItemId } from './types';

/** Каталог подсказок (порядок кнопок и цены — как в ТЗ). */
export const SHOP_ITEMS: readonly ShopItem[] = [
  {
    id: 'show-mine',
    label: 'Показать мину',
    price: 50,
    description: 'Подсветит одну мину на 2 секунды',
    appliedMessage: 'Мина подсвечена — 2 секунды',
    emptyMessage: 'На поле не осталось закрытых мин',
  },
  {
    id: 'open-cell',
    label: 'Открыть клетку',
    price: 30,
    description: 'Откроет одну случайную безопасную клетку',
    appliedMessage: 'Клетка открыта',
    emptyMessage: 'Нет закрытых безопасных клеток',
  },
  {
    id: 'remove-mine',
    label: 'Убрать мину',
    price: 100,
    description: 'Уберёт одну мину с поля и пересчитает цифры',
    appliedMessage: 'Мина убрана, цифры пересчитаны',
    emptyMessage: 'На поле не осталось мин',
  },
];

/** Товар по идентификатору. Бросает, если id неизвестен — это ошибка программиста. */
export function findShopItem(id: ShopItemId): ShopItem {
  const item = SHOP_ITEMS.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`Неизвестная подсказка: ${id}`);
  return item;
}

/** Хватает ли монет на подсказку. */
export function canAfford(coins: number, item: ShopItem): boolean {
  return coins >= item.price;
}

/**
 * Магазин работает только в идущей партии: до первого клика мин ещё нет,
 * а после победы или проигрыша подсказки бессмысленны.
 */
export function isShopAvailable(state: GameState): boolean {
  return state.status === 'playing' && !state.paused;
}

/** Клетки, подходящие под подсказку. */
export function hintTargets(state: GameState, id: ShopItemId): readonly number[] {
  const { board } = state;

  if (id === 'show-mine') {
    // Только закрытые мины: подсвечивать уже помеченную флажком нечего.
    return indicesWhere(board, (cell) => cell.hasMine && cell.state === 'hidden');
  }
  if (id === 'open-cell') {
    // Флажки не трогаем: игрок сам решил, что там мина.
    return indicesWhere(board, (cell) => !cell.hasMine && cell.state === 'hidden');
  }
  // «Убрать мину» — любая мина, даже помеченная флажком.
  return indicesWhere(board, (cell) => cell.hasMine);
}

/** Есть ли на поле цель для подсказки (если нет — показываем тост и не списываем монеты). */
export function hasHintTarget(state: GameState, id: ShopItemId): boolean {
  return hintTargets(state, id).length > 0;
}

/**
 * Применить подсказку.
 * Возвращает то же состояние, если применять нечего.
 */
export function applyHint(state: GameState, id: ShopItemId, now: number): GameState {
  if (!isShopAvailable(state)) return state;

  const item = findShopItem(id);
  if (!canAfford(state.coins, item)) return state;

  const targets = hintTargets(state, id);
  const target = pickOne(targets, createRng(deriveSeed(state.seed, state.moveId)));
  if (target === undefined) return state;

  // Платим только за реально применённую подсказку.
  const paid: GameState = {
    ...state,
    coins: state.coins - item.price,
    hintsUsed: state.hintsUsed + 1,
  };

  if (id === 'show-mine') return applyShowMine(paid, target);
  if (id === 'open-cell') return openSingleCell(paid, target, now);
  return applyRemoveMine(paid, target);
}

/**
 * Подсказка «Показать мину»: подсветить клетку с миной.
 * Клетка остаётся закрытой — ни открытия, ни флажка. Пульсация гаснет
 * через 2 секунды (таймер живёт в `useGame`), и подсветка ничего не блокирует:
 * тап по этой клетке — обычный ход (и взрыв, если это мина).
 */
function applyShowMine(state: GameState, index: number): GameState {
  const moveId = state.moveId + 1;
  return {
    ...state,
    moveId,
    hintedIndex: index,
    hintId: state.hintId + 1,
    lastEvent: { kind: 'hint', id: moveId, index },
  };
}

/**
 * Подсказка «Убрать мину»: мина исчезает, клетка становится безопасной,
 * цифры у всех соседей пересчитываются, счётчик мин уменьшается.
 */
function applyRemoveMine(state: GameState, index: number): GameState {
  const wasFlagged = cellAt(state.board, index).state === 'flagged';
  const moveId = state.moveId + 1;

  return {
    ...state,
    board: removeMine(state.board, state.config, index),
    minesRemoved: state.minesRemoved + 1,
    flags: wasFlagged ? state.flags - 1 : state.flags,
    moveId,
    lastEvent: { kind: 'mineRemoved', id: moveId, index },
  };
}
