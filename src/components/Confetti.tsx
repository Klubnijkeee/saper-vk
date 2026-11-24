/**
 * Конфетти для экрана победы: 30 точек на чистом CSS, без библиотек и canvas.
 *
 * Позиции и тайминги детерминированы (хеш от индекса), а не `Math.random`:
 * ререндер не разбрасывает точки заново.
 */

import { useMemo, type CSSProperties, type ReactElement } from 'react';

const DOT_COUNT = 30;
const PALETTE: readonly string[] = ['#4C8DFF', '#3DDC84', '#FFD166', '#FF5A5F', '#A86BFF', '#FFFFFF'];

/** Детерминированное псевдослучайное число в [0, 1). */
function pseudoRandom(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

type ConfettiStyle = CSSProperties & {
  readonly '--confetti-dx': string;
  readonly '--confetti-rot': string;
};

export function Confetti(): ReactElement {
  const dots = useMemo(
    () =>
      Array.from({ length: DOT_COUNT }, (_unused, index) => {
        const size = 6 + pseudoRandom(index, 6) * 6;
        const style: ConfettiStyle = {
          left: `${pseudoRandom(index, 1) * 100}%`,
          width: `${size}px`,
          height: `${size}px`,
          background: PALETTE[index % PALETTE.length] ?? '#FFFFFF',
          animationDelay: `${pseudoRandom(index, 2) * 0.5}s`,
          animationDuration: `${1.5 + pseudoRandom(index, 3) * 1.1}s`,
          '--confetti-dx': `${(pseudoRandom(index, 4) - 0.5) * 140}px`,
          '--confetti-rot': `${360 + pseudoRandom(index, 5) * 720}deg`,
        };
        return <span key={index} className="confetti__dot" style={style} />;
      }),
    [],
  );

  return (
    <div className="confetti" aria-hidden="true">
      {dots}
    </div>
  );
}
