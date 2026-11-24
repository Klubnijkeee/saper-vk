/**
 * Модалка паузы: «Продолжить» / «Заново», статистика партии и переключатель звука.
 * Пока открыта — часы стоят, поле не принимает ходы.
 */

import type { ReactElement } from 'react';
import { formatClock } from '../game/clock';
import { SoundIcon } from './icons';
import { Modal } from './Modal';

export interface PauseModalProps {
  readonly level: number;
  readonly coins: number;
  readonly elapsedMs: number;
  readonly bestTime: number | null;
  readonly soundEnabled: boolean;
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onToggleSound: () => void;
}

export function PauseModal({
  level,
  coins,
  elapsedMs,
  bestTime,
  soundEnabled,
  onResume,
  onRestart,
  onToggleSound,
}: PauseModalProps): ReactElement {
  return (
    <Modal title="Пауза" tone="neutral">
      <h2 className="modal__title">Пауза</h2>
      <p className="modal__subtitle">Таймер остановлен</p>

      <div className="modal__stats">
        <div className="modal__stat">
          <span>Уровень</span>
          <strong>{level}</strong>
        </div>
        <div className="modal__stat">
          <span>Время</span>
          <strong>{formatClock(elapsedMs)}</strong>
        </div>
        <div className="modal__stat">
          <span>Монеты</span>
          <strong>{coins}</strong>
        </div>
        {bestTime !== null ? (
          <div className="modal__stat">
            <span>Рекорд</span>
            <strong>{formatClock(bestTime)}</strong>
          </div>
        ) : null}
      </div>

      <div className="modal__actions">
        <button type="button" className="btn btn--primary" onClick={onResume}>
          Продолжить
        </button>
        <button type="button" className="btn btn--ghost" onClick={onRestart}>
          Заново
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
