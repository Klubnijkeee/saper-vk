/**
 * Жизни: сердечки, обратный отсчёт до следующей и покупка за звёзды.
 *
 * Компонент ничего не хранит: число жизней и момент последнего пересчёта
 * приходят пропсами, а «сколько уже накапало» считается функцией от `now`.
 */

import type { ReactElement } from 'react';
import {
  LIFE_PRICE_STARS,
  MAX_LIVES,
  formatWaiting,
  msUntilNextLife,
  refreshLives,
} from '../game/lives';
import { HeartIcon, StarIcon } from './icons';

export interface HeartsProps {
  readonly lives: number;
  /** Момент, от которого считается регенерация. */
  readonly updatedAt: number;
  readonly now: number;
  /** Звёзды игрока — для кнопки покупки. */
  readonly stars?: number;
  readonly onBuy?: () => void;
}

export function Hearts({ lives, updatedAt, now, stars, onBuy }: HeartsProps): ReactElement {
  const state = refreshLives({ lives, updatedAt }, now);
  const waiting = msUntilNextLife(state, now);
  const canBuy = onBuy !== undefined;
  const affordable = stars === undefined || stars >= LIFE_PRICE_STARS;

  return (
    <div className="lives">
      <span className="lives__row" aria-label={`Жизней: ${state.lives} из ${MAX_LIVES}`}>
        {Array.from({ length: MAX_LIVES }, (_unused, index) => (
          <span key={index} className={`lives__heart${index < state.lives ? ' is-on' : ''}`}>
            <HeartIcon size={15} filled={index < state.lives} />
          </span>
        ))}
      </span>

      {waiting === null ? null : (
        <span className="lives__timer">+1 через {formatWaiting(waiting)}</span>
      )}

      {canBuy && state.lives < MAX_LIVES ? (
        <button
          type="button"
          className="lives__buy"
          onClick={onBuy}
          disabled={!affordable}
          aria-label={`Купить жизнь за ${LIFE_PRICE_STARS} звёзд`}
        >
          <StarIcon size={12} />
          {LIFE_PRICE_STARS}
        </button>
      ) : null}
    </div>
  );
}
