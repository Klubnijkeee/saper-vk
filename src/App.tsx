/**
 * Приложение: навигация между экранами и общая обвязка.
 *
 * Своего роутера нет специально: экранов мало, история ВК не нужна,
 * а лишняя зависимость тут ничего не даёт. Вся логика партии — в `useGame`.
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { initAudio } from './audio/sfx';
import { Toast } from './components/Toast';
import { DEV_BRIDGE_ENABLED } from './dev';
import { isModeId } from './game/modes';
import { findTheme } from './game/themes';
import type { ModeId, ScreenId, ThemeId } from './game/types';
import { useGame } from './game/useGame';
import { useToast } from './hooks/useToast';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HowToPlayScreen } from './screens/HowToPlayScreen';
import { LevelMapScreen } from './screens/LevelMapScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StatsScreen } from './screens/StatsScreen';
import { ThemesScreen } from './screens/ThemesScreen';
import { vkPersistence } from './vk/storage';

/** Сколько ждать перед показом обучающего экрана: сначала должен прийти прогресс. */
const TUTORIAL_DELAY_MS = 900;

/** Все экраны — для проверки параметра `?screen=`. */
const SCREENS: readonly ScreenId[] = [
  'home',
  'game',
  'map',
  'stats',
  'achievements',
  'themes',
  'records',
  'settings',
  'howto',
];

/** Есть ли сценарий для скриншотов (`?dev=...`). В этом случае стартуем сразу с поля. */
function devScenario(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('dev');
}

/** Параметры запуска: `?dev=` — сценарий партии, `?screen=` — открыть раздел. */
function queryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** Стартовый экран: игровое поле для сценариев, иначе — меню (или явно заданный раздел). */
function initialScreen(): ScreenId {
  if (devScenario() !== null) return 'game';
  if (!DEV_BRIDGE_ENABLED) return 'home';

  const requested = queryParam('screen');
  if (requested !== null && (SCREENS as readonly string[]).includes(requested)) {
    return requested as ScreenId;
  }
  return 'home';
}

/** Режим из ссылки: нужен только для скриншотов больших полей. */
function initialMode(): ModeId | null {
  if (!DEV_BRIDGE_ENABLED) return null;
  const requested = queryParam('mode');
  if (requested === null || !isModeId(requested)) return null;
  return requested;
}

export default function App(): ReactElement {
  const {
    state,
    reveal,
    toggleFlagAt,
    applyHintAt,
    reset,
    startMode,
    nextLevel,
    pause,
    resume,
    toggleSound,
    toggleVibration,
    markTutorialSeen,
    setTheme,
    buyTheme,
  } = useGame({}, vkPersistence);
  const { toast, showToast } = useToast();

  const [screen, setScreen] = useState<ScreenId>(initialScreen);
  /** Дата для задач дня: обновляем при переходе в меню, чтобы день менялся без перезагрузки. */
  const [now, setNow] = useState<number>(() => Date.now());

  const stateRef = useRef(state);
  stateRef.current = state;

  // Отладочный режим: `?mode=professional` открывает большое поле сразу.
  useEffect(() => {
    const mode = initialMode();
    if (mode !== null) startMode(mode);
  }, [startMode]);

  const openScreen = useCallback((next: ScreenId): void => {
    setNow(Date.now());
    setScreen(next);
  }, []);

  const backHome = useCallback((): void => {
    openScreen('home');
  }, [openScreen]);

  // Оформление: палитра темы лежит в CSS, здесь только переключаем атрибут.
  useEffect(() => {
    document.documentElement.dataset['theme'] = state.meta.themeId;
  }, [state.meta.themeId]);

  // Первый запуск: показываем «Как играть», когда прогресс уже загружен.
  useEffect(() => {
    if (state.meta.tutorialSeen || devScenario() !== null) return undefined;
    const timer = window.setTimeout(() => {
      setScreen((current) => (current === 'home' ? 'howto' : current));
    }, TUTORIAL_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state.meta.tutorialSeen]);

  const handlePlay = useCallback(
    (mode: ModeId): void => {
      startMode(mode);
      openScreen('game');
    },
    [startMode, openScreen],
  );

  /** Запуск конкретного уровня кампании с карты (перепрохождение разрешено). */
  const handlePlayLevel = useCallback(
    (level: number): void => {
      startMode('campaign', level);
      openScreen('game');
    },
    [startMode, openScreen],
  );

  const handleThemeBuy = useCallback(
    (theme: ThemeId): void => {
      const preset = findTheme(theme);
      if (stateRef.current.meta.stars < preset.price) {
        showToast('Не хватает звёзд — открывайте достижения');
        return;
      }
      buyTheme(theme);
      showToast(`Тема «${preset.title}» открыта`);
    },
    [buyTheme, showToast],
  );

  return (
    <div className="app" onPointerDownCapture={initAudio}>
      {screen === 'home' ? (
        <HomeScreen
          meta={state.meta}
          coins={state.coins}
          now={now}
          onPlay={handlePlay}
          onOpen={openScreen}
        />
      ) : null}

      {screen === 'map' ? (
        <LevelMapScreen
          campaignLevel={state.meta.campaignLevel}
          levelStars={state.meta.levelStars}
          onBack={backHome}
          onPlay={handlePlayLevel}
        />
      ) : null}

      {screen === 'game' ? (
        <GameScreen
          state={state}
          onReveal={reveal}
          onFlag={toggleFlagAt}
          onHint={applyHintAt}
          onPause={pause}
          onResume={resume}
          onRestart={reset}
          onNextLevel={nextLevel}
          onExit={backHome}
          onToggleSound={toggleSound}
          showToast={showToast}
        />
      ) : null}

      {screen === 'stats' ? <StatsScreen stats={state.meta.stats} onBack={backHome} /> : null}

      {screen === 'records' ? <RecordsScreen stats={state.meta.stats} onBack={backHome} /> : null}

      {screen === 'achievements' ? (
        <AchievementsScreen
          stats={state.meta.stats}
          level={state.level}
          achievements={state.meta.achievements}
          themeId={state.meta.themeId}
          onBack={backHome}
        />
      ) : null}

      {screen === 'themes' ? (
        <ThemesScreen
          themeId={state.meta.themeId}
          unlockedThemes={state.meta.unlockedThemes}
          stars={state.meta.stars}
          onBack={backHome}
          onSelect={setTheme}
          onBuy={handleThemeBuy}
        />
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen
          soundEnabled={state.soundEnabled}
          vibrationEnabled={state.meta.vibrationEnabled}
          onBack={backHome}
          onToggleSound={toggleSound}
          onToggleVibration={toggleVibration}
          onOpenHowTo={() => {
            openScreen('howto');
          }}
        />
      ) : null}

      {screen === 'howto' ? (
        <HowToPlayScreen
          onBack={() => {
            markTutorialSeen();
            backHome();
          }}
        />
      ) : null}

      {toast === null ? null : <Toast key={toast.id} text={toast.text} />}
    </div>
  );
}
