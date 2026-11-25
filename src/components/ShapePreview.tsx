/**
 * Силуэт фигуры уровня: клетки поля как закрашенные квадратики сетки.
 *
 * Используется на карте кампании и в коллекции. Рисуется по маске фигуры,
 * поэтому в узле карты видно именно то поле, которое предстоит открыть.
 */

import type { ReactElement } from 'react';

export interface ShapePreviewProps {
  /** Маска: `true` — клетка поля. */
  readonly mask: readonly boolean[];
  readonly rows: number;
  readonly cols: number;
}

export function ShapePreview({ mask, rows, cols }: ShapePreviewProps): ReactElement {
  return (
    <svg
      className="shape-preview"
      viewBox={`0 0 ${cols} ${rows}`}
      aria-hidden="true"
    >
      {mask.map((allowed, index) =>
        allowed ? (
          <rect
            key={index}
            x={index % cols}
            y={Math.floor(index / cols)}
            width="1"
            height="1"
            rx="0.22"
            fill="currentColor"
          />
        ) : null,
      )}
    </svg>
  );
}
