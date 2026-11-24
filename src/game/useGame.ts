/**
 * Стейт-машина игры.
 *
 * `gameReducer` — чистая функция: одинаковый вход → одинаковый выход.
 * Случайность берётся из `state.seed`, время — из `now` в действиях,
 * поэтому редьюсер полностью детерминирован (важно для React StrictMode и тестов).
 *
 * Хук `useGame` — единственное место, где живёт состояние: он владеет таймерами
 * (часы партии, подсветка подсказки), озвучивает события и сохраняет настройки
 * через порт `ProgressPersistence` (VK Storage или localStorage — домену всё равно).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { playExplosion, playHint, playPuff, playReveal, playWin } from '../audio/sfx';
import { createEmptyBoard, getLevelConfig, normalizeLevel } from './board';
import { freezeClock, isClockRunning, resetClock, startClock, tickClock } from './clock';
import { createSeed } from './random';
import { isSameProgress, progressOf } from './progress';
import { openCell, toggleFlag } from './reveal';
import { applyHint } from './shop';
import type {
  GameAction,
  GameOptions,
  GameState,
  ProgressPersistence,
  ShopItemId,
  StoredProgress,
} from './types';

export const DEFAULT_LEVEL = 1;

/**
 * Как часто пересчитывать часы. Влияет только на своевременность перерисовки
 * цифр таймера, но не на точность: время считается от `startedAt`.
 */
export const TICK_INTERVAL_MS = 250;

/** Сколько горит подсветка подсказки «Показать мину». */
export const HINT_DURATION_MS = 2000;

/** Исчерпывающая проверка: если добавить действие и забыть обработать — упадёт компиляция. */
function assertNever(value: never): never {
  throw new Error(`Необработанное действие: ${JSON.stringify(value)}`);
}

/** Новая партия. `seed` можно задать явно — для тестов и «повтора партии». */
export function createInitialState(options: GameOptions = {}): GameState {
  const level = normalizeLevel(options.level ?? DEFAULT_LEVEL);
  const config = getLevelConfig(level);

  return {
    level,
    config,
    board: createEmptyBoard(config),
    status: 'idle',
    minesPlaced: false,
    openedSafe: 0,
    flags: 0,
    explodedIndex: null,
    seed: (options.seed ?? createSeed()) >>> 0,
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
  };
}

/** Новая партия с сохранением мета-прогресса (монеты, рекорд, звук). */
function carryOver(state: GameState, level: number): GameState {
  return createInitialState({
    level,
    coins: state.coins,
    bestTime: state.bestTime,
    soundEnabled: state.soundEnabled,
  });
}

/** Редьюсер партии. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_LEVEL':
      return carryOver(state, action.level);
    case 'NEXT_LEVEL':
      return carryOver(state, state.level + 1);
    case 'RESET':
      // Новое зерно → новое расположение мин, уровень и прогресс сохраняются.
      return carryOver(state, state.level);
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
    case 'HYDRATE': {
      const { progress } = action;
      const level = progress.level ?? state.level;
      const coins = progress.coins ?? state.coins;
      const bestTime = progress.bestTime === undefined ? state.bestTime : progress.bestTime;
      const soundEnabled = progress.soundEnabled ?? state.soundEnabled;

      // Уровень из хранилища применяем только к неначавшейся партии:
      // посреди игры подменять поле нельзя. Новая партия — новый seed.
      const startsFresh = level !== state.level && state.status === 'idle' && state.moveId === 0;
      const next: GameState = startsFresh
        ? createInitialState({ level, coins, bestTime, soundEnabled })
        : { ...state, coins, bestTime, soundEnabled };

      const unchanged =
        next.level === state.level &&
        next.coins === state.coins &&
        next.bestTime === state.bestTime &&
        next.soundEnabled === state.soundEnabled;

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
  readonly startLevel: (level: number) => void;
  readonly nextLevel: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly toggleSound: () => void;
}

/**
 * Состояние партии + действия над ним.
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
  // Зависимость — id подсказки, а не индекс клетки: повторная подсказка
  // на ту же клетку должна перезапустить отсчёт.
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

  // Звук события хода. Зависимость только от id события: переключение звука
  // не должно переигрывать уже проигранный звук (значения берём из актуального рендера).
  const eventId = state.lastEvent?.id ?? 0;
  const eventKind = state.lastEvent?.kind ?? null;
  const soundEnabled = state.soundEnabled;
  useEffect(() => {
    if (eventKind === null || !soundEnabled) return;
    if (eventKind === 'reveal') playReveal();
    if (eventKind === 'explode') playExplosion();
    if (eventKind === 'hint') playHint();
    if (eventKind === 'mineRemoved') playPuff();
  }, [eventId, eventKind, soundEnabled]);

  // Победа — отдельное событие-переход, а не ход: звук фанфар.
  const previousStatus = useRef(state.status);
  useEffect(() => {
    const previous = previousStatus.current;
    previousStatus.current = state.status;
    if (previous === state.status) return;
    if (state.status === 'won' && soundEnabled) playWin();
  }, [state.status, soundEnabled]);

  // Загрузка прогресса при старте: монеты, уровень, рекорд, звук.
  useEffect(() => {
    if (persistence === null) return undefined;
    let cancelled = false;
    void persistence
      .loadProgress()
      .then((loaded) => {
        if (!cancelled && loaded !== null) dispatch({ type: 'HYDRATE', progress: loaded });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [persistence]);

  // Сохранение прогресса при любом изменении: открыл клетку, потратил монеты,
  // победил, переключил звук. Не ждём конца уровня — игрок может закрыть ВК.
  // Пишем только когда значения реально изменились (тики часов прогресс не трогают).
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

  const startLevel = useCallback((level: number): void => {
    dispatch({ type: 'START_LEVEL', level });
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

  return useMemo(
    () => ({
      state,
      reveal,
      toggleFlagAt,
      applyHintAt,
      reset,
      startLevel,
      nextLevel,
      pause,
      resume,
      toggleSound,
    }),
    [
      state,
      reveal,
      toggleFlagAt,
      applyHintAt,
      reset,
      startLevel,
      nextLevel,
      pause,
      resume,
      toggleSound,
    ],
  );
}
