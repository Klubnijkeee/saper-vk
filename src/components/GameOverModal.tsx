/**
 * Экран завершения партии: «Взрыв!» или «Победа!».
 *
 * В кампании победа ведёт на следующий уровень, в свободной игре — на новую
 * партию того же поля. В обоих случаях можно вернуться в меню.
 */

import type { ReactElement } from 'react';
import { formatClock } from '../game/clock';
import { WIN_BONUS_COINS } from '../game/reveal';
import { MineIcon, TrophyIcon } from './icons';
import { Modal } from './Modal';

export interface GameOverModalProps {
  readonly status: 'won' | 'lost';
  /** Кампания или свободная игра — от этого зависят подписи и кнопки. */
  readonly campaign: boolean;
  /** «Уровень 3» или «Поле 16×16». */
  readonly modeLabel: string;
  readonly elapsedMs: number;
  readonly bestTime: number | null;
  readonly onNextLevel: () => void;
  readonly onRestart: () => void;
  readonly onExit: () => void;
  /** Тап мимо карточки — посмотреть поле. */
  readonly onDismiss: () => void;
}

export function GameOverModal({
  status,
  campaign,
  modeLabel,
  elapsedMs,
  bestTime,
  onNextLevel,
  onRestart,
  onExit,
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
        {won ? `${modeLabel} пройден` : 'Мина оказалась под ногами'}
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
            <span>Режим</span>
            <strong>{modeLabel}</strong>
          </div>
        )}
        {bestTime === null ? null : (
          <div className="modal__stat">
            <span>Рекорд</span>
            <strong>
              {formatClock(bestTime)}
              {isRecord ? <em className="modal__record"> новый</em> : null}
            </strong>
          </div>
        )}
      </div>

      <div className="modal__actions">
        {won && campaign ? (
          <button type="button" className="btn btn--primary" onClick={onNextLevel}>
            Следующий уровень
          </button>
        ) : null}
        <button
          type="button"
          className={`btn ${won && campaign ? 'btn--ghost' : 'btn--primary'}`}
          onClick={onRestart}
        >
          {won && campaign ? 'Заново' : 'Ещё раз'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          В меню
        </button>
      </div>
    </Modal>
  );
}
