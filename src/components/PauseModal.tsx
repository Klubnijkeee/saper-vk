/**
 * Модалка паузы: «Продолжить» / «Заново» / «В меню», статистика партии
 * и переключатель звука. Пока открыта — часы стоят, поле не принимает ходы.
 */

import type { ReactElement } from 'react';
import { formatClock } from '../game/clock';
import { SoundIcon } from './icons';
import { Modal } from './Modal';

export interface PauseModalProps {
  /** «Уровень 3» или «Поле 16×16». */
  readonly modeLabel: string;
  readonly coins: number;
  readonly elapsedMs: number;
  readonly bestTime: number | null;
  readonly soundEnabled: boolean;
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onToggleSound: () => void;
  /** Выход в меню — партия остаётся незавершённой. */
  readonly onExit: () => void;
}

export function PauseModal({
  modeLabel,
  coins,
  elapsedMs,
  bestTime,
  soundEnabled,
  onResume,
  onRestart,
  onToggleSound,
  onExit,
}: PauseModalProps): ReactElement {
  return (
    <Modal title="Пауза" tone="neutral">
      <h2 className="modal__title">Пауза</h2>
      <p className="modal__subtitle">Таймер остановлен</p>

      <div className="modal__stats">
        <div className="modal__stat">
          <span>Режим</span>
          <strong>{modeLabel}</strong>
        </div>
        <div className="modal__stat">
          <span>Время</span>
          <strong>{formatClock(elapsedMs)}</strong>
        </div>
        <div className="modal__stat">
          <span>Монеты</span>
          <strong>{coins}</strong>
        </div>
        {bestTime === null ? null : (
          <div className="modal__stat">
            <span>Рекорд</span>
            <strong>{formatClock(bestTime)}</strong>
          </div>
        )}
      </div>

      <div className="modal__actions">
        <button type="button" className="btn btn--primary" onClick={onResume}>
          Продолжить
        </button>
        <button type="button" className="btn btn--ghost" onClick={onRestart}>
          Заново
        </button>
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          В меню
        </button>
      </div>

      <button
        type="button"
        className="btn btn--sound"
        aria-pressed={soundEnabled}
        onClick={onToggleSound}
      >
        <SoundIcon size={17} muted={!soundEnabled} />
        {soundEnabled ? 'Звук включён' : 'Звук выключен'}
      </button>
    </Modal>
  );
}
