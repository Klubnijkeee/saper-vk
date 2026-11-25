/**
 * Оценка уровня: три звезды, заполненные по числу заработанных.
 * Используется и на карте кампании, и на экране победы.
 */

import type { ReactElement } from 'react';
import { StarIcon } from './icons';

export interface StarsProps {
  /** Сколько звёзд заработано: 0..3. */
  readonly earned: number;
  readonly size?: number;
}

export function Stars({ earned, size = 14 }: StarsProps): ReactElement {
  return (
    <span className="stars" aria-label={`Оценка ${earned} из 3`}>
      {[0, 1, 2].map((index) => (
        <span key={index} className={`stars__item${index < earned ? ' is-on' : ''}`}>
          <StarIcon size={size} filled={index < earned} />
        </span>
      ))}
    </span>
  );
}
