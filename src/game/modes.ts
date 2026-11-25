/**
 * Режимы игры: кампания и свободная игра с классическими сложностями.
 *
 * Кампания — то, что было раньше: 9×9, число мин растёт с уровнем.
 * Свободная игра — фиксированные поля с собственным рекордом времени.
 */

import { getLevelConfig } from './board';
import { patternForLevel, patternMineCount } from './patterns';
import type { LevelConfig, ModeId, ModePreset } from './types';

/** Все режимы в порядке показа. */
export const MODES: readonly ModePreset[] = [
  {
    id: 'campaign',
    title: 'Прохождение',
    subtitle: 'Уровни с растущей сложностью',
    icon: 'map',
  },
  { id: 'novice', title: 'Новичок', subtitle: '9×9 · 10 мин', icon: 'star' },
  { id: 'amateur', title: 'Любитель', subtitle: '16×16 · 40 мин', icon: 'grid' },
  { id: 'professional', title: 'Профессионал', subtitle: '30×16 · 99 мин', icon: 'crown' },
  { id: 'special', title: 'Особый', subtitle: '12×12 · 24 мины', icon: 'spark' },
];

/** Поля свободных режимов. */
export const FREE_CONFIGS: Readonly<Record<Exclude<ModeId, 'campaign'>, LevelConfig>> = {
  novice: { rows: 9, cols: 9, mines: 10 },
  amateur: { rows: 16, cols: 16, mines: 40 },
  // Классика Windows: 30 колонок, 16 строк, 99 мин
  professional: { rows: 16, cols: 30, mines: 99 },
  special: { rows: 12, cols: 12, mines: 24 },
};

/** Свободные режимы (всё, кроме кампании). */
export const FREE_MODES: readonly ModePreset[] = MODES.filter(
  (mode) => mode.id !== 'campaign',
);

/** Режим по идентификатору. Бросает, если id неизвестен — это ошибка программиста. */
export function findMode(id: ModeId): ModePreset {
  const mode = MODES.find((candidate) => candidate.id === id);
  if (mode === undefined) throw new Error(`Неизвестный режим: ${id}`);
  return mode;
}

/** Проверка строки на идентификатор режима (пригодится при разборе ссылок). */
export function isModeId(value: string): value is ModeId {
  return MODES.some((mode) => mode.id === value);
}

/**
 * Поле для режима: у кампании зависит от уровня, у свободной игры — фиксировано.
 *
 * На уровнях с фигурой число мин берётся из самой фигуры: если оставить
 * «тарифное» значение, `safeCellsTotal` разойдётся с полем и победа станет
 * недостижимой — открыть предписанные 71 клетку при 12 минах невозможно.
 */
export function configForMode(mode: ModeId, level: number): LevelConfig {
  if (mode !== 'campaign') return FREE_CONFIGS[mode];

  const base = getLevelConfig(level);
  const pattern = patternForLevel(level);
  if (pattern === null) return base;
  return { ...base, mines: patternMineCount(pattern) };
}

/** Кампания — единственный режим, где есть понятие «уровень». */
export function isCampaign(mode: ModeId): boolean {
  return mode === 'campaign';
}
