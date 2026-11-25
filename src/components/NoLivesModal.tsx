/**
 * Модалка «жизни закончились»: показывает, сколько ждать восстановления,
 * и предлагает купить жизнь за звёзды.
 */

import type { ReactElement } from 'react';
import { LIFE_PRICE_STARS, MAX_LIVES, formatWaiting, msUntilNextLife, refreshLives } from '../game/lives';
import { useNow } from '../hooks/useNow';
import { HeartIcon, StarIcon } from './icons';
import { Modal } from './Modal';

export interface NoLivesModalProps {
  readonly lives: number;
  readonly updatedAt: number;
  readonly stars: number;
  readonly onBuy: () => void;
  readonly onExit: () => void;
}

export function NoLivesModal({
  lives,
  updatedAt,
  stars,
  onBuy,
  onExit,
}: NoLivesModalProps): ReactElement {
  // Отсчёт должен идти на глазах, поэтому модалка тикает сама.
  const now = useNow(1000);
  const waiting = msUntilNextLife(refreshLives({ lives, updatedAt }, now), now);
  const affordable = stars >= LIFE_PRICE_STARS;

  return (
    <Modal title="Жизни" tone="danger" onDismiss={onExit}>
      <span className="modal__badge modal__badge--danger" aria-hidden="true">
        <HeartIcon size={28} filled={false} />
      </span>

      <h2 className="modal__title">Жизни закончились</h2>
      <p className="modal__subtitle">
        {waiting === null
          ? 'Следующая жизнь уже восстановилась'
          : `Следующая через ${formatWaiting(waiting)}`}
      </p>

      <div className="modal__stats">
        <div className="modal__stat">
          <span>Жизни</span>
          <strong>
            0 из {MAX_LIVES}
          </strong>
        </div>
        <div className="modal__stat">
          <span>Звёзды</span>
          <strong>
            <StarIcon size={14} /> {stars}
          </strong>
        </div>
      </div>

      <div className="modal__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onBuy}
          disabled={!affordable}
        >
          Купить жизнь за {LIFE_PRICE_STARS} звёзд
        </button>
        <button type="button" className="btn btn--ghost" onClick={onExit}>
          В меню
        </button>
      </div>

      <p className="note">
        В свободной игре жизни не тратятся — там можно тренироваться без ограничений.
      </p>
    </Modal>
  );
}
