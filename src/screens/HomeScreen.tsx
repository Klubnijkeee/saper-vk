/**
 * Хаб: то, что игрок видит при запуске.
 *
 * Кампания крупной карточкой, рядом — свободная игра по сложностям,
 * ниже задачи дня и сетка разделов (рекорды, темы, достижения, статистика,
 * «как играть», настройки).
 */

import type { ReactElement } from 'react';
import { Hearts } from '../components/Hearts';
import { formatClock } from '../game/clock';
import { ACHIEVEMENTS } from '../game/achievements';
import { dailyProgress, dailyTasksFor, dateKey } from '../game/daily';
import { MODES, configForMode } from '../game/modes';
import { SHAPE_LEVEL_COUNT } from '../game/shapes';
import { bestTimeFor, winRate } from '../game/stats';
import { useNow } from '../hooks/useNow';
import type { LevelConfig, MetaState, ModeId, ModeIconId, ScreenId } from '../game/types';
import {
  ChartIcon,
  CheckIcon,
  ChevronRightIcon,
  CoinIcon,
  CrownIcon,
  GearIcon,
  GridIcon,
  MapIcon,
  PaletteIcon,
  QuestionIcon,
  SparkIcon,
  StarIcon,
  TrophyIcon,
} from '../components/icons';

const MODE_ICONS: Readonly<Record<ModeIconId, (props: { size?: number }) => ReactElement>> = {
  map: MapIcon,
  star: StarIcon,
  grid: GridIcon,
  crown: CrownIcon,
  spark: SparkIcon,
};

export interface HomeScreenProps {
  readonly meta: MetaState;
  readonly coins: number;
  readonly onPlay: (mode: ModeId) => void;
  readonly onOpen: (screen: ScreenId) => void;
  /** Купить жизнь за звёзды. */
  readonly onBuyLife: () => void;
}

export function HomeScreen({
  meta,
  coins,
  onPlay,
  onOpen,
  onBuyLife,
}: HomeScreenProps): ReactElement {
  // Секундный тик нужен для обратного отсчёта жизней и задач дня.
  const now = useNow(1000);
  const key = dateKey(now);
  const tasks = dailyTasksFor(key);
  const doneTasks = tasks.filter(
    (task) => task.measure(meta.daily.counters) >= task.goal,
  ).length;
  const unlocked = meta.achievements.length;
  const level = meta.campaignLevel;
  const campaignConfig: LevelConfig = configForMode('campaign', level);
  const campaignRecord = bestTimeFor(meta.stats, 'campaign');
  const levelStars = Object.values(meta.levelStars).reduce((sum, value) => sum + value, 0);
  const collected = Math.min(Math.max(0, level - 1), SHAPE_LEVEL_COUNT);
  const freeModes = MODES.filter((mode) => mode.id !== 'campaign');
  const rate = Math.round(winRate(meta.stats) * 100);

  return (
    <div className="screen screen--home">
      <header className="hub__top">
        <div className="hub__brand">
          <h1 className="hub__title">Сапёр</h1>
          <p className="hub__subtitle">Магазин подсказок</p>
        </div>
        <div className="hub__wallet">
          <span className="wallet-chip" title="Монеты">
            <CoinIcon size={15} />
            {coins}
          </span>
          <span className="wallet-chip wallet-chip--star" title="Звёзды">
            <StarIcon size={14} />
            {meta.stars}
          </span>
        </div>
      </header>

      <div className="hub__lives">
        <Hearts
          lives={meta.lives}
          updatedAt={meta.livesAt}
          now={now}
          stars={meta.stars}
          onBuy={onBuyLife}
        />
      </div>

      <div className="screen__body hub__body">
        <button type="button" className="hero" onClick={() => onOpen('map')}>
          <span className="hero__icon" aria-hidden="true">
            <MapIcon size={30} />
          </span>
          <span className="hero__text">
            <span className="hero__eyebrow">Кампания · карта уровней</span>
            <span className="hero__title">Уровень {level}</span>
            <span className="hero__subtitle">
              Поле {campaignConfig.rows}×{campaignConfig.cols} · {campaignConfig.mines} мин
              {levelStars === 0 ? '' : ` · ★ ${levelStars}`}
              {campaignRecord === null ? '' : ` · рекорд ${formatClock(campaignRecord)}`}
            </span>
          </span>
          <span className="hero__go">Карта</span>
        </button>

        <section className="panel">
          <header className="panel__head">
            <h2 className="panel__title">Задачи дня</h2>
            <span className="panel__meta">
              {doneTasks} из {tasks.length}
            </span>
          </header>
          <ul className="daily">
            {tasks.map((task) => {
              const progress = dailyProgress(task, meta.daily.counters);
              const current = Math.min(task.goal, task.measure(meta.daily.counters));
              const complete = progress >= 1;
              return (
                <li key={task.id} className={`daily__item${complete ? ' is-done' : ''}`}>
                  <span className="daily__check" aria-hidden="true">
                    {complete ? <CheckIcon size={14} /> : null}
                  </span>
                  <span className="daily__text">
                    <span className="daily__title">{task.title}</span>
                    <span className="progress" aria-hidden="true">
                      <span className="progress__fill" style={{ width: `${progress * 100}%` }} />
                    </span>
                  </span>
                  <span className="daily__reward">
                    <StarIcon size={12} />
                    {task.stars}
                  </span>
                  <span className="daily__count">
                    {complete ? 'готово' : `${current} из ${task.goal}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel">
          <header className="panel__head">
            <h2 className="panel__title">Свободная игра</h2>
            <span className="panel__meta">{meta.stats.gamesPlayed} партий</span>
          </header>
          <div className="modes">
            {freeModes.map((mode) => {
              const ModeIcon = MODE_ICONS[mode.icon];
              const record = bestTimeFor(meta.stats, mode.id);
              const config = configForMode(mode.id, level);
              return (
                <button
                  key={mode.id}
                  type="button"
                  className="mode-card"
                  onClick={() => onPlay(mode.id)}
                >
                  <span className="mode-card__icon" aria-hidden="true">
                    <ModeIcon size={26} />
                  </span>
                  <span className="mode-card__title">{mode.title}</span>
                  <span className="mode-card__subtitle">
                    {config.cols}×{config.rows} · {config.mines} мин
                  </span>
                  <span className="mode-card__record">
                    {record === null ? 'без рекорда' : formatClock(record)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel panel--stats">
          <div className="stat-strip">
            <span className="stat-strip__item">
              <strong>{meta.stats.wins}</strong>
              побед
            </span>
            <span className="stat-strip__item">
              <strong>{rate}%</strong>
              винрейт
            </span>
            <span className="stat-strip__item">
              <strong>{meta.stats.bestStreak}</strong>
              серия
            </span>
          </div>
        </section>

        <nav className="tiles">
          <button type="button" className="tile" onClick={() => onOpen('records')}>
            <span className="tile__icon">
              <TrophyIcon size={22} />
            </span>
            <span className="tile__label">Рекорды</span>
          </button>
          <button type="button" className="tile" onClick={() => onOpen('achievements')}>
            <span className="tile__icon">
              <StarIcon size={22} />
            </span>
            <span className="tile__label">Достижения</span>
            <span className="tile__badge">
              {unlocked}/{ACHIEVEMENTS.length}
            </span>
          </button>
          <button type="button" className="tile" onClick={() => onOpen('collection')}>
            <span className="tile__icon">
              <SparkIcon size={22} />
            </span>
            <span className="tile__label">Коллекция</span>
            <span className="tile__badge">
              {collected}/{SHAPE_LEVEL_COUNT}
            </span>
          </button>
          <button type="button" className="tile" onClick={() => onOpen('themes')}>
            <span className="tile__icon">
              <PaletteIcon size={22} />
            </span>
            <span className="tile__label">Темы</span>
            <span className="tile__badge">{meta.unlockedThemes.length}</span>
          </button>
          <button type="button" className="tile" onClick={() => onOpen('stats')}>
            <span className="tile__icon">
              <ChartIcon size={22} />
            </span>
            <span className="tile__label">Статистика</span>
          </button>
          <button type="button" className="tile" onClick={() => onOpen('social')}>
            <span className="tile__icon">
              <CrownIcon size={22} />
            </span>
            <span className="tile__label">Друзья и рейтинг</span>
          </button>
          <button type="button" className="tile" onClick={() => onOpen('howto')}>
            <span className="tile__icon">
              <QuestionIcon size={22} />
            </span>
            <span className="tile__label">Как играть</span>
          </button>
          <button type="button" className="tile" onClick={() => onOpen('settings')}>
            <span className="tile__icon">
              <GearIcon size={22} />
            </span>
            <span className="tile__label">Настройки</span>
          </button>
        </nav>

        <p className="hub__hint">
          <ChevronRightIcon size={14} /> Прогресс сохраняется в вашем профиле ВКонтакте
        </p>
      </div>
    </div>
  );
}
