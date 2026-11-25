/**
 * Тесты мета-прогресса: что происходит на исходе партии, покупка тем,
 * смена дня и связка с редьюсером (победа обновляет статистику и звёзды).
 */

import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { dateKey } from '../src/game/daily';
import { EMPTY_META, applyMatchEnd, buyTheme, rollDailyIfNeeded, setTheme } from '../src/game/meta';
import { openCell } from '../src/game/reveal';
import { bestTimeFor } from '../src/game/stats';
import { DEFAULT_THEME, findTheme } from '../src/game/themes';
import { createInitialState, gameReducer } from '../src/game/useGame';
import type { GameState, MetaState } from '../src/game/types';

const T0 = 1_700_000_000_000;
const CENTER = 40;

/** Идущая партия с безопасным первым ходом. */
function playingState(seed = 42): GameState {
  return openCell(createInitialState({ level: 1, seed }), CENTER, T0);
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

/** Итог партии по умолчанию. */
function end(overrides: Partial<Parameters<typeof applyMatchEnd>[1]> = {}) {
  return {
    mode: 'campaign' as const,
    won: true,
    timeMs: 30_000,
    cellsOpened: 71,
    flagsPlaced: 5,
    hintsUsed: 0,
    level: 1,
    now: T0,
    ...overrides,
  };
}

describe('meta: исход партии', () => {
  it('победа попадает в статистику и счётчики дня', () => {
    const meta = applyMatchEnd(EMPTY_META, end());

    expect(meta.stats.gamesPlayed).toBe(1);
    expect(meta.stats.wins).toBe(1);
    expect(meta.daily.date).toBe(dateKey(T0));
    expect(meta.daily.counters.cellsOpened).toBe(71);
  });

  it('достижения открываются и приносят звёзды', () => {
    const meta = applyMatchEnd(EMPTY_META, end());
    const expected = ACHIEVEMENTS.filter((item) => meta.achievements.includes(item.id));

    expect(meta.achievements).toContain('first-game');
    expect(meta.achievements).toContain('first-win');
    expect(meta.stars).toBeGreaterThanOrEqual(
      expected.reduce((sum, item) => sum + item.stars, 0),
    );
  });

  it('новый день обнуляет счётчики задач', () => {
    const first = applyMatchEnd(EMPTY_META, end());
    const tomorrow = new Date(T0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const second = applyMatchEnd(first, end({ now: tomorrow.getTime() }));

    expect(second.daily.date).toBe(dateKey(tomorrow.getTime()));
    expect(second.daily.counters.gamesPlayed).toBe(1);
    expect(second.stats.gamesPlayed).toBe(2);
  });

  it('повторный вызов не выдаёт одни и те же достижения дважды', () => {
    const first = applyMatchEnd(EMPTY_META, end());
    const second = applyMatchEnd(first, end());

    expect(second.achievements).toEqual(first.achievements);
    expect(second.stars).toBe(first.stars);
  });

  it('задача дня награждается автоматически и только один раз', () => {
    // «Выиграть партию» есть в пуле, поэтому победа закрывает её в любой день.
    const first = applyMatchEnd(EMPTY_META, end());
    const claimedOnce = first.daily.claimed.length;

    const second = applyMatchEnd(first, end());
    expect(second.daily.claimed.length).toBe(claimedOnce);
  });

  it('rollDailyIfNeeded не трогает состояние в тот же день', () => {
    const meta = applyMatchEnd(EMPTY_META, end());
    expect(rollDailyIfNeeded(meta, T0)).toBe(meta);
  });
});

describe('meta: темы', () => {
  it('покупка списывает звёзды и включает тему', () => {
    const rich = applyMatchEnd(EMPTY_META, end());
    const theme = findTheme('sunset');
    const withStars: MetaState = { ...rich, stars: theme.price };

    const bought = buyTheme(withStars, 'sunset');

    expect(bought.stars).toBe(0);
    expect(bought.themeId).toBe('sunset');
    expect(bought.unlockedThemes).toContain('sunset');
  });

  it('без звёзд покупка не проходит', () => {
    const poor: MetaState = { ...EMPTY_META, stars: 0 };
    expect(buyTheme(poor, 'sunset')).toBe(poor);
  });

  it('уже открытая тема просто включается', () => {
    const bought = buyTheme({ ...EMPTY_META, stars: 500 }, 'ocean');
    const again = buyTheme({ ...bought, themeId: DEFAULT_THEME }, 'ocean');

    expect(again.stars).toBe(bought.stars);
    expect(again.themeId).toBe('ocean');
  });

  it('setTheme игнорирует закрытую тему', () => {
    expect(setTheme(EMPTY_META, 'neon')).toBe(EMPTY_META);
    expect(setTheme(EMPTY_META, DEFAULT_THEME).themeId).toBe(DEFAULT_THEME);
  });
});

describe('meta: связка с редьюсером', () => {
  it('победа обновляет статистику, рекорд режима и звёзды', () => {
    const won = winGame(playingState(), T0 + 25_000);

    expect(won.status).toBe('won');
    expect(won.meta.stats.wins).toBe(1);
    expect(bestTimeFor(won.meta.stats, 'campaign')).toBe(won.clock.elapsedMs);
    expect(won.meta.stars).toBeGreaterThan(0);
  });

  it('проигрыш тоже попадает в статистику', () => {
    const playing = playingState();
    const mine = playing.board.find((cell) => cell.hasMine);
    expect(mine).toBeDefined();
    if (mine === undefined) return;

    const lost = openCell(playing, mine.index, T0 + 5_000);

    expect(lost.status).toBe('lost');
    expect(lost.meta.stats.losses).toBe(1);
    expect(lost.meta.stats.currentStreak).toBe(0);
  });

  it('новая партия сохраняет мета-прогресс', () => {
    const won = winGame(playingState(), T0 + 25_000);
    const next = gameReducer(won, { type: 'NEXT_LEVEL' });

    expect(next.meta).toEqual(won.meta);
    expect(next.meta.stats.wins).toBe(1);
    expect(next.cellsOpened).toBe(0);
    expect(next.hintsUsed).toBe(0);
  });

  it('подсказка увеличивает счётчик партии', () => {
    const playing = playingState();
    const withCoins = { ...playing, coins: 500 };
    const used = gameReducer(withCoins, { type: 'APPLY_HINT', hint: 'show-mine', now: T0 + 100 });

    expect(used.hintsUsed).toBe(1);
    expect(used.coins).toBe(450);
  });

  it('покупка темы в редьюсере списывает звёзды', () => {
    const state = createInitialState({ seed: 1, meta: { stars: 200 } });
    const bought = gameReducer(state, { type: 'BUY_THEME', theme: 'frost' });

    expect(bought.meta.themeId).toBe('frost');
    expect(bought.meta.stars).toBe(200 - findTheme('frost').price);

    const tooExpensive = gameReducer(bought, { type: 'BUY_THEME', theme: 'violet' });
    expect(tooExpensive).toBe(bought);
  });

  it('вибрация и обучение переключаются', () => {
    const state = createInitialState({ seed: 1 });

    expect(state.meta.vibrationEnabled).toBe(true);
    expect(gameReducer(state, { type: 'TOGGLE_VIBRATION' }).meta.vibrationEnabled).toBe(false);

    expect(state.meta.tutorialSeen).toBe(false);
    const seen = gameReducer(state, { type: 'MARK_TUTORIAL_SEEN' });
    expect(seen.meta.tutorialSeen).toBe(true);
    expect(gameReducer(seen, { type: 'MARK_TUTORIAL_SEEN' })).toBe(seen);
  });
});
