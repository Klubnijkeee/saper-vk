/**
 * Верхняя панель: назад, уровень, рекорд, таймер, пауза — одна строка 48 px.
 * Монеты живут в строке статуса под полем, чтобы не дублироваться.
 */

import type { ReactElement } from 'react';
import { formatClock } from '../game/clock';
import { ChevronLeftIcon, PauseIcon, PlayIcon, TrophyIcon } from './icons';

export interface TopBarProps {
  readonly level: number;
  readonly elapsedMs: number;
  /** Лучшее время прохождения; `null` — рекорда ещё нет. */
  readonly bestTime: number | null;
  readonly paused: boolean;
  /** «Назад» — возврат в меню (на этом этапе открывает паузу). */
  readonly onBack: () => void;
  readonly onPause: () => void;
}

export function TopBar({
  level,
  elapsedMs,
  bestTime,
  paused,
  onBack,
  onPause,
}: TopBarProps): ReactElement {
  return (
    <header className="topbar">
      <button type="button" className="topbar__icon-btn" onClick={onBack} aria-label="В меню">
        <ChevronLeftIcon size={20} />
      </button>

      <span className="chip chip--level">Ур. {level}</span>

      <span className="topbar__spacer" />

      {bestTime !== null ? (
        <span className="chip chip--record" title="Лучшее время">
          <TrophyIcon size={13} />
          {formatClock(bestTime)}
        </span>
      ) : null}

      <span className="chip chip--time" aria-label="Время партии">
        {formatClock(elapsedMs)}
      </span>

      <button
        type="button"
        className="topbar__icon-btn"
        onClick={onPause}
        aria-label={paused ? 'Продолжить' : 'Пауза'}
      >
        {paused ? <PlayIcon size={17} /> : <PauseIcon size={17} />}
      </button>
    </header>
  );
}
