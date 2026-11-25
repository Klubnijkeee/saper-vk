/**
 * Силуэт фигуры уровня: мины как закрашенные клетки сетки 9×9.
 *
 * Используется на карте кампании и в коллекции. Показывается только у
 * пройденных уровней — иначе фигура была бы подсказкой перед партией.
 */

import type { ReactElement } from 'react';
import { MINE_CHAR, PATTERN_COLS, PATTERN_ROWS } from '../game/patterns';

export interface PatternPreviewProps {
  readonly art: readonly string[];
  readonly className?: string;
}

export function PatternPreview({ art, className }: PatternPreviewProps): ReactElement {
  return (
    <svg
      className={className === undefined ? 'pattern-preview' : `pattern-preview ${className}`}
      viewBox={`0 0 ${PATTERN_COLS} ${PATTERN_ROWS}`}
      aria-hidden="true"
    >
      {art.flatMap((row, rowIndex) =>
        [...row].map((char, colIndex) =>
          char === MINE_CHAR ? (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex}
              y={rowIndex}
              width="1"
              height="1"
              rx="0.22"
              fill="currentColor"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
