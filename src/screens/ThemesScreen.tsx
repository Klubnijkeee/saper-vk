/**
 * Экран тем: витрина оформлений. Открытые можно включать бесплатно,
 * закрытые покупаются за звёзды.
 */

import type { ReactElement } from 'react';
import { THEMES, isThemeUnlocked } from '../game/themes';
import type { ThemeId } from '../game/types';
import { ScreenShell } from '../components/ScreenShell';
import { CheckIcon, LockIcon, StarIcon } from './../components/icons';

export interface ThemesScreenProps {
  readonly themeId: ThemeId;
  readonly unlockedThemes: readonly ThemeId[];
  readonly stars: number;
  readonly onBack: () => void;
  readonly onSelect: (theme: ThemeId) => void;
  readonly onBuy: (theme: ThemeId) => void;
}

export function ThemesScreen({
  themeId,
  unlockedThemes,
  stars,
  onBack,
  onSelect,
  onBuy,
}: ThemesScreenProps): ReactElement {
  return (
    <ScreenShell
      title="Темы"
      subtitle={`Звёзд: ${stars}. Тема меняет цвета поля и цифр.`}
      onBack={onBack}
    >
      <ul className="themes">
        {THEMES.map((theme) => {
          const unlocked = isThemeUnlocked(unlockedThemes, theme.id);
          const active = theme.id === themeId;
          const affordable = stars >= theme.price;

          return (
            <li key={theme.id} className={`theme${active ? ' is-active' : ''}`}>
              <button
                type="button"
                className="theme__pick"
                onClick={() => {
                  if (unlocked) onSelect(theme.id);
                  else if (affordable) onBuy(theme.id);
                }}
              >
                <span className="theme__preview" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      className="theme__cell"
                      style={{ background: theme.swatch[index] ?? theme.swatch[0] }}
                    />
                  ))}
                </span>
                <span className="theme__text">
                  <span className="theme__title">{theme.title}</span>
                  <span className="theme__subtitle">{theme.subtitle}</span>
                </span>
                <span className="theme__state">
                  {active ? (
                    <CheckIcon size={18} />
                  ) : unlocked ? null : (
                    <>
                      <LockIcon size={14} />
                      <span className={`theme__price${affordable ? '' : ' is-short'}`}>
                        <StarIcon size={12} />
                        {theme.price}
                      </span>
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="note">
        Звёзды дают за достижения и задачи дня. Открытая тема остаётся навсегда.
      </p>
    </ScreenShell>
  );
}
