/**
 * Игровой экран: панель, поле со строкой статуса, магазин подсказок и модалки.
 *
 * Здесь же живёт отладочный мост `window.__SAPER__` — он нужен скриптам
 * скриншотов и включается только в dev/preview-сборке.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { Board } from '../components/Board';
import { GameOverModal } from '../components/GameOverModal';
import { PauseModal } from '../components/PauseModal';
import { ShopBar } from '../components/ShopBar';
import { StatusBar } from '../components/StatusBar';
import { TopBar } from '../components/TopBar';
import { DEV_BRIDGE_ENABLED } from '../dev';
import { configForMode, isCampaign } from '../game/modes';
import { remainingMines } from '../game/reveal';
import { bestTimeFor } from '../game/stats';
import { canAfford, findShopItem, hasHintTarget, isShopAvailable } from '../game/shop';
import type { GameState, ShopItemId } from '../game/types';

export interface GameScreenProps {
  readonly state: GameState;
  readonly onReveal: (index: number) => void;
  readonly onFlag: (index: number) => void;
  /** Применить подсказку (проверки — внутри экрана). */
  readonly onHint: (id: ShopItemId) => void;
  readonly onPause: () => void;
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onNextLevel: () => void;
  readonly onExit: () => void;
  readonly onToggleSound: () => void;
  readonly showToast: (text: string) => void;
}

/** Мост существует только в dev или в сборке с VITE_DEV_BRIDGE=1. */
interface SaperDevBridge {
  readonly getState: () => GameState;
  readonly reveal: (index: number) => void;
  readonly win: () => void;
  readonly lose: () => void;
  readonly pause: () => void;
  readonly peek: () => void;
  readonly nextLevel: () => void;
  readonly toggleSound: () => void;
  readonly applyHint: (hint: ShopItemId) => void;
  readonly exit: () => void;
}

declare global {
  interface Window {
    __SAPER__?: SaperDevBridge;
  }
}

/** Переменная числа колонок: тип CSSProperties её не знает, поэтому расширяем. */
type GameStyle = CSSProperties & { readonly '--cols': number };

export function GameScreen({
  state,
  onReveal,
  onFlag,
  onHint,
  onPause,
  onResume,
  onRestart,
  onNextLevel,
  onExit,
  onToggleSound,
  showToast,
}: GameScreenProps): ReactElement {
  /** Игрок закрыл экран результата, чтобы посмотреть поле. */
  const [peeking, setPeeking] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  const isGameOver = state.status === 'won' || state.status === 'lost';
  const showResult = isGameOver && !peeking;

  // Новая партия — снова показываем экран результата, когда она закончится.
  useEffect(() => {
    if (!isGameOver && peeking) setPeeking(false);
  }, [isGameOver, peeking]);

  const handleBuy = useCallback(
    (id: ShopItemId): void => {
      const current = stateRef.current;
      if (current.paused || current.status === 'won' || current.status === 'lost') return;

      if (!isShopAvailable(current)) {
        showToast('Сначала откройте любую клетку');
        return;
      }

      const item = findShopItem(id);
      if (!canAfford(current.coins, item)) {
        showToast('Не хватает монет');
        return;
      }
      if (!hasHintTarget(current, id)) {
        showToast(item.emptyMessage);
        return;
      }

      onHint(id);
      showToast(item.appliedMessage);
    },
    [onHint, showToast],
  );

  const handleCellTap = useCallback(
    (index: number): void => {
      if (stateRef.current.paused) return;
      onReveal(index);
    },
    [onReveal],
  );

  // Мост для ручной проверки и скриншотов (только dev/preview-сборка).
  useEffect(() => {
    if (!DEV_BRIDGE_ENABLED) return undefined;

    const revealAllSafe = (): void => {
      if (!stateRef.current.minesPlaced) onReveal(40);
      window.setTimeout(() => {
        for (const cell of stateRef.current.board) {
          if (!cell.hasMine && cell.state === 'hidden') onReveal(cell.index);
        }
      }, 60);
    };

    const revealMine = (): void => {
      if (!stateRef.current.minesPlaced) onReveal(40);
      window.setTimeout(() => {
        const mine = stateRef.current.board.find((cell) => cell.hasMine && cell.state === 'hidden');
        if (mine !== undefined) onReveal(mine.index);
      }, 60);
    };

    window.__SAPER__ = {
      getState: () => stateRef.current,
      reveal: onReveal,
      win: revealAllSafe,
      lose: revealMine,
      pause: onPause,
      peek: () => {
        setPeeking(true);
      },
      nextLevel: onNextLevel,
      toggleSound: onToggleSound,
      applyHint: onHint,
      exit: onExit,
    };

    return () => {
      delete window.__SAPER__;
    };
  }, [onReveal, onPause, onNextLevel, onToggleSound, onHint, onExit]);

  // Сценарии для скриншотов (только dev/preview-сборка):
  // play | flag | lose | lose-peek | win | win-peek | pause | shop-all
  // | hint-show | hint-remove | sound-off
  useEffect(() => {
    if (!DEV_BRIDGE_ENABLED) return undefined;
    const scenario = new URLSearchParams(window.location.search).get('dev');
    if (scenario === null) return undefined;

    /** Небольшой «реальный» игровой отрезок — чтобы таймер и рекорд были не нулевыми. */
    const PLAY_MS = 2600;

    const later = (action: () => void, delayMs: number): number =>
      window.setTimeout(action, delayMs);

    const timer = later(() => {
      const bridge = window.__SAPER__;
      if (bridge === undefined) return;

      if (scenario === 'play') bridge.reveal(40);

      if (scenario === 'pause') {
        bridge.reveal(40);
        later(() => {
          bridge.pause();
        }, 1400);
      }

      if (scenario === 'flag') {
        bridge.reveal(40);
        later(() => {
          const target = stateRef.current.board.find(
            (cell) => cell.state === 'hidden' && cell.adjacentMines > 0,
          );
          if (target !== undefined) onFlag(target.index);
        }, 120);
      }

      if (scenario === 'lose' || scenario === 'lose-peek') {
        bridge.reveal(40);
        later(() => {
          bridge.lose();
          if (scenario === 'lose-peek') {
            later(() => {
              bridge.peek();
            }, 700);
          }
        }, PLAY_MS);
      }

      if (scenario === 'win' || scenario === 'win-peek') {
        bridge.reveal(40);
        later(() => {
          bridge.win();
          if (scenario === 'win-peek') {
            later(() => {
              bridge.peek();
            }, 900);
          }
        }, PLAY_MS);
      }

      // «Богатое» состояние: победа → следующий уровень → ход.
      if (scenario === 'shop-all' || scenario === 'hint-show' || scenario === 'hint-remove') {
        bridge.reveal(40);
        later(() => {
          bridge.win();
          later(() => {
            bridge.nextLevel();
            later(() => {
              bridge.reveal(40);
              if (scenario === 'hint-show' || scenario === 'hint-remove') {
                later(() => {
                  bridge.applyHint(scenario === 'hint-show' ? 'show-mine' : 'remove-mine');
                }, 1250);
              }
            }, 300);
          }, 350);
        }, PLAY_MS);
      }

      if (scenario === 'sound-off') {
        bridge.reveal(40);
        later(() => {
          bridge.toggleSound();
          later(() => {
            bridge.pause();
          }, 150);
        }, 900);
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [onReveal, onFlag]);

  const campaign = isCampaign(state.mode);
  const modeConfig = configForMode(state.mode, state.level);
  const modeLabel = campaign
    ? `Уровень ${state.level}`
    : `Поле ${modeConfig.cols}×${modeConfig.rows}`;
  const modeCaption = campaign
    ? `Поле ${modeConfig.cols}×${modeConfig.rows}`
    : `${modeConfig.mines} мин`;

  return (
    <div className="game" style={{ '--cols': modeConfig.cols } as GameStyle}>
      <TopBar
        modeLabel={modeLabel}
        modeCaption={modeCaption}
        elapsedMs={state.clock.elapsedMs}
        record={bestTimeFor(state.meta.stats, state.mode)}
        paused={state.paused}
        onBack={onPause}
        onPause={state.paused ? onResume : onPause}
      />

      <main className="app__main">
        <Board state={state} onReveal={handleCellTap} onFlag={onFlag} />
        <StatusBar mines={remainingMines(state)} flags={state.flags} coins={state.coins} />
      </main>

      <ShopBar coins={state.coins} canUse={isShopAvailable(state)} onBuy={handleBuy} />

      {state.paused ? (
        <PauseModal
          modeLabel={modeLabel}
          coins={state.coins}
          elapsedMs={state.clock.elapsedMs}
          bestTime={bestTimeFor(state.meta.stats, state.mode)}
          soundEnabled={state.soundEnabled}
          onResume={onResume}
          onRestart={onRestart}
          onToggleSound={onToggleSound}
          onExit={onExit}
        />
      ) : null}

      {showResult ? (
        <GameOverModal
          status={state.status === 'won' ? 'won' : 'lost'}
          campaign={campaign}
          modeLabel={modeLabel}
          elapsedMs={state.clock.elapsedMs}
          bestTime={bestTimeFor(state.meta.stats, state.mode)}
          onNextLevel={onNextLevel}
          onRestart={onRestart}
          onExit={onExit}
          onDismiss={() => {
            setPeeking(true);
          }}
        />
      ) : null}

      {isGameOver && peeking ? (
        <button
          type="button"
          className="peek-chip"
          onClick={() => {
            setPeeking(false);
          }}
        >
          Показать результат
        </button>
      ) : null}
    </div>
  );
}
