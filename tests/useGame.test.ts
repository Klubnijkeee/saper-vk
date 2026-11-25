/**
 * Тесты стейт-машины: редьюсер, часы (старт/пауза/стоп), рекорд, чистые переходы.
 */

import { describe, expect, it } from 'vitest';
import { cellAt, countSafeCells, getLevelConfig, getMinesForLevel } from '../src/game/board';
import { PATTERN_LEVELS, patternForLevel, patternMineCount, patternStartCell } from '../src/game/patterns';
import { openCell, WIN_BONUS_COINS } from '../src/game/reveal';
import { applyHint } from '../src/game/shop';
import { createInitialState, gameReducer } from '../src/game/useGame';
import type { GameState } from '../src/game/types';
import { CLASSIC_LEVEL, classicState, winGame } from './helpers';

const T0 = 1_700_000_000_000;
const CENTER = 40;

/** Идущая партия с безопасным первым ходом (классический уровень, без фигуры). */
function playingState(seed = 42, bestTime: number | null = null): GameState {
  return openCell(classicState({ seed, bestTime }), CENTER, T0);
}

/** Первая закрытая безопасная клетка. */
function firstHiddenSafeIndex(state: GameState): number {
  const cell = state.board.find((item) => item.state === 'hidden' && !item.hasMine);
  if (cell === undefined) throw new Error('нет закрытой безопасной клетки');
  return cell.index;
}

describe('useGame: createInitialState', () => {
  it('уровень с фигурой: мины расставлены, стартовая зона открыта', () => {
    const state = createInitialState({ level: 1, seed: 42 });
    const pattern = patternForLevel(1);

    expect(pattern).not.toBeNull();
    if (pattern === null) return;

    expect(state.level).toBe(1);
    expect(state.minesPlaced).toBe(true);
    expect(state.status).toBe('idle');
    expect(state.clock).toEqual({ startedAt: null, elapsedMs: 0 });
    // Число мин берётся из фигуры, иначе победа была бы недостижимой.
    expect(state.config.mines).toBe(patternMineCount(pattern));
    expect(state.board.filter((cell) => cell.hasMine)).toHaveLength(patternMineCount(pattern));
    // Стартовая зона уже открыта, а вокруг неё нет мин.
    expect(state.openedSafe).toBeGreaterThan(0);
    const start = patternStartCell(pattern, state.config);
    expect(cellAt(state.board, start).state).toBe('revealed');
  });

  it('уровень без фигуры: поле пустое, статус idle', () => {
    const state = classicState({ seed: 42 });

    expect(state.level).toBe(CLASSIC_LEVEL);
    expect(state.level).toBeGreaterThan(PATTERN_LEVELS);
    expect(state.config).toEqual(getLevelConfig(CLASSIC_LEVEL));
    expect(state.board).toHaveLength(81);
    expect(state.status).toBe('idle');
    expect(state.minesPlaced).toBe(false);
    expect(state.openedSafe).toBe(0);
    expect(state.flags).toBe(0);
    expect(state.explodedIndex).toBeNull();
    expect(state.seed).toBe(42);
    expect(state.paused).toBe(false);
    expect(state.moveId).toBe(0);
    expect(state.lastEvent).toBeNull();
    expect(state.clock).toEqual({ startedAt: null, elapsedMs: 0 });
    expect(state.bestTime).toBeNull();
    expect(state.soundEnabled).toBe(true);
    expect(state.minesRemoved).toBe(0);
    expect(state.hintedIndex).toBeNull();
    expect(state.hintId).toBe(0);
  });

  it('нормализует уровень и монеты', () => {
    expect(createInitialState({ level: 0 }).level).toBe(1);
    expect(createInitialState({ level: -3 }).level).toBe(1);
    expect(createInitialState({ level: 4.8 }).level).toBe(4);
    expect(createInitialState({ level: 12 }).level).toBe(12);
    expect(createInitialState({ coins: -100 }).coins).toBe(0);
    expect(createInitialState({ coins: 12.7 }).coins).toBe(12);
  });

  it('без явного уровня кампания продолжается с сохранённого', () => {
    const state = createInitialState({ meta: { campaignLevel: 9 } });
    expect(state.level).toBe(9);
  });

  it('сложность растёт вместе с уровнем', () => {
    const mines = [1, 5, 6, 10, 11, 30].map((level) => getMinesForLevel(level));
    expect(mines).toEqual([10, 10, 12, 12, 15, 15]);
    expect(countSafeCells(getLevelConfig(11))).toBe(66);
  });

  it('у каждого уровня с фигурой число мин берётся из фигуры', () => {
    for (let level = 1; level <= PATTERN_LEVELS; level += 1) {
      const pattern = patternForLevel(level);
      expect(pattern).not.toBeNull();
      if (pattern === null) continue;
      expect(createInitialState({ level }).config.mines).toBe(patternMineCount(pattern));
    }
  });
});

describe('useGame: редьюсер', () => {
  it('REVEAL делает первый безопасный ход', () => {
    const state = classicState({ seed: 42 });
    const next = gameReducer(state, { type: 'REVEAL', index: CENTER, now: T0 });

    expect(next.status).toBe('playing');
    expect(next.minesPlaced).toBe(true);
    expect(cellAt(next.board, CENTER).state).toBe('revealed');
    expect(cellAt(next.board, CENTER).hasMine).toBe(false);
    expect(next.moveId).toBe(1);
  });

  it('на уровне с фигурой мины уже стоят, а стартовая зона открыта', () => {
    const state = createInitialState({ level: 1, seed: 42 });

    expect(state.minesPlaced).toBe(true);
    expect(state.openedSafe).toBeGreaterThan(0);
    // Ход по клетке внутри фигуры — это взрыв: безопасность даёт только стартовая зона.
    const mine = state.board.find((cell) => cell.hasMine && cell.state === 'hidden');
    expect(mine).toBeDefined();
    if (mine === undefined) return;

    const boom = gameReducer(state, { type: 'REVEAL', index: mine.index, now: T0 });
    expect(boom.status).toBe('lost');
  });

  it('TOGGLE_FLAG меняет счётчик флажков и увеличивает moveId', () => {
    const state = classicState({ seed: 42 });
    const flagged = gameReducer(state, { type: 'TOGGLE_FLAG', index: 5 });
    expect(flagged.flags).toBe(1);
    expect(flagged.flagsPlaced).toBe(1);
    expect(flagged.moveId).toBe(1);

    const unflagged = gameReducer(flagged, { type: 'TOGGLE_FLAG', index: 5 });
    expect(unflagged.flags).toBe(0);
    // Снятый флажок в счётчик поставленных не попадает.
    expect(unflagged.flagsPlaced).toBe(1);
    expect(unflagged.moveId).toBe(2);
  });

  it('RESET сохраняет уровень, монеты, рекорд и звук, но начинает партию заново', () => {
    const playing = gameReducer(classicState({ seed: 42, coins: 120, bestTime: 30_000 }), {
      type: 'REVEAL',
      index: CENTER,
      now: T0,
    });
    const reset = gameReducer(playing, { type: 'RESET' });

    expect(reset.level).toBe(CLASSIC_LEVEL);
    expect(reset.coins).toBe(playing.coins);
    expect(reset.bestTime).toBe(30_000);
    expect(reset.soundEnabled).toBe(true);
    expect(reset.status).toBe('idle');
    expect(reset.minesPlaced).toBe(false);
    expect(reset.openedSafe).toBe(0);
    expect(reset.explodedIndex).toBeNull();
    expect(reset.clock).toEqual({ startedAt: null, elapsedMs: 0 });
  });

  it('START_MODE переключает уровень и сложность', () => {
    const level7 = gameReducer(createInitialState({ level: 1, seed: 42 }), {
      type: 'START_MODE',
      mode: 'campaign',
      level: 7,
    });

    expect(level7.level).toBe(7);
    // У 7-го уровня своя фигура («Ракета», 15 мин) — число берётся из неё.
    expect(level7.config.mines).toBe(15);
    expect(level7.status).toBe('idle');
    expect(level7.flags).toBe(0);
  });

  it('NEXT_LEVEL повышает уровень и переносит прогресс', () => {
    const won = winGame(playingState(), T0 + 20_000);
    const next = gameReducer(won, { type: 'NEXT_LEVEL' });

    expect(won.status).toBe('won');
    expect(next.level).toBe(CLASSIC_LEVEL + 1);
    expect(next.coins).toBe(won.coins);
    expect(next.bestTime).toBe(won.bestTime);
    expect(next.status).toBe('idle');
    expect(next.board.every((cell) => !cell.hasMine)).toBe(true);
  });

  it('TOGGLE_SOUND переключает звук', () => {
    const state = createInitialState({ level: 1, seed: 1 });
    expect(state.soundEnabled).toBe(true);
    expect(gameReducer(state, { type: 'TOGGLE_SOUND' }).soundEnabled).toBe(false);
  });

  it('HYDRATE применяет прогресс из хранилища', () => {
    const state = createInitialState({ level: 1, seed: 42 });
    const hydrated = gameReducer(state, {
      type: 'HYDRATE',
      progress: { coins: 321, level: CLASSIC_LEVEL, bestTime: 42_000, soundEnabled: false },
      now: T0,
    });

    // Уровень из хранилища — стартовый: поле создаётся заново под него.
    expect(hydrated.level).toBe(CLASSIC_LEVEL);
    expect(hydrated.config.mines).toBe(15);
    expect(hydrated.coins).toBe(321);
    expect(hydrated.bestTime).toBe(42_000);
    expect(hydrated.soundEnabled).toBe(false);
    expect(hydrated.status).toBe('idle');
    expect(hydrated.minesPlaced).toBe(false);
    expect(hydrated.board.every((cell) => !cell.hasMine)).toBe(true);

    // Повторный HYDRATE с теми же значениями не пересоздаёт состояние.
    const again = gameReducer(hydrated, {
      type: 'HYDRATE',
      progress: { coins: 321, level: CLASSIC_LEVEL, bestTime: 42_000, soundEnabled: false },
      now: T0,
    });
    expect(again).toBe(hydrated);
  });

  it('HYDRATE не подменяет поле в идущей партии', () => {
    const playing = playingState();
    const hydrated = gameReducer(playing, {
      type: 'HYDRATE',
      progress: { coins: 999, level: 7 },
      now: T0,
    });

    expect(hydrated.level).toBe(playing.level);
    expect(hydrated.board).toBe(playing.board); // тот же массив клеток
    expect(hydrated.coins).toBe(999);
  });

  it('пауза гасит подсветку подсказки', () => {
    const hinted = applyHint({ ...playingState(), coins: 500 }, 'show-mine', T0 + 500);
    expect(hinted.hintedIndex).not.toBeNull();

    const paused = gameReducer(hinted, { type: 'PAUSE', now: T0 + 1000 });
    expect(paused.hintedIndex).toBeNull();
  });

  it('редьюсер чистый: одно и то же действие от одного состояния даёт одинаковый результат', () => {
    const state = createInitialState({ level: 1, seed: 42 });
    const freeze = JSON.stringify(state);

    const first = gameReducer(state, { type: 'REVEAL', index: CENTER, now: T0 });
    const second = gameReducer(state, { type: 'REVEAL', index: CENTER, now: T0 });

    // Случайность выводится из seed, время приходит в действии,
    // поэтому результат полностью повторяем (важно для React StrictMode).
    expect(second).toEqual(first);
    expect(JSON.stringify(state)).toBe(freeze);
  });

  it('некорректный индекс не ломает партию', () => {
    const state = createInitialState({ level: 1, seed: 42 });
    expect(gameReducer(state, { type: 'REVEAL', index: -1, now: T0 })).toBe(state);
    expect(gameReducer(state, { type: 'REVEAL', index: 81, now: T0 })).toBe(state);
    expect(gameReducer(state, { type: 'REVEAL', index: 3.5, now: T0 })).toBe(state);
    expect(gameReducer(state, { type: 'TOGGLE_FLAG', index: 999 })).toBe(state);
  });
});

describe('useGame: часы', () => {
  it('до первого хода часы стоят', () => {
    const state = createInitialState({ level: 1, seed: 42 });
    expect(state.clock.startedAt).toBeNull();
    // Тик по стоящим часам не двигает время и не создаёт новое состояние.
    expect(gameReducer(state, { type: 'TICK', now: T0 + 5000 })).toBe(state);
  });

  it('часы стартуют на первом открытии и идут', () => {
    const state = playingState();
    expect(state.clock.startedAt).toBe(T0);

    const ticked = gameReducer(state, { type: 'TICK', now: T0 + 2500 });
    expect(ticked.clock.elapsedMs).toBe(2500);

    const again = gameReducer(ticked, { type: 'TICK', now: T0 + 3000 });
    expect(again.clock.elapsedMs).toBe(3000);
  });

  it('пауза останавливает часы и блокирует ходы, продолжение — возобновляет', () => {
    let state = playingState();
    state = gameReducer(state, { type: 'TICK', now: T0 + 3000 });
    expect(state.clock.elapsedMs).toBe(3000);

    state = gameReducer(state, { type: 'PAUSE', now: T0 + 4000 });
    expect(state.paused).toBe(true);
    expect(state.clock.elapsedMs).toBe(4000);
    expect(state.clock.startedAt).toBeNull();

    // Пока пауза идёт — время стоит, даже если прошло 10 минут.
    expect(gameReducer(state, { type: 'TICK', now: T0 + 600_000 })).toBe(state);
    const paused = state;

    state = gameReducer(state, { type: 'RESUME', now: T0 + 600_000 });
    expect(state.paused).toBe(false);
    expect(state.clock.startedAt).toBe(T0 + 600_000);

    state = gameReducer(state, { type: 'TICK', now: T0 + 602_500 });
    // 4 с до паузы + 2.5 с после — время на паузе не засчитано.
    expect(state.clock.elapsedMs).toBe(6500);
    expect(paused.clock.elapsedMs).toBe(4000);
  });

  it('двойная пауза и повторное продолжение не сбивают время', () => {
    let state = gameReducer(playingState(), { type: 'PAUSE', now: T0 + 1000 });
    expect(gameReducer(state, { type: 'PAUSE', now: T0 + 2000 })).toBe(state);

    state = gameReducer(state, { type: 'RESUME', now: T0 + 5000 });
    expect(gameReducer(state, { type: 'RESUME', now: T0 + 9000 })).toBe(state);
    expect(state.clock.startedAt).toBe(T0 + 5000);
  });

  it('пауза не имеет смысла в завершённой партии', () => {
    const mine = playingState().board.find((cell) => cell.hasMine);
    if (mine === undefined) throw new Error('на поле нет мин');
    const lost = openCell(playingState(), mine.index, T0 + 1000);

    expect(gameReducer(lost, { type: 'PAUSE', now: T0 + 2000 })).toBe(lost);
  });

  it('после победы часы остановлены и дальше не идут', () => {
    const won = winGame(playingState(), T0 + 45_000);
    expect(won.status).toBe('won');
    expect(won.clock.startedAt).toBeNull();
    expect(won.clock.elapsedMs).toBe(45_000);
    expect(gameReducer(won, { type: 'TICK', now: T0 + 900_000 })).toBe(won);
  });

  it('после проигрыша часы остановлены', () => {
    const state = playingState();
    const mine = state.board.find((cell) => cell.hasMine);
    if (mine === undefined) throw new Error('на поле нет мин');

    const lost = openCell(state, mine.index, T0 + 12_000);
    expect(lost.clock.elapsedMs).toBe(12_000);
    expect(lost.clock.startedAt).toBeNull();
    expect(gameReducer(lost, { type: 'TICK', now: T0 + 900_000 })).toBe(lost);
  });
});

describe('useGame: рекорд и монеты', () => {
  it('первая победа становится рекордом', () => {
    const won = winGame(playingState(), T0 + 45_000);
    expect(won.bestTime).toBe(45_000);
    expect(won.coins).toBe(countSafeCells(won.config) + WIN_BONUS_COINS);
  });

  it('более медленная победа не портит рекорд', () => {
    const slower = winGame(playingState(99, 45_000), T0 + 90_000);
    expect(slower.bestTime).toBe(45_000);
  });

  it('более быстрая победа обновляет рекорд', () => {
    const faster = winGame(playingState(7, 45_000), T0 + 20_000);
    expect(faster.bestTime).toBe(20_000);
  });

  it('проигрыш не трогает рекорд', () => {
    const state = playingState(42, 45_000);
    const mine = state.board.find((cell) => cell.hasMine);
    if (mine === undefined) throw new Error('на поле нет мин');

    const lost = openCell(state, mine.index, T0 + 3000);
    expect(lost.bestTime).toBe(45_000);
  });

  it('до первого хода монеты остаются стартовыми', () => {
    const state = createInitialState({ level: 2, seed: 1, coins: 77 });
    expect(state.coins).toBe(77);
    expect(openCell(state, firstHiddenSafeIndex(state), T0).coins).toBeGreaterThan(77);
  });
});
