/**
 * Коллекция фигур: карточки пройденных уровней.
 *
 * Показывается только то, что игрок уже открыл: силуэт фигуры, название,
 * оценка и лучшее время. Закрытые уровни — карточки-заглушки со знаком вопроса,
 * чтобы было видно, сколько ещё осталось собрать.
 */

import type { ReactElement } from 'react';
import { PatternPreview } from '../components/PatternPreview';
import { ScreenShell } from '../components/ScreenShell';
import { Stars } from '../components/Stars';
import { LockIcon, QuestionIcon } from '../components/icons';
import { formatClock } from '../game/clock';
import { LEVEL_PATTERNS, patternMineCount } from '../game/patterns';
import { bestTimeFor } from '../game/stats';
import type { Stats } from '../game/types';

export interface CollectionScreenProps {
  readonly campaignLevel: number;
  readonly levelStars: Readonly<Record<string, number>>;
  readonly stats: Stats;
  readonly onBack: () => void;
  readonly onPlay: (level: number) => void;
}

export function CollectionScreen({
  campaignLevel,
  levelStars,
  stats,
  onBack,
  onPlay,
}: CollectionScreenProps): ReactElement {
  const total = LEVEL_PATTERNS.length;
  const collected = LEVEL_PATTERNS.filter((_unused, index) => index + 1 < campaignLevel).length;
  const bestTime = bestTimeFor(stats, 'campaign');

  return (
    <ScreenShell
      title="Коллекция"
      subtitle={`Собрано ${collected} из ${total}`}
      onBack={onBack}
    >
      <div className="progress progress--big" aria-hidden="true">
        <span className="progress__fill" style={{ width: `${(collected / total) * 100}%` }} />
      </div>
      <p className="note">
        Каждая фигура открывается, когда уровень пройден. Оценка показывает, насколько
        чисто он взят: три звезды — без подсказок и в пределах времени узла.
        {bestTime === null ? '' : ` Лучшее время кампании — ${formatClock(bestTime)}.`}
      </p>

      <ul className="collection">
        {LEVEL_PATTERNS.map((pattern, index) => {
          const level = index + 1;
          const done = level < campaignLevel;
          const current = level === campaignLevel;
          const earned = levelStars[String(level)] ?? 0;
          const state = done ? 'done' : current ? 'current' : 'locked';

          return (
            <li key={pattern.title} className={`card is-${state}`}>
              <button
                type="button"
                className="card__pick"
                disabled={!done && !current}
                onClick={() => {
                  onPlay(level);
                }}
              >
                <span className="card__art">
                  {done ? (
                    <PatternPreview art={pattern.art} />
                  ) : current ? (
                    <QuestionIcon size={22} />
                  ) : (
                    <LockIcon size={18} />
                  )}
                </span>
                <span className="card__title">{pattern.title}</span>
                <span className="card__meta">
                  {level}. {patternMineCount(pattern)} мин
                </span>
                <Stars earned={earned} size={12} />
              </button>
            </li>
          );
        })}
      </ul>
    </ScreenShell>
  );
}
