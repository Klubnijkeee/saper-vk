/**
 * Коллекция фигур: карточки пройденных уровней.
 *
 * Показывается силуэт поля — то, что игрок уже открыл: фигура, оценка и номер
 * уровня. Закрытые уровни — карточки-заглушки, чтобы было видно, сколько
 * фигур ещё осталось.
 */

import type { ReactElement } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { ShapePreview } from '../components/ShapePreview';
import { Stars } from '../components/Stars';
import { LockIcon, QuestionIcon } from '../components/icons';
import { formatClock } from '../game/clock';
import {
  LEVEL_SHAPES,
  SHAPE_LEVEL_COUNT,
  shapeCols,
  shapeMask,
  shapeMines,
  shapeRows,
  type LevelShape,
} from '../game/shapes';
import { bestTimeFor } from '../game/stats';
import type { Stats } from '../game/types';

export interface CollectionScreenProps {
  readonly campaignLevel: number;
  readonly levelStars: Readonly<Record<string, number>>;
  readonly stats: Stats;
  readonly onBack: () => void;
  readonly onPlay: (level: number) => void;
}

/** Карточка-превью фигуры. */
function ShapeArt({ shape }: { readonly shape: LevelShape }): ReactElement {
  return (
    <ShapePreview
      mask={shapeMask(shape)}
      rows={shapeRows(shape)}
      cols={shapeCols(shape)}
    />
  );
}

export function CollectionScreen({
  campaignLevel,
  levelStars,
  stats,
  onBack,
  onPlay,
}: CollectionScreenProps): ReactElement {
  const collected = Math.min(Math.max(0, campaignLevel - 1), SHAPE_LEVEL_COUNT);
  const bestTime = bestTimeFor(stats, 'campaign');

  return (
    <ScreenShell
      title="Коллекция"
      subtitle={`Собрано ${collected} из ${SHAPE_LEVEL_COUNT}`}
      onBack={onBack}
    >
      <div className="progress progress--big" aria-hidden="true">
        <span
          className="progress__fill"
          style={{ width: `${(collected / SHAPE_LEVEL_COUNT) * 100}%` }}
        />
      </div>
      <p className="note">
        Каждый уровень — поле в форме фигуры. Собранные открыты целиком, у остальных
        виден только замок. Оценка показывает, насколько чисто взят уровень: три звезды —
        без подсказок и в пределах времени узла.
        {bestTime === null ? '' : ` Лучшее время кампании — ${formatClock(bestTime)}.`}
      </p>

      <ul className="collection">
        {LEVEL_SHAPES.map((shape, index) => {
          const level = index + 1;
          const done = level < campaignLevel;
          const current = level === campaignLevel;
          const earned = levelStars[String(level)] ?? 0;
          const state = done ? 'done' : current ? 'current' : 'locked';

          return (
            <li key={shape.title} className={`card is-${state}`}>
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
                    <ShapeArt shape={shape} />
                  ) : current ? (
                    <QuestionIcon size={22} />
                  ) : (
                    <LockIcon size={18} />
                  )}
                </span>
                <span className="card__title">{shape.title}</span>
                <span className="card__meta">
                  {level}. {shapeMines(shape)} мин
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
