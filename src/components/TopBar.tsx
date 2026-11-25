/**
 * Верхняя панель игры: режим, рекорд, таймер, пауза и возврат в меню.
 * Монеты живут в строке статуса под полем, чтобы не дублироваться.
 */

import type { ReactElement } from 'react';
import { formatClock } from '../game/clock';
import { ChevronLeftIcon, PauseIcon, PlayIcon, TrophyIcon } from './icons';

export interface TopBarProps {
  /** «Уровень 3» для кампании или «Поле 16×16» для свободной игры. */
  readonly modeLabel: string;
  /** Пояснение под режимом: размер поля или число мин. */
  readonly modeCaption: string;
  readonly elapsedMs: number;
  /** Рекорд текущего режима; `null` — ещё нет. */
  readonly record: number | null;
  readonly paused: boolean;
  /** «Назад» — пауза с выходом в меню. */
  readonly onBack: () => void;
  readonly onPause: () => void;
}

export function TopBar({
  modeLabel,
  modeCaption,
  elapsedMs,
  record,
  paused,
  onBack,
  onPause,
}: TopBarProps): ReactElement {
  return (
    <header className="topbar">
      <button type="button" className="topbar__icon-btn" onClick={onBack} aria-label="В меню">
        <ChevronLeftIcon size={20} />
      </button>

      <span className="topbar__mode">
        <span className="topbar__mode-label">{modeLabel}</span>
        <span className="topbar__mode-caption">{modeCaption}</span>
      </span>

      <span className="topbar__spacer" />

      {record === null ? null : (
        <span className="chip chip--record" title="Рекорд режима">
          <TrophyIcon size={13} />
          {formatClock(record)}
        </span>
      )}

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
