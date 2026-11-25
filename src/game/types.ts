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

/** Конфигурация поля: размеры и количество мин. */
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

// ── Режимы и оформление ─────────────────────────────────────────────────────

/**
 * Режим игры.
 * `campaign` — прохождение по уровням (сложность растёт), остальные —
 * свободная игра с фиксированным полем и своими рекордами.
 */
export type ModeId = 'campaign' | 'novice' | 'amateur' | 'professional' | 'special';

/** Режим свободной игры: размеры поля и число мин. */
export interface ModePreset {
  readonly id: ModeId;
  readonly title: string;
  readonly subtitle: string;
  /** Ключ иконки из components/icons.tsx. */
  readonly icon: ModeIconId;
}

/** Идентификаторы иконок режимов. */
export type ModeIconId = 'map' | 'star' | 'grid' | 'crown' | 'spark';

/** Идентификатор оформления поля. */
export type ThemeId =
  | 'classic'
  | 'neon'
  | 'aurora'
  | 'sunset'
  | 'ocean'
  | 'frost'
  | 'paper'
  | 'violet';

/** Тема оформления: описание для витрины (сами цвета — в styles.css). */
export interface ThemePreset {
  readonly id: ThemeId;
  readonly title: string;
  readonly subtitle: string;
  /** Цена в звёздах; 0 — тема доступна с самого начала. */
  readonly price: number;
  /** Три цвета для превью-плитки в списке тем. */
  readonly swatch: readonly [string, string, string];
}

// ── Мета-прогресс ───────────────────────────────────────────────────────────

/** Результаты по конкретному режиму. */
export interface ModeStats {
  readonly played: number;
  readonly wins: number;
  /** Лучшее время победы, мс. */
  readonly bestTimeMs: number | null;
}

/** Общая статистика игрока. */
export interface Stats {
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  /** Текущая серия побед подряд. */
  readonly currentStreak: number;
  /** Лучшая серия побед. */
  readonly bestStreak: number;
  readonly cellsOpened: number;
  readonly flagsPlaced: number;
  readonly hintsUsed: number;
  /** Победы без единой подсказки. */
  readonly cleanWins: number;
  /** Победы быстрее минуты. */
  readonly fastWins: number;
  /** Суммарное время партий, мс. */
  readonly playTimeMs: number;
  readonly byMode: Readonly<Record<ModeId, ModeStats>>;
}

/** Счётчики «за сегодня» — из них считаются задачи дня. */
export interface DailyCounters {
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly cellsOpened: number;
  readonly flagsPlaced: number;
  readonly hintsUsed: number;
  /** Победы без подсказок. */
  readonly cleanWins: number;
  /** Победы быстрее минуты. */
  readonly fastWins: number;
}

/** Состояние задач дня: к какой дате относятся счётчики и что уже награждено. */
export interface DailyState {
  /** Дата в формате YYYY-MM-DD. */
  readonly date: string;
  readonly counters: DailyCounters;
  /** id задач, за которые звёзды уже начислены. */
  readonly claimed: readonly string[];
}

/** Мета-прогресс: всё, что живёт между партиями. */
export interface MetaState {
  /** Звёзды — премиальная валюта: достижения, задачи дня, покупка тем. */
  readonly stars: number;
  readonly themeId: ThemeId;
  readonly unlockedThemes: readonly ThemeId[];
  readonly stats: Stats;
  /** id открытых достижений. */
  readonly achievements: readonly string[];
  /**
   * Докуда дошёл игрок в кампании: следующий уровень для прохождения.
   * Хранится отдельно от «уровня текущей партии», иначе перепройти старый
   * уровень означало бы откатить прогресс назад.
   */
  readonly campaignLevel: number;
  /** Оценка уровней кампании: номер уровня → 1..3 звезды. */
  readonly levelStars: Readonly<Record<string, number>>;
  /** Жизни кампании: попытки, которые восстанавливаются со временем. */
  readonly lives: number;
  /** Момент, от которого считается регенерация жизней. */
  readonly livesAt: number;
  readonly daily: DailyState;
  readonly vibrationEnabled: boolean;
  /** Показан ли обучающий экран. */
  readonly tutorialSeen: boolean;
}

/** Экран приложения. Навигация своя: react-router здесь не нужен. */
export type ScreenId =
  | 'home'
  | 'game'
  | 'map'
  | 'collection'
  | 'stats'
  | 'achievements'
  | 'themes'
  | 'records'
  | 'settings'
  | 'social'
  | 'howto';

/**
 * Полное состояние партии и мета-прогресса — единственный источник правды для UI.
 */
export interface GameState {
  readonly mode: ModeId;
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
   * «случайные» решения (расстановка мин, выбор клетки магазином).
   * Благодаря этому редьюсер остаётся чистой функцией.
   */
  readonly seed: number;
  /** Монеты — зарабатываются за открытые клетки и победы, тратятся в магазине. */
  readonly coins: number;
  /** Лучшее время прохождения кампании, мс, или `null`. */
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
  /** Счётчики текущей партии — уезжают в статистику на её исходе. */
  readonly cellsOpened: number;
  readonly flagsPlaced: number;
  readonly hintsUsed: number;
  readonly meta: MetaState;
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
  readonly mode?: ModeId;
  readonly level?: number;
  readonly seed?: number;
  readonly coins?: number;
  readonly bestTime?: number | null;
  readonly soundEnabled?: boolean;
  readonly meta?: Partial<MetaState>;
}

/**
 * Прогресс, который переживает перезагрузку страницы.
 * Каждое поле лежит в VK Storage под своим ключом; сложные — строкой JSON.
 * Отсутствующий ключ означает «первый запуск» и заменяется дефолтом.
 */
export interface StoredProgress {
  readonly coins: number;
  /** Уровень кампании, с которого начинать следующую сессию. */
  readonly level: number;
  /** Лучшее время кампании, мс, или `null`. */
  readonly bestTime: number | null;
  readonly soundEnabled: boolean;
  readonly stars: number;
  readonly themeId: ThemeId;
  readonly unlockedThemes: readonly ThemeId[];
  readonly stats: Stats;
  readonly achievements: readonly string[];
  readonly levelStars: Readonly<Record<string, number>>;
  readonly lives: number;
  readonly livesAt: number;
  readonly daily: DailyState;
  readonly vibrationEnabled: boolean;
  readonly tutorialSeen: boolean;
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
  /** Начать партию в режиме (для кампании — с указанного уровня). */
  | { readonly type: 'START_MODE'; readonly mode: ModeId; readonly level?: number }
  | { readonly type: 'NEXT_LEVEL' }
  | { readonly type: 'REVEAL'; readonly index: number; readonly now: number }
  | { readonly type: 'TOGGLE_FLAG'; readonly index: number }
  | { readonly type: 'APPLY_HINT'; readonly hint: ShopItemId; readonly now: number }
  | { readonly type: 'CLEAR_HINT' }
  | { readonly type: 'TICK'; readonly now: number }
  | { readonly type: 'PAUSE'; readonly now: number }
  | { readonly type: 'RESUME'; readonly now: number }
  | { readonly type: 'TOGGLE_SOUND' }
  | { readonly type: 'TOGGLE_VIBRATION' }
  | { readonly type: 'MARK_TUTORIAL_SEEN' }
  | { readonly type: 'SET_THEME'; readonly theme: ThemeId }
  | { readonly type: 'BUY_THEME'; readonly theme: ThemeId }
  /** Пересчитать жизни по времени (регенерация). */
  | { readonly type: 'TICK_LIVES'; readonly now: number }
  /** Купить жизнь за звёзды. */
  | { readonly type: 'BUY_LIFE'; readonly now: number }
  /** Применить прогресс, загруженный из хранилища (`now` — для смены дня). */
  | { readonly type: 'HYDRATE'; readonly progress: Partial<StoredProgress>; readonly now: number }
  | { readonly type: 'RESET' };
