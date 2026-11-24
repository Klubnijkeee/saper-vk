/**
 * Тесты сохранения прогресса: что записываем, как разбираем обратно
 * и что делаем с мусором в хранилище.
 */

import { describe, expect, it } from 'vitest';
import { cellAt } from '../src/game/board';
import {
  DEFAULT_PROGRESS,
  isSameProgress,
  PROGRESS_KEYS,
  progressFromRaw,
  progressOf,
  progressToRaw,
} from '../src/game/progress';
import { openCell } from '../src/game/reveal';
import { createInitialState } from '../src/game/useGame';
import type { GameState, StoredProgress } from '../src/game/types';

const SEED = 42;
const CENTER = 40;
const T0 = 1_700_000_000_000;

/** Идущая партия на 3-м уровне с запасом монет. */
function playingState(): GameState {
  return openCell(createInitialState({ level: 3, seed: SEED, coins: 120 }), CENTER, T0);
}

/** Довести партию до победы. */
function winGame(state: GameState, now: number): GameState {
  let current = state;
  for (const cell of current.board) {
    if (current.status === 'won') break;
    if (cell.hasMine) continue;
    current = openCell(current, cell.index, now);
  }
  return current;
}

describe('progress: что сохраняем', () => {
  it('до победы — текущий уровень, монеты и звук', () => {
    const state = playingState();
    const progress = progressOf(state);

    expect(progress.level).toBe(3);
    expect(progress.coins).toBe(state.coins);
    expect(progress.bestTime).toBeNull();
    expect(progress.soundEnabled).toBe(true);
  });

  it('после победы сохраняем уже следующий уровень', () => {
    const won = winGame(playingState(), T0 + 30_000);

    expect(won.status).toBe('won');
    expect(won.level).toBe(3);
    // Выиграл 3-й уровень — при следующем запуске начинаем с 4-го.
    expect(progressOf(won).level).toBe(4);
    expect(progressOf(won).bestTime).toBe(30_000);
  });

  it('монеты растут по ходу партии и попадают в прогресс', () => {
    const start = createInitialState({ level: 3, seed: SEED, coins: 120 });
    const after = openCell(start, CENTER, T0);

    expect(progressOf(start).coins).toBe(120);
    expect(progressOf(after).coins).toBe(after.coins);
    expect(progressOf(after).coins).toBeGreaterThan(120);
  });
});

describe('progress: сериализация', () => {
  it('прогресс переживает запись и чтение', () => {
    const progress: StoredProgress = {
      coins: 321,
      level: 7,
      bestTime: 42_500,
      soundEnabled: false,
    };

    const raw = progressToRaw(progress);
    const restored = progressFromRaw(new Map(Object.entries(raw)));

    expect(restored).toEqual(progress);
  });

  it('отсутствующий рекорд сохраняется пустой строкой', () => {
    const raw = progressToRaw({ ...DEFAULT_PROGRESS, bestTime: null });
    expect(raw[PROGRESS_KEYS.bestTime]).toBe('');

    const restored = progressFromRaw(new Map(Object.entries(raw)));
    expect(restored.bestTime).toBeNull();
  });

  it('ключи соответствуют ТЗ', () => {
    expect(PROGRESS_KEYS).toEqual({
      coins: 'coins',
      level: 'level',
      bestTime: 'bestTime',
      soundEnabled: 'soundEnabled',
    });
  });
});

describe('progress: разбор того, что вернуло хранилище', () => {
  it('пустое хранилище — значения по умолчанию', () => {
    expect(progressFromRaw(new Map())).toEqual(DEFAULT_PROGRESS);
  });

  it('мусор в значениях заменяется значениями по умолчанию', () => {
    const values = new Map<string, string>([
      [PROGRESS_KEYS.coins, 'abc'],
      [PROGRESS_KEYS.level, '-5'],
      [PROGRESS_KEYS.bestTime, 'NaN'],
      [PROGRESS_KEYS.soundEnabled, 'yes'],
    ]);

    expect(progressFromRaw(values)).toEqual(DEFAULT_PROGRESS);
  });

  it('отрицательные монеты и дробный уровень приводятся к разумным', () => {
    const values = new Map<string, string>([
      [PROGRESS_KEYS.coins, '-100'],
      [PROGRESS_KEYS.level, '3.7'],
      [PROGRESS_KEYS.bestTime, '0'],
    ]);

    const parsed = progressFromRaw(values);
    expect(parsed.coins).toBe(0);
    expect(parsed.level).toBe(3);
    expect(parsed.bestTime).toBeNull();
  });

  it('звук читается только как true/false', () => {
    const on = new Map<string, string>([[PROGRESS_KEYS.soundEnabled, 'true']]);
    const off = new Map<string, string>([[PROGRESS_KEYS.soundEnabled, 'false']]);
    const broken = new Map<string, string>([[PROGRESS_KEYS.soundEnabled, '1']]);

    expect(progressFromRaw(on).soundEnabled).toBe(true);
    expect(progressFromRaw(off).soundEnabled).toBe(false);
    expect(progressFromRaw(broken).soundEnabled).toBe(DEFAULT_PROGRESS.soundEnabled);
  });
});

describe('progress: сравнение', () => {
  it('одинаковый прогресс не считается изменением', () => {
    const base = { ...DEFAULT_PROGRESS };

    expect(isSameProgress(base, { ...base })).toBe(true);
    expect(isSameProgress(base, { ...base, coins: 1 })).toBe(false);
    expect(isSameProgress(base, { ...base, level: 2 })).toBe(false);
    expect(isSameProgress(base, { ...base, bestTime: 1000 })).toBe(false);
    expect(isSameProgress(base, { ...base, soundEnabled: false })).toBe(false);
  });

  it('состояние после победы отличается от состояния до неё (уровень вырос)', () => {
    const played = playingState();
    const won = winGame(played, T0 + 30_000);

    expect(isSameProgress(progressOf(played), progressOf(won))).toBe(false);
  });
});

describe('progress: связка с ходами', () => {
  it('монеты в прогрессе меняются вместе с открытыми клетками', () => {
    const state = playingState();
    const revealed = state.board.filter((cell) => cell.state === 'revealed').length;

    expect(cellAt(state.board, CENTER).state).toBe('revealed');
    expect(progressOf(state).coins).toBe(120 + revealed);
  });
});
