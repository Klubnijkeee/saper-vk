/**
 * Оформление поля: список тем для витрины.
 *
 * Здесь только описания (название, цена, цвета для превью). Сами палитры
 * живут в `src/styles.css` под селектором `[data-theme='…']`, поэтому новая
 * тема — это блок CSS плюс одна запись в списке.
 */

import type { ThemeId, ThemePreset } from './types';

/** Тема по умолчанию — она открыта с самого начала. */
export const DEFAULT_THEME: ThemeId = 'classic';

/** Витрина тем: порядок = порядок карточек на экране. */
export const THEMES: readonly ThemePreset[] = [
  {
    id: 'classic',
    title: 'Классика',
    subtitle: 'Тёмный графит',
    price: 0,
    swatch: ['#2a2a2a', '#1e1e1e', '#4c8dff'],
  },
  {
    id: 'neon',
    title: 'Неон-грид',
    subtitle: 'Киберпанк',
    price: 60,
    swatch: ['#241b4d', '#120c2a', '#ff2e93'],
  },
  {
    id: 'aurora',
    title: 'Аврора',
    subtitle: 'Северное сияние',
    price: 80,
    swatch: ['#123c3a', '#0b1f2a', '#3ddc84'],
  },
  {
    id: 'sunset',
    title: 'Закат',
    subtitle: 'Вечернее небо',
    price: 90,
    swatch: ['#4a2b3c', '#241528', '#ff9f43'],
  },
  {
    id: 'ocean',
    title: 'Океан',
    subtitle: 'Толща воды',
    price: 100,
    swatch: ['#123049', '#0a1a2b', '#4c8dff'],
  },
  {
    id: 'frost',
    title: 'Морозное стекло',
    subtitle: 'Матовый лёд',
    price: 120,
    swatch: ['#2b3a4a', '#16202c', '#9fd8ff'],
  },
  {
    id: 'paper',
    title: 'Матовый пластик',
    subtitle: 'Светлая клавиатура',
    price: 70,
    swatch: ['#dcdcdc', '#f2f2f2', '#2f6ae0'],
  },
  {
    id: 'violet',
    title: 'Ультрафиолет',
    subtitle: 'Фиолетовый неон',
    price: 140,
    swatch: ['#32215e', '#1a1130', '#a86bff'],
  },
];

/** Тема по идентификатору. */
export function findTheme(id: ThemeId): ThemePreset {
  const theme = THEMES.find((candidate) => candidate.id === id);
  if (theme === undefined) throw new Error(`Неизвестная тема: ${id}`);
  return theme;
}

/** Открыта ли тема. */
export function isThemeUnlocked(unlocked: readonly ThemeId[], id: ThemeId): boolean {
  return unlocked.includes(id);
}

/** Темы, которые ещё можно купить. */
export function lockedThemes(unlocked: readonly ThemeId[]): readonly ThemePreset[] {
  return THEMES.filter((theme) => !isThemeUnlocked(unlocked, theme.id));
}
