/**
 * Тесты справочников: режимы (поля и сложности) и темы оформления.
 */

import { describe, expect, it } from 'vitest';
import { getLevelConfig } from '../src/game/board';
import { FREE_CONFIGS, FREE_MODES, MODES, configForMode, findMode, isCampaign } from '../src/game/modes';
import { PATTERN_LEVELS, patternForLevel, patternMineCount } from '../src/game/patterns';
import { DEFAULT_THEME, THEMES, findTheme, isThemeUnlocked, lockedThemes } from '../src/game/themes';
import type { ModeId } from '../src/game/types';

describe('modes: режимы игры', () => {
  it('кампания идёт первой и получает поле по уровню', () => {
    // Уровень с фигурой берёт число мин из фигуры, уровень без фигуры — из тарифа.
    expect(configForMode('campaign', PATTERN_LEVELS + 1)).toEqual(
      getLevelConfig(PATTERN_LEVELS + 1),
    );
    expect(isCampaign('campaign')).toBe(true);
    expect(isCampaign('novice')).toBe(false);
  });

  it('уровень с фигурой получает столько мин, сколько нарисовано', () => {
    for (let level = 1; level <= PATTERN_LEVELS; level += 1) {
      const pattern = patternForLevel(level);
      if (pattern === null) continue;
      const config = configForMode('campaign', level);
      expect(config.mines, `уровень ${level}`).toBe(patternMineCount(pattern));
      expect(config.rows).toBe(9);
      expect(config.cols).toBe(9);
    }
  });

  it('свободная игра: классические поля и число мин', () => {
    expect(FREE_CONFIGS.novice).toEqual({ rows: 9, cols: 9, mines: 10 });
    expect(FREE_CONFIGS.amateur).toEqual({ rows: 16, cols: 16, mines: 40 });
    expect(FREE_CONFIGS.professional).toEqual({ rows: 16, cols: 30, mines: 99 });
    expect(FREE_CONFIGS.special).toEqual({ rows: 12, cols: 12, mines: 24 });
  });

  it('в свободной игре уровень на поле не влияет', () => {
    expect(configForMode('amateur', 1)).toEqual(configForMode('amateur', 99));
  });

  it('мин всегда меньше, чем клеток: иначе поле не сгенерируется', () => {
    for (const mode of MODES) {
      const config = configForMode(mode.id, 1);
      expect(config.mines).toBeLessThan(config.rows * config.cols - 9);
    }
  });

  it('findMode находит режим и падает на неизвестном', () => {
    expect(findMode('special').title).toBe('Особый');
    expect(() => findMode('unknown' as ModeId)).toThrow();
  });

  it('FREE_MODES не содержит кампанию', () => {
    expect(FREE_MODES.map((mode) => mode.id)).not.toContain('campaign');
    expect(FREE_MODES).toHaveLength(MODES.length - 1);
  });
});

describe('themes: витрина оформлений', () => {
  it('тема по умолчанию открыта и стоит ноль', () => {
    expect(findTheme(DEFAULT_THEME).price).toBe(0);
    expect(isThemeUnlocked([DEFAULT_THEME], DEFAULT_THEME)).toBe(true);
  });

  it('идентификаторы тем уникальны, у каждой есть три цвета для превью', () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const theme of THEMES) {
      expect(theme.swatch).toHaveLength(3);
    }
  });

  it('lockedThemes возвращает только неоткрытые темы', () => {
    const locked = lockedThemes([DEFAULT_THEME, 'neon']);
    const ids = locked.map((theme) => theme.id);

    expect(ids).not.toContain(DEFAULT_THEME);
    expect(ids).not.toContain('neon');
    expect(ids).toHaveLength(THEMES.length - 2);
  });

  it('findTheme падает на неизвестной теме', () => {
    expect(() => findTheme('unknown' as never)).toThrow();
  });
});
