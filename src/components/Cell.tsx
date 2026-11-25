/**
 * Одна клетка поля.
 *
 * Компонент без собственного домена: всё приходит пропсами, внешний вид —
 * производная от `cell` и `animation`. Внутри живёт только механика ввода:
 * тап = открыть, удержание (или правый клик) = флажок.
 */

import { memo, useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react';
import type { Cell as CellModel } from '../game/types';
import { FlagIcon, MineIcon } from './icons';

/** Сколько держать палец, чтобы поставить флажок. */
const LONG_PRESS_MS = 380;
/** Сдвиг пальца, после которого удержание отменяется (это скролл, а не флажок). */
const MOVE_TOLERANCE_PX = 12;

/** Анимация клетки, назначенная последним событием партии. */
export interface CellAnimation {
  readonly kind: 'wave' | 'flag' | 'explode' | 'hint' | 'mineRemoved';
  readonly delayMs: number;
  /** id события: участвует в React-ключе, чтобы анимация переигрывалась. */
  readonly token: number;
}

export interface CellProps {
  readonly cell: CellModel;
  /** Партия завершена или на паузе — поле «заморожено». */
  readonly locked: boolean;
  readonly animation: CellAnimation | null;
  /** Клетка подсвечена подсказкой «Показать мину» (гаснет через 2 с). */
  readonly hinted: boolean;
  readonly onReveal: (index: number) => void;
  readonly onFlag: (index: number) => void;
}

/**
 * Ключ клетки. Меняется вместе с событием, чтобы React пересоздал узел
 * и CSS-анимация гарантированно проигралась заново.
 */
export function cellKey(cell: CellModel, animation: CellAnimation | null): string {
  if (animation === null) return `${cell.index}`;
  return `${cell.index}:${animation.token}:${animation.kind}`;
}

/** Подпись для скринридера. */
function cellLabel(cell: CellModel): string {
  if (cell.state === 'flagged') return 'Флажок';
  if (cell.state === 'revealed') {
    if (cell.hasMine) return 'Мина';
    return cell.adjacentMines > 0 ? `Мин рядом: ${cell.adjacentMines}` : 'Пусто';
  }
  return 'Закрытая клетка';
}

/** Содержимое клетки: флажок, мина или цифра. */
function cellContent(cell: CellModel): ReactNode {
  if (cell.state === 'flagged') return <FlagIcon size={16} />;
  if (cell.state !== 'revealed') return null;
  if (cell.hasMine) return <MineIcon size={20} />;
  if (cell.adjacentMines > 0) {
    return (
      <span className="cell__digit" data-value={cell.adjacentMines}>
        {cell.adjacentMines}
      </span>
    );
  }
  return null;
}

export const Cell = memo(function Cell({
  cell,
  locked,
  animation,
  hinted,
  onReveal,
  onFlag,
}: CellProps): ReactElement {
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  /** Удержание уже сработало — гасим следующий за ним `click`. */
  const consumed = useRef(false);

  const clearPress = useCallback((): void => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  useEffect(() => clearPress, [clearPress]);

  /** Завершить нажатие: снять таймер и забыть точку старта. */
  const finishPress = useCallback((): void => {
    clearPress();
    pressStart.current = null;
  }, [clearPress]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (locked) return;
    if (event.pointerType === 'mouse') {
      // Правый клик — флажок; остальные кнопки мыши игнорируем.
      if (event.button === 2) {
        onFlag(cell.index);
        return;
      }
      if (event.button !== 0) return;
    }

    consumed.current = false;
    pressStart.current = { x: event.clientX, y: event.clientY };
    clearPress();

    /*
     * Страховка на уровне окна: если жест перехватит браузер (выделение текста,
     * контекстное меню, вызов системы), событие может не дойти до самой клетки.
     * Тогда таймер удержания остался бы висеть и поставил флажок «сам»,
     * а клетка — залипнуть в нажатом виде.
     */
    window.addEventListener('pointerup', finishPress, { once: true });
    window.addEventListener('pointercancel', finishPress, { once: true });

    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      consumed.current = true;
      // Удержание на телефоне запускает выделение текста: гасим его, иначе
      // браузер остаётся в режиме выделения и перестаёт пропускать тапы.
      window.getSelection()?.removeAllRanges();
      onFlag(cell.index);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const start = pressStart.current;
    if (start === null) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > MOVE_TOLERANCE_PX) {
      clearPress();
      pressStart.current = null;
    }
  };

  const handlePointerEnd = (): void => {
    finishPress();
  };

  const isRevealed = cell.state === 'revealed';
  const isFlagged = cell.state === 'flagged';

  const classes = ['cell'];
  if (isRevealed) classes.push('cell--open');
  if (isFlagged) classes.push('cell--flagged');
  if (cell.exploded) classes.push('cell--exploded');
  if (isRevealed && !cell.hasMine) classes.push('cell--safe');
  // Подсветка подсказки: статичный тон (работает и при reduced motion)
  // плюс пульсация отдельным классом.
  if (hinted && cell.state === 'hidden') classes.push('cell--hinted');
  if (animation !== null) classes.push(`cell--anim-${animation.kind}`);

  const digit =
    isRevealed && !cell.hasMine && cell.adjacentMines > 0 ? String(cell.adjacentMines) : '';

  return (
    <button
      type="button"
      className={classes.join(' ')}
      style={animation === null ? undefined : { animationDelay: `${animation.delayMs}ms` }}
      data-state={cell.state}
      data-digit={digit}
      data-mine={cell.hasMine}
      data-exploded={cell.exploded}
      aria-label={cellLabel(cell)}
      /*
       * `disabled` только на замороженном поле: у отключённой кнопки браузер
       * не спрашивает нас про контекстное меню, и на телефоне всплывает
       * выделение текста. Открытые клетки просто помечаем aria-disabled —
       * повторный тап по ним всё равно ничего не делает (редьюсер вернёт то же
       * состояние), зато жест остаётся под нашим контролем.
       */
      disabled={locked}
      aria-disabled={locked || isRevealed}
      draggable={false}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onDragStart={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        // Долгое нажатие уже поставило флажок — повторно открывать нельзя.
        if (consumed.current) {
          consumed.current = false;
          return;
        }
        onReveal(cell.index);
      }}
      onContextMenu={(event) => {
        // Контекстное меню перекрывает поле, а на Android всплывает при удержании.
        event.preventDefault();
      }}
    >
      <span className="cell__content">{cellContent(cell)}</span>
    </button>
  );
});
