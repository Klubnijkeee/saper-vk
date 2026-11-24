/**
 * Экран завершения партии: «Взрыв!» или «Победа!».
 *
 * Победа: время, бонус +50 монет, рекорд (с отметкой нового) и переход
 * на следующий уровень. Проигрыш: время и «Заново».
 */

import type { ReactElement } from 'react';
import { formatClock } from '../game/clock';
import { WIN_BONUS_COINS } from '../game/reveal';
import { MineIcon, TrophyIcon } from './icons';
import { Modal } from './Modal';

export interface GameOverModalProps {
  readonly status: 'won' | 'lost';
  readonly level: number;
  readonly elapsedMs: number;
  readonly bestTime: number | null;
  readonly onNextLevel: () => void;
  readonly onRestart: () => void;
  /** Тап мимо карточки — посмотреть поле. */
  readonly onDismiss: () => void;
}

export function GameOverModal({
  status,
  level,
  elapsedMs,
  bestTime,
  onNextLevel,
  onRestart,
  onDismiss,
}: GameOverModalProps): ReactElement {
  const won = status === 'won';
  const isRecord = won && bestTime !== null && bestTime === elapsedMs;

  return (
    <Modal
      title={won ? 'Победа' : 'Взрыв'}
      tone={won ? 'success' : 'danger'}
      celebrate={won}
      onDismiss={onDismiss}
    >
      <span className={`modal__badge modal__badge--${won ? 'success' : 'danger'}`} aria-hidden="true">
        {won ? <TrophyIcon size={30} /> : <MineIcon size={30} />}
      </span>

      <h2 className="modal__title">{won ? 'Победа!' : 'Взрыв!'}</h2>
      <p className="modal__subtitle">
        {won ? `Уровень ${level} пройден` : 'Мина оказалась под ногами'}
      </p>

      <div className="modal__stats">
        <div className="modal__stat">
          <span>Время</span>
          <strong>{formatClock(elapsedMs)}</strong>
        </div>
        {won ? (
          <div className="modal__stat modal__stat--bonus">
            <span>Бонус</span>
            <strong>+{WIN_BONUS_COINS} монет</strong>
          </div>
        ) : (
          <div className="modal__stat">
            <span>Уровень</span>
            <strong>{level}</strong>
          </div>
        )}
        {bestTime !== null ? (
          <div className="modal__stat">
            <span>Рекорд</span>
            <strong>
              {formatClock(bestTime)}
              {isRecord ? <em className="modal__record"> новый</em> : null}
            </strong>
          </div>
        ) : null}
      </div>

      <div className="modal__actions">
        {won ? (
          <button type="button" className="btn btn--primary" onClick={onNextLevel}>
            Следующий уровень
          </button>
        ) : null}
        <button
          type="button"
          className={`btn ${won ? 'btn--ghost' : 'btn--primary'}`}
          onClick={onRestart}
        >
          Заново
        </button>
      </div>
    </Modal>
  );
}
