/**
 * Композиция экрана: TopBar, поле, строка статуса, панель магазина, модалки и тост.
 *
 * Вся логика партии — в `useGame`. Здесь только раскладка и реакции на события:
 * какой тост показать, какую модалку открыть, что делать по «Назад».
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { initAudio } from './audio/sfx';
import { Board } from './components/Board';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import { ShopBar } from './components/ShopBar';
import { StatusBar } from './components/StatusBar';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { remainingMines } from './game/reveal';
import { canAfford, findShopItem, hasHintTarget, isShopAvailable } from './game/shop';
import type { GameState, ShopItemId } from './game/types';
import { useGame } from './game/useGame';
import { useToast } from './hooks/useToast';
import { vkPersistence } from './vk/storage';

/**
 * Отладочный мост для dev-сборки: позволяет ручному сценарию (и скрипту
 * скриншотов) довести партию до нужного состояния. В production не существует —
 * ветка вырезается сборщиком по `import.meta.env`.
 */
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
}

declare global {
  interface Window {
    __SAPER__?: SaperDevBridge;
  }
}

/** Мост существует только в dev или в сборке с VITE_DEV_BRIDGE=1 (для скриншотов). */
const DEV_BRIDGE_ENABLED = import.meta.env.DEV || import.meta.env.VITE_DEV_BRIDGE === '1';

export default function App(): ReactElement {
  const { state, reveal, toggleFlagAt, applyHintAt, reset, nextLevel, pause, resume, toggleSound } =
    useGame({}, vkPersistence);
  const { toast, showToast } = useToast();

  /** Игрок закрыл экран результата, чтобы посмотреть поле. */
  const [peeking, setPeeking] = useState(false);

  // Актуальное состояние для колбэков и dev-моста (без пересоздания замыканий).
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

      // До первого клика мин ещё нет — подсказывать нечего.
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

      applyHintAt(id);
      showToast(item.appliedMessage);
    },
    [applyHintAt, showToast],
  );

  const handleCellTap = useCallback(
    (index: number): void => {
      if (stateRef.current.paused) return;
      reveal(index);
    },
    [reveal],
  );

  // Мост для ручной проверки и скриншотов (только dev/preview-сборка).
  useEffect(() => {
    if (!DEV_BRIDGE_ENABLED) return undefined;

    const revealAllSafe = (): void => {
      if (!stateRef.current.minesPlaced) reveal(40);
      window.setTimeout(() => {
        for (const cell of stateRef.current.board) {
          if (!cell.hasMine && cell.state === 'hidden') reveal(cell.index);
        }
      }, 60);
    };

    const revealMine = (): void => {
      if (!stateRef.current.minesPlaced) reveal(40);
      window.setTimeout(() => {
        const mine = stateRef.current.board.find((cell) => cell.hasMine && cell.state === 'hidden');
        if (mine !== undefined) reveal(mine.index);
      }, 60);
    };

    window.__SAPER__ = {
      getState: () => stateRef.current,
      reveal,
      win: revealAllSafe,
      lose: revealMine,
      pause,
      peek: () => {
        setPeeking(true);
      },
      nextLevel,
      toggleSound,
      applyHint: applyHintAt,
    };

    return () => {
      delete window.__SAPER__;
    };
  }, [reveal, pause, nextLevel, toggleSound, applyHintAt]);

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
          if (target !== undefined) toggleFlagAt(target.index);
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
      // Нужно, чтобы монет хватало на все подсказки сразу.
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
  }, [reveal, toggleFlagAt]);

  return (
    <div className="app" onPointerDownCapture={initAudio}>
      <TopBar
        level={state.level}
        elapsedMs={state.clock.elapsedMs}
        bestTime={state.bestTime}
        paused={state.paused}
        onBack={pause}
        onPause={state.paused ? resume : pause}
      />

      <main className="app__main">
        <Board state={state} onReveal={handleCellTap} onFlag={toggleFlagAt} />
        <StatusBar mines={remainingMines(state)} flags={state.flags} coins={state.coins} />
      </main>

      <ShopBar coins={state.coins} canUse={isShopAvailable(state)} onBuy={handleBuy} />

      {state.paused ? (
        <PauseModal
          level={state.level}
          coins={state.coins}
          elapsedMs={state.clock.elapsedMs}
          bestTime={state.bestTime}
          soundEnabled={state.soundEnabled}
          onResume={resume}
          onRestart={reset}
          onToggleSound={toggleSound}
        />
      ) : null}

      {showResult ? (
        <GameOverModal
          status={state.status === 'won' ? 'won' : 'lost'}
          level={state.level}
          elapsedMs={state.clock.elapsedMs}
          bestTime={state.bestTime}
          onNextLevel={nextLevel}
          onRestart={reset}
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

      {toast !== null ? <Toast key={toast.id} text={toast.text} /> : null}
    </div>
  );
}
