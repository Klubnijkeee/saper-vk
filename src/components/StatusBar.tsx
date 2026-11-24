/**
 * Строка статуса под полем: мины, флажки и монеты.
 *
 * Классический счётчик сапёра: без него непонятно, сколько мин ещё на поле
 * (особенно после подсказки «Убрать мину», которая меняет их число).
 * Монеты показываем здесь, а не в TopBar, чтобы не дублировать одно число.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { CoinIcon, FlagIcon, MineIcon } from './icons';

export interface StatusBarProps {
  /** Сколько мин сейчас на поле. */
  readonly mines: number;
  /** Сколько флажков стоит. */
  readonly flags: number;
  readonly coins: number;
}

export function StatusBar({ mines, flags, coins }: StatusBarProps): ReactElement {
  // Подсветка счётчика монет при начислении — заметная обратная связь на каждый ход.
  const [bump, setBump] = useState(false);
  const previousCoins = useRef(coins);
  useEffect(() => {
    if (coins === previousCoins.current) return undefined;
    previousCoins.current = coins;
    setBump(true);
    const timer = window.setTimeout(() => {
      setBump(false);
    }, 420);
    return () => {
      window.clearTimeout(timer);
    };
  }, [coins]);

  return (
    <div className="statusbar">
      <span className="statusbar__item">
        <MineIcon size={12} />
        <span className="statusbar__label">Мин:</span>
        <span className="statusbar__value">{mines}</span>
      </span>

      <span className="statusbar__item">
        <FlagIcon size={12} />
        <span className="statusbar__label">Флажков:</span>
        <span className="statusbar__value">{flags}</span>
      </span>

      <span className="statusbar__item statusbar__item--coins">
        <CoinIcon size={12} />
        <span className="statusbar__label">Монет:</span>
        <span className={`statusbar__value${bump ? ' is-bump' : ''}`}>{coins}</span>
      </span>
    </div>
  );
}
