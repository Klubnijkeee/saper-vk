/**
 * Игровое поле: сетка любого размера — от 9×9 до 30×16.
 *
 * Компонент «глупый»: получает состояние и колбэки. Его единственная
 * собственная задача — разложить события последнего хода в анимации клеток
 * (волна раскрытия, пружинка флажка, вспышка взрыва) и тряхнуть поле.
 *
 * Размер клетки считает CSS: `--cols` задаётся здесь, а формула живёт
 * в styles.css. Так поле само подстраивается под ширину экрана: на 9×9
 * клетки крупные, на 30×16 — мелкие, но не меньше порога, после которого
 * включается горизонтальная прокрутка.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { GameState } from '../game/types';
import { Cell, cellKey, type CellAnimation } from './Cell';

export interface BoardProps {
  readonly state: GameState;
  readonly onReveal: (index: number) => void;
  readonly onFlag: (index: number) => void;
}

/**
 * Шаг волны: задержка для каждого следующего «кольца» каскада.
 *
 * В ТЗ было 0.1 с между клетками — но каскад из 54 клеток тогда раскрывался бы
 * 5.4 с, а исходное требование к каскаду — «без задержек». Поэтому волна идёт
 * по расстоянию от точки клика: 45 мс на кольцо (весь каскад — около 0.3 с),
 * с жёстким потолком. Крутится одной константой.
 */
const WAVE_STEP_MS = 45;
const WAVE_MAX_DELAY_MS = 360;

/** Длительность тряски поля — совпадает с CSS-анимацией. */
const SHAKE_MS = 300;

export function Board({ state, onReveal, onFlag }: BoardProps): ReactElement {
  const { board, config, status, paused, lastEvent } = state;
  const locked = status === 'won' || status === 'lost' || paused;

  const animations = useMemo((): ReadonlyMap<number, CellAnimation> => {
    const map = new Map<number, CellAnimation>();
    if (lastEvent === null) return map;

    if (lastEvent.kind === 'reveal') {
      for (const wave of lastEvent.cells) {
        map.set(wave.index, {
          kind: 'wave',
          delayMs: Math.min(wave.ring * WAVE_STEP_MS, WAVE_MAX_DELAY_MS),
          token: lastEvent.id,
        });
      }
      return map;
    }

    if (lastEvent.kind === 'flag') {
      map.set(lastEvent.index, { kind: 'flag', delayMs: 0, token: lastEvent.id });
      return map;
    }

    if (lastEvent.kind === 'explode') {
      map.set(lastEvent.index, { kind: 'explode', delayMs: 0, token: lastEvent.id });
      return map;
    }

    if (lastEvent.kind === 'hint') {
      map.set(lastEvent.index, { kind: 'hint', delayMs: 0, token: lastEvent.id });
      return map;
    }

    // mineRemoved
    map.set(lastEvent.index, { kind: 'mineRemoved', delayMs: 0, token: lastEvent.id });
    return map;
  }, [lastEvent]);

  // Тряска — короткая (0.3 с), поэтому включается на время и снимается сама.
  const [shaking, setShaking] = useState(false);
  const explodeId = lastEvent?.kind === 'explode' ? lastEvent.id : 0;
  useEffect(() => {
    if (explodeId === 0) return undefined;
    setShaking(true);
    const timer = window.setTimeout(() => {
      setShaking(false);
    }, SHAKE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [explodeId]);

  return (
    <div className="board-area" data-size={config.cols > 16 ? 'small' : 'normal'}>
      <div
        className={`board${shaking ? ' board--shake' : ''}`}
        role="group"
        aria-label={`Игровое поле ${config.rows} на ${config.cols}`}
        data-status={status}
        onContextMenu={(event) => {
          // Вторая линия обороны: у отключённых клеток событие до них не доходит.
          event.preventDefault();
        }}
      >
        {board.map((cell) => {
          const animation = animations.get(cell.index) ?? null;
          return (
            <Cell
              key={cellKey(cell, animation)}
              cell={cell}
              locked={locked}
              animation={animation}
              hinted={state.hintedIndex === cell.index}
              onReveal={onReveal}
              onFlag={onFlag}
            />
          );
        })}
      </div>
    </div>
  );
}

