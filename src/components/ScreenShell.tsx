/**
 * Каркас вторичного экрана: шапка с кнопкой «назад» и прокручиваемое тело.
 * Используется всеми экранами, кроме игрового поля.
 */

import type { ReactElement, ReactNode } from 'react';
import { ChevronLeftIcon } from './icons';

export interface ScreenShellProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly onBack: () => void;
  readonly children: ReactNode;
}

export function ScreenShell({ title, subtitle, onBack, children }: ScreenShellProps): ReactElement {
  return (
    <div className="screen">
      <header className="screen__header">
        <button type="button" className="screen__back" onClick={onBack} aria-label="Назад">
          <ChevronLeftIcon size={22} />
        </button>
        <div className="screen__titles">
          <h1 className="screen__title">{title}</h1>
          {subtitle === undefined ? null : <p className="screen__subtitle">{subtitle}</p>}
        </div>
      </header>
      <div className="screen__body">{children}</div>
    </div>
  );
}
