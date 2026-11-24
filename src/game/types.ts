/**
 * Базовые типы игры «Сапёр: Магазин».
 *
 * Здесь только типы — ни логики, ни сайд-эффектов.
 * Все объекты описываются как `readonly`: состояние игры обновляется
 * исключительно иммутабельно (новый объект вместо мутации).
 */

/** Координаты клетки на поле (0-based). */
export interface Coord {
  readonly row: number;
  readonly col: number;
}

/**
 * Состояние клетки:
 * - `hidden`   — закрыта;
 * - `revealed` — открыта (пусто, цифра или мина после проигрыша);
 * - `flagged`  — закрыта и помечена флажком.
 */
export type CellState = 'hidden' | 'revealed' | 'flagged';

/**
 * Клетка поля.
 *
 * `hasMine` и `adjacentMines` валидны только после расстановки мин:
 * она происходит на первом открытии (см. {@link GameState.minesPlaced}),
 * поэтому первый клик всегда безопасен by design.
 */
export interface Cell {
  /** Индекс в плоском массиве поля: `row * cols + col`. */
  readonly index: number;
  readonly row: number;
  readonly col: number;
  readonly hasMine: boolean;
  /** Сколько мин среди 8 соседних клеток (0..8). */
  readonly adjacentMines: number;
  readonly state: CellState;
  /** `true` только у клетки, на которой произошёл взрыв. */
  readonly exploded: boolean;
}

/** Поле — плоский неизменяемый массив клеток длиной `rows * cols`. */
export type Board = readonly Cell[];

/** Мина как отдельная сущность (магазин подсказок, раскрытие поля после проигрыша). */
export interface Mine {
  readonly index: number;
  readonly row: number;
  readonly col: number;
}

/**
 * Статус партии.
 * `idle` — до первого открытия: мины ещё не расставлены, поле «пустое».
 */
export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

/** Конфигурация уровня: размер поля и количество мин. */
export interface LevelConfig {
  readonly rows: number;
  readonly cols: number;
  readonly mines: number;
}

/**
 * Часы партии.
 *
 * Время хранится как «момент старта текущего отрезка + накопленное ранее»,
 * поэтому пауза не зависит от того, как часто дергается таймер, и рекорд
 * не зависит от дрейфа интервалов. `startedAt === null` — часы стоят.
 */
export interface Clock {
  /** `Date.now()` начала текущего отрезка или `null`, если часы стоят. */
  readonly startedAt: number | null;
  /** Накопленное время по завершённым отрезкам, мс. */
  readonly elapsedMs: number;
}

/** Клетка, открытая последним ходом, и её «волна» — расстояние от точки клика. */
export interface WaveCell {
  readonly index: number;
  /** Графовое расстояние (в клетках) от клетки, по которой кликнули. */
  readonly ring: number;
}

/**
 * Последнее значимое событие партии.
 *
 * Нужно только для презентации: по нему UI включает нужную анимацию,
 * а хук — звук. Домен от этого не зависит, логика ходов его не читает.
 * `id` монотонно растёт: он используется как React-ключ, чтобы анимация
 * гарантированно переигрывалась на новом событии.
 */
export type LastEvent =
  | {
      readonly kind: 'reveal';
      readonly id: number;
      /** Клетка, по которой кликнули (источник волны). */
      readonly origin: number;
      readonly cells: readonly WaveCell[];
    }
  | { readonly kind: 'flag'; readonly id: number; readonly index: number; readonly flagged: boolean }
  | { readonly kind: 'explode'; readonly id: number; readonly index: number }
  /** Подсказка «Показать мину»: клетка подсвечивается, но остаётся закрытой. */
  | { readonly kind: 'hint'; readonly id: number; readonly index: number }
  /** Подсказка «Убрать мину»: мина исчезла с белым дымком. */
  | { readonly kind: 'mineRemoved'; readonly id: number; readonly index: number };

/**
 * Полное состояние партии и мета-прогресса — единственный источник правды для UI.
 * Коины, уровень и рекорд лежат здесь же, чтобы не было двух источников истины;
 * на Шаг 4 наружу сохраняется подмножество (см. `src/vk/storage.ts`).
 */
export interface GameState {
  readonly level: number;
  readonly config: LevelConfig;
  readonly board: Board;
  readonly status: GameStatus;
  /** Мины расставлены? До первого открытия — `false`. */
  readonly minesPlaced: boolean;
  /** Сколько безопасных клеток уже открыто (используется в условии победы). */
  readonly openedSafe: number;
  /** Сколько флажков стоит на поле. */
  readonly flags: number;
  /** Индекс клетки, на которой рвануло (для красной подсветки). */
  readonly explodedIndex: number | null;
  /**
   * Зерно случайности партии. Из него детерминированно выводятся все
   * «случайные» решения (расстановка мин, позже — выбор клетки магазином).
   * Благодаря этому редьюсер остаётся чистой функцией.
   */
  readonly seed: number;
  /** Монеты — зарабатываются за открытые клетки и победы, тратятся в магазине. */
  readonly coins: number;
  /** Лучшее время прохождения, мс (общее по всем уровням), или `null`. */
  readonly bestTime: number | null;
  readonly clock: Clock;
  /** Партия на паузе: часы стоят, поле не принимает ходы. */
  readonly paused: boolean;
  /**
   * Сколько мин убрано подсказкой «Убрать мину».
   * Текущее число мин на поле: `config.mines - minesRemoved`,
   * безопасных клеток: `countSafeCells(config, minesRemoved)`.
   */
  readonly minesRemoved: number;
  /** Клетка, подсвеченная подсказкой «Показать мину» (гаснет через 2 с). */
  readonly hintedIndex: number | null;
  /**
   * Номер подсказки «Показать мину». Нужен как ключ таймера: повторная подсказка
   * на ту же клетку должна перезапустить отсчёт 2 секунд.
   */
  readonly hintId: number;
  /** Монотонный счётчик ходов — id для событий и React-ключей анимаций. */
  readonly moveId: number;
  readonly lastEvent: LastEvent | null;
  readonly soundEnabled: boolean;
}

/** Источник случайности: детерминированный в тестах, `Math.random`-based в игре. */
export type Rng = () => number;

/** Идентификаторы подсказок магазина. */
export type ShopItemId = 'show-mine' | 'open-cell' | 'remove-mine';

/** Товар магазина: что покупаем и за сколько. */
export interface ShopItem {
  readonly id: ShopItemId;
  readonly label: string;
  readonly price: number;
  /** Пояснение для игрока (тултип/подпись). */
  readonly description: string;
  /** Тост при успешном применении. */
  readonly appliedMessage: string;
  /** Тост, когда применять нечего. */
  readonly emptyMessage: string;
}

/** Параметры новой партии. */
export interface GameOptions {
  readonly level?: number;
  readonly seed?: number;
  readonly coins?: number;
  readonly bestTime?: number | null;
  readonly soundEnabled?: boolean;
}

/**
 * Прогресс, который переживает перезагрузку страницы.
 * Ровно эти четыре значения лежат в VK Storage (по ТЗ).
 */
export interface StoredProgress {
  readonly coins: number;
  /** Уровень, с которого начинать следующую сессию. */
  readonly level: number;
  /** Лучшее время прохождения, мс, или `null`, если рекорда ещё нет. */
  readonly bestTime: number | null;
  readonly soundEnabled: boolean;
}

/**
 * Порт сохранения прогресса.
 *
 * Домен не знает, куда именно пишутся данные: в VKWebAppStorage внутри
 * ВКонтакте или в localStorage в обычном браузере. Хук принимает готовый порт,
 * поэтому игровая логика не зависит от платформы и легко тестируется.
 */
export interface ProgressPersistence {
  /** Загрузить прогресс. `null` — в хранилище пусто (первый запуск). */
  readonly loadProgress: () => Promise<Partial<StoredProgress> | null>;
  readonly saveProgress: (progress: StoredProgress) => Promise<void>;
}

/** Действия стейт-машины игры. */
export type GameAction =
  | { readonly type: 'START_LEVEL'; readonly level: number }
  | { readonly type: 'NEXT_LEVEL' }
  | { readonly type: 'REVEAL'; readonly index: number; readonly now: number }
  | { readonly type: 'TOGGLE_FLAG'; readonly index: number }
  | { readonly type: 'APPLY_HINT'; readonly hint: ShopItemId; readonly now: number }
  | { readonly type: 'CLEAR_HINT' }
  | { readonly type: 'TICK'; readonly now: number }
  | { readonly type: 'PAUSE'; readonly now: number }
  | { readonly type: 'RESUME'; readonly now: number }
  | { readonly type: 'TOGGLE_SOUND' }
  /** Применить прогресс, загруженный из хранилища. */
  | { readonly type: 'HYDRATE'; readonly progress: Partial<StoredProgress> }
  | { readonly type: 'RESET' };
