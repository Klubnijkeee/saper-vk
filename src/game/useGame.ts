/**
 * Стейт-машина игры.
 *
 * `gameReducer` — чистая функция: одинаковый вход → одинаковый выход.
 * Случайность берётся из `state.seed`, время — из `now` в действиях,
 * поэтому редьюсер полностью детерминирован (важно для React StrictMode и тестов).
 *
 * Хук `useGame` — единственное место, где живёт состояние: он владеет таймерами
 * (часы партии, подсветка подсказки), озвучивает события и сохраняет прогресс
 * через порт `ProgressPersistence` (VK Storage или localStorage — домену всё равно).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { playExplosion, playHint, playPuff, playReveal, playWin } from '../audio/sfx';
import { createEmptyBoard, normalizeLevel } from './board';
import { freezeClock, isClockRunning, resetClock, startClock, tickClock } from './clock';
import { buyLife, buyTheme, refreshMetaLives, rollDailyIfNeeded, setTheme, EMPTY_META } from './meta';
import { configForMode } from './modes';
import { isSameProgress, progressOf } from './progress';
import { createSeed } from './random';
import { openCell, toggleFlag } from './reveal';
import { shapeForLevel, shapeMask } from './shapes';
import { applyHint } from './shop';
import type {
  GameAction,
  GameOptions,
  GameState,
  MetaState,
  ModeId,
  ProgressPersistence,
  ShopItemId,
  StoredProgress,
  ThemeId,
} from './types';

export const DEFAULT_LEVEL = 1;
export const DEFAULT_MODE: ModeId = 'campaign';

/**
 * Как часто пересчитывать часы. Влияет только на своевременность перерисовки
 * цифр таймера, но не на точность: время считается от `startedAt`.
 */
export const TICK_INTERVAL_MS = 250;

/** Сколько горит подсветка подсказки «Показать мину». */
export const HINT_DURATION_MS = 2000;

/** Как часто пересчитывать регенерацию жизней. */
export const LIVES_TICK_MS = 30_000;

/** Исчерпывающая проверка: если добавить действие и забыть обработать — упадёт компиляция. */
function assertNever(value: never): never {
  throw new Error(`Необработанное действие: ${JSON.stringify(value)}`);
}

/** Мета-прогресс с подстановкой недостающих полей (после загрузки из хранилища). */
function mergeMeta(patch: Partial<MetaState> | undefined): MetaState {
  if (patch === undefined) return EMPTY_META;
  return { ...EMPTY_META, ...patch };
}

/** Новая партия. `seed` можно задать явно — для тестов и «повтора партии». */
export function createInitialState(options: GameOptions = {}): GameState {
  const mode = options.mode ?? DEFAULT_MODE;
  const base = mergeMeta(options.meta);
  // Уровень можно задать явно (перепрохождение с карты), иначе берём прогресс кампании.
  const level = normalizeLevel(
    options.level ?? (mode === DEFAULT_MODE ? base.campaignLevel : DEFAULT_LEVEL),
  );
  const config = configForMode(mode, level);
  const seed = (options.seed ?? createSeed()) >>> 0;
  /**
   * Поле уровня кампании — это силуэт фигуры: клетки стоят только там, где
   * нарисован `#`. Мины расставляются внутри фигуры после первого клика,
   * поэтому первый ход безопасен, а раскладка каждый раз новая.
   */
  const shape = mode === 'campaign' ? shapeForLevel(level) : null;
  const mask = shape === null ? null : shapeMask(shape);

  // Явно указанный уровень кампании — это и есть достигнутый прогресс:
  // держим мету согласованной, иначе сохранение откатило бы игрока назад.
  const meta: MetaState =
    mode === 'campaign' && level > base.campaignLevel
      ? { ...base, campaignLevel: level }
      : base;

  return {
    mode,
    level,
    config,
    board: createEmptyBoard(config, mask),
    status: 'idle',
    minesPlaced: false,
    openedSafe: 0,
    flags: 0,
    explodedIndex: null,
    seed,
    coins: Math.max(0, Math.floor(options.coins ?? 0)),
    bestTime: options.bestTime ?? null,
    clock: resetClock(),
    paused: false,
    minesRemoved: 0,
    hintedIndex: null,
    hintId: 0,
    moveId: 0,
    lastEvent: null,
    soundEnabled: options.soundEnabled ?? true,
    cellsOpened: 0,
    flagsPlaced: 0,
    hintsUsed: 0,
    meta,
  };
}

/** Новая партия с сохранением мета-прогресса (монеты, рекорд, звёзды, статистика). */
function carryOver(state: GameState, mode: ModeId, level: number): GameState {
  return createInitialState({
    mode,
    level,
    coins: state.coins,
    bestTime: state.bestTime,
    soundEnabled: state.soundEnabled,
    meta: state.meta,
  });
}

/** Редьюсер игры. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_MODE':
      return carryOver(state, action.mode, action.level ?? (action.mode === state.mode ? state.level : DEFAULT_LEVEL));
    case 'NEXT_LEVEL':
      return carryOver(state, state.mode, state.level + 1);
    case 'RESET':
      // Новое зерно → новое расположение мин, прогресс и мета сохраняются.
      return carryOver(state, state.mode, state.level);
    case 'REVEAL':
      return openCell(state, action.index, action.now);
    case 'TOGGLE_FLAG':
      return toggleFlag(state, action.index);
    case 'APPLY_HINT':
      return applyHint(state, action.hint, action.now);
    case 'CLEAR_HINT':
      return state.hintedIndex === null ? state : { ...state, hintedIndex: null };
    case 'TICK': {
      const clock = tickClock(state.clock, action.now);
      return clock === state.clock ? state : { ...state, clock };
    }
    case 'PAUSE': {
      if (state.paused) return state;
      // Пауза имеет смысл только в незавершённой партии.
      if (state.status === 'won' || state.status === 'lost') return state;
      // Подсветка подсказки на паузе гаснет: поле закрыто модалкой.
      return {
        ...state,
        paused: true,
        hintedIndex: null,
        clock: freezeClock(state.clock, action.now),
      };
    }
    case 'RESUME': {
      if (!state.paused) return state;
      // Часы возобновляем только в идущей партии: до первого клика они ещё не запущены.
      const clock = state.status === 'playing' ? startClock(state.clock, action.now) : state.clock;
      return { ...state, paused: false, clock };
    }
    case 'TOGGLE_SOUND':
      return { ...state, soundEnabled: !state.soundEnabled };
    case 'TOGGLE_VIBRATION':
      return {
        ...state,
        meta: { ...state.meta, vibrationEnabled: !state.meta.vibrationEnabled },
      };
    case 'TICK_LIVES': {
      const meta = refreshMetaLives(state.meta, action.now);
      return meta === state.meta ? state : { ...state, meta };
    }
    case 'BUY_LIFE': {
      const meta = buyLife(state.meta, action.now);
      return meta === state.meta ? state : { ...state, meta };
    }
    case 'MARK_TUTORIAL_SEEN':
      return state.meta.tutorialSeen ? state : { ...state, meta: { ...state.meta, tutorialSeen: true } };
    case 'SET_THEME': {
      const meta = setTheme(state.meta, action.theme);
      return meta === state.meta ? state : { ...state, meta };
    }
    case 'BUY_THEME': {
      const meta = buyTheme(state.meta, action.theme);
      return meta === state.meta ? state : { ...state, meta };
    }
    case 'HYDRATE': {
      const { progress } = action;
      const level = progress.level ?? state.level;
      const coins = progress.coins ?? state.coins;
      const bestTime = progress.bestTime === undefined ? state.bestTime : progress.bestTime;
      const soundEnabled = progress.soundEnabled ?? state.soundEnabled;

      const patch: MetaState = {
        stars: progress.stars ?? state.meta.stars,
        themeId: progress.themeId ?? state.meta.themeId,
        unlockedThemes: progress.unlockedThemes ?? state.meta.unlockedThemes,
        stats: progress.stats ?? state.meta.stats,
        achievements: progress.achievements ?? state.meta.achievements,
        campaignLevel: progress.level ?? state.meta.campaignLevel,
        levelStars: progress.levelStars ?? state.meta.levelStars,
        lives: progress.lives ?? state.meta.lives,
        livesAt: progress.livesAt ?? state.meta.livesAt,
        daily: progress.daily ?? state.meta.daily,
        vibrationEnabled: progress.vibrationEnabled ?? state.meta.vibrationEnabled,
        tutorialSeen: progress.tutorialSeen ?? state.meta.tutorialSeen,
      };

      // Если в хранилище ровно то же самое — не создаём новые объекты:
      // иначе повторный HYDRATE перерисовывал бы всё приложение зря.
      const metaEqualsState =
        patch.stars === state.meta.stars &&
        patch.themeId === state.meta.themeId &&
        patch.unlockedThemes === state.meta.unlockedThemes &&
        patch.stats === state.meta.stats &&
        patch.achievements === state.meta.achievements &&
        patch.campaignLevel === state.meta.campaignLevel &&
        patch.levelStars === state.meta.levelStars &&
        patch.lives === state.meta.lives &&
        patch.livesAt === state.meta.livesAt &&
        patch.daily === state.meta.daily &&
        patch.vibrationEnabled === state.meta.vibrationEnabled &&
        patch.tutorialSeen === state.meta.tutorialSeen;

      // Загруженные жизни сразу догоняем по времени: пока игра была закрыта,
      // часть могла восстановиться.
      const meta = metaEqualsState
        ? state.meta
        : refreshMetaLives(rollDailyIfNeeded(patch, action.now), action.now);
      // Уровень из хранилища применяем только к неначавшейся партии: посреди
      // игры подменять поле нельзя. «Ход игрока» считаем по открытым им клеткам —
      // стартовая зона уровня с фигурой ходом не является.
      const startsFresh = level !== state.level && state.status === 'idle' && state.cellsOpened === 0;
      const next: GameState = startsFresh
        ? createInitialState({ mode: state.mode, level, coins, bestTime, soundEnabled, meta })
        : { ...state, coins, bestTime, soundEnabled, meta };

      const unchanged =
        next.level === state.level &&
        next.coins === state.coins &&
        next.bestTime === state.bestTime &&
        next.soundEnabled === state.soundEnabled &&
        next.meta === state.meta;

      return unchanged ? state : next;
    }
    default:
      return assertNever(action);
  }
}

/** Публичный API игры для компонентов. */
export interface UseGameResult {
  readonly state: GameState;
  readonly reveal: (index: number) => void;
  readonly toggleFlagAt: (index: number) => void;
  readonly applyHintAt: (hint: ShopItemId) => void;
  readonly reset: () => void;
  /** Начать партию в режиме (для кампании — с указанного уровня). */
  readonly startMode: (mode: ModeId, level?: number) => void;
  readonly nextLevel: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly toggleSound: () => void;
  readonly toggleVibration: () => void;
  readonly markTutorialSeen: () => void;
  readonly setTheme: (theme: ThemeId) => void;
  readonly buyTheme: (theme: ThemeId) => void;
  /** Купить жизнь за звёзды. */
  readonly buyLife: () => void;
}

/**
 * Состояние игры + действия над ним.
 *
 * `persistence` — порт сохранения прогресса. Если он не передан (например, в тестах),
 * игра работает полностью в памяти.
 */
export function useGame(
  options: GameOptions = {},
  persistence: ProgressPersistence | null = null,
): UseGameResult {
  const [state, dispatch] = useReducer(gameReducer, options, createInitialState);

  const running = state.status === 'playing' && !state.paused && isClockRunning(state.clock);

  // Тикаем часами только пока партия идёт. На паузе и в модалке Game Over — тишина.
  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() });
    }, TICK_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [running]);

  // Подсветка подсказки «Показать мину» гаснет сама через 2 секунды.
  const hintId = state.hintId;
  useEffect(() => {
    if (hintId === 0) return undefined;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'CLEAR_HINT' });
    }, HINT_DURATION_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [hintId]);

  // Звук и вибрация события хода. Зависимость только от id события: переключение
  // настроек не должно переигрывать уже проигранный звук.
  const eventId = state.lastEvent?.id ?? 0;
  const eventKind = state.lastEvent?.kind ?? null;
  const soundEnabled = state.soundEnabled;
  const vibrationEnabled = state.meta.vibrationEnabled;
  useEffect(() => {
    if (eventKind === null) return;
    if (soundEnabled) {
      if (eventKind === 'reveal') playReveal();
      if (eventKind === 'explode') playExplosion();
      if (eventKind === 'hint') playHint();
      if (eventKind === 'mineRemoved') playPuff();
    }
    // Короткая вибрация на взрыве — если игрок её не выключил в настройках.
    if (eventKind === 'explode' && vibrationEnabled) {
      navigator.vibrate?.(40);
    }
  }, [eventId, eventKind, soundEnabled, vibrationEnabled]);

  // Победа — отдельное событие-переход, а не ход: звук фанфар.
  const previousStatus = useRef(state.status);
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = state.status;
    if (previous === state.status) return;
    if (state.status === 'won' && soundEnabled) playWin();
  }, [state.status, soundEnabled]);

  // Загрузка прогресса при старте.
  useEffect(() => {
    if (persistence === null) return undefined;
    let cancelled = false;
    void persistence
      .loadProgress()
      .then((loaded) => {
        if (!cancelled && loaded !== null) {
          dispatch({ type: 'HYDRATE', progress: loaded, now: Date.now() });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [persistence]);

  // Сохранение прогресса при любом изменении. Пишем только когда значения
  // реально изменились (тики часов прогресс не трогают).
  const savedProgress = useRef<StoredProgress | null>(null);
  useEffect(() => {
    if (persistence === null) return;
    const current = progressOf(state);
    const previous = savedProgress.current;
    savedProgress.current = current;
    if (previous === null || isSameProgress(previous, current)) return;
    void persistence.saveProgress(current).catch(() => undefined);
  }, [state, persistence]);

  const reveal = useCallback((index: number): void => {
    dispatch({ type: 'REVEAL', index, now: Date.now() });
  }, []);

  const toggleFlagAt = useCallback((index: number): void => {
    dispatch({ type: 'TOGGLE_FLAG', index });
  }, []);

  const applyHintAt = useCallback((hint: ShopItemId): void => {
    dispatch({ type: 'APPLY_HINT', hint, now: Date.now() });
  }, []);

  const reset = useCallback((): void => {
    dispatch({ type: 'RESET' });
  }, []);

  const startMode = useCallback((mode: ModeId, level?: number): void => {
    dispatch(level === undefined ? { type: 'START_MODE', mode } : { type: 'START_MODE', mode, level });
  }, []);

  const nextLevel = useCallback((): void => {
    dispatch({ type: 'NEXT_LEVEL' });
  }, []);

  const pause = useCallback((): void => {
    dispatch({ type: 'PAUSE', now: Date.now() });
  }, []);

  const resume = useCallback((): void => {
    dispatch({ type: 'RESUME', now: Date.now() });
  }, []);

  const toggleSound = useCallback((): void => {
    dispatch({ type: 'TOGGLE_SOUND' });
  }, []);

  const toggleVibration = useCallback((): void => {
    dispatch({ type: 'TOGGLE_VIBRATION' });
  }, []);

  const markTutorialSeen = useCallback((): void => {
    dispatch({ type: 'MARK_TUTORIAL_SEEN' });
  }, []);

  const setThemeById = useCallback((theme: ThemeId): void => {
    dispatch({ type: 'SET_THEME', theme });
  }, []);

  const buyThemeById = useCallback((theme: ThemeId): void => {
    dispatch({ type: 'BUY_THEME', theme });
  }, []);

  const buyLifeAction = useCallback((): void => {
    dispatch({ type: 'BUY_LIFE', now: Date.now() });
  }, []);

  /**
   * Жизни восстанавливаются по времени. Раз в полминуты просим редьюсер
   * пересчитать их: если ничего не накапало, он вернёт то же состояние,
   * и перерисовки с записью в хранилище не будет.
   */
  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch({ type: 'TICK_LIVES', now: Date.now() });
    }, LIVES_TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return useMemo(
    () => ({
      state,
      reveal,
      toggleFlagAt,
      applyHintAt,
      reset,
      startMode,
      nextLevel,
      pause,
      resume,
      toggleSound,
      toggleVibration,
      markTutorialSeen,
      setTheme: setThemeById,
      buyTheme: buyThemeById,
      buyLife: buyLifeAction,
    }),
    [
      state,
      reveal,
      toggleFlagAt,
      applyHintAt,
      reset,
      startMode,
      nextLevel,
      pause,
      resume,
      toggleSound,
      toggleVibration,
      markTutorialSeen,
      setThemeById,
      buyThemeById,
      buyLifeAction,
    ],
  );
}
