/**
 * Карта кампании.
 *
 * Уровни идут змеевиком, как тропа: каждый узел — фигура уровня (силуэт мин
 * виден прямо в узле), звёзды под ним — лучшая оценка. Пройденные узлы открыты
 * для перепрохождения, будущие закрыты замком.
 */

import type { ReactElement } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { Stars } from '../components/Stars';
import { LockIcon } from '../components/icons';
import {
  LEVEL_PATTERNS,
  PATTERN_COLS,
  PATTERN_LEVELS,
  PATTERN_ROWS,
  MINE_CHAR,
  patternMineCount,
} from '../game/patterns';
import { parTimeMs } from '../game/stats';
import { formatClock } from '../game/clock';

/** Шаг между узлами по вертикали, px. */
const NODE_SPACING = 104;
/** Логическая ширина карты: к ней привязаны и SVG, и позиции узлов. */
const MAP_WIDTH = 360;
/** Отступ сверху до первого узла. */
const TOP_PAD = 52;

export interface LevelMapScreenProps {
  /** Следующий уровень кампании: он же «текущий» на карте. */
  readonly campaignLevel: number;
  readonly levelStars: Readonly<Record<string, number>>;
  readonly onBack: () => void;
  /** Начать уровень (перепрохождение разрешено для пройденных). */
  readonly onPlay: (level: number) => void;
}

/** Узел карты: точка на «тропе». */
interface MapNode {
  readonly level: number;
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly mines: number;
  readonly art: readonly string[] | null;
}

/**
 * Координаты узлов. Змеевик считается от индекса, поэтому карта всегда
 * выглядит одинаково и не зависит от размеров экрана.
 */
function buildNodes(): readonly MapNode[] {
  const total = PATTERN_LEVELS + 1;
  const nodes: MapNode[] = [];

  for (let index = 0; index < total; index += 1) {
    const level = index + 1;
    const pattern = LEVEL_PATTERNS[index];
    nodes.push({
      level,
      x: MAP_WIDTH / 2 + Math.sin(index * 0.85) * (MAP_WIDTH * 0.26),
      y: TOP_PAD + index * NODE_SPACING,
      title: pattern?.title ?? 'Дальше',
      mines: pattern === undefined ? 15 : patternMineCount(pattern),
      art: pattern?.art ?? null,
    });
  }

  return nodes;
}

const NODES = buildNodes();
const MAP_HEIGHT = TOP_PAD * 2 + (NODES.length - 1) * NODE_SPACING;

/** Ломаная через узлы: сначала пройденная часть, потом оставшаяся. */
function pathThrough(nodes: readonly MapNode[]): string {
  return nodes
    .map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.x.toFixed(1)} ${node.y}`)
    .join(' ');
}

/** Силуэт фигуры: мина — закрашенный квадратик сетки 9×9. */
function PatternPreview({ art }: { readonly art: readonly string[] }): ReactElement {
  return (
    <svg
      className="map-node__preview"
      viewBox={`0 0 ${PATTERN_COLS} ${PATTERN_ROWS}`}
      aria-hidden="true"
    >
      {art.flatMap((row, rowIndex) =>
        [...row].map((char, colIndex) =>
          char === MINE_CHAR ? (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex}
              y={rowIndex}
              width="1"
              height="1"
              rx="0.22"
              fill="currentColor"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}

export function LevelMapScreen({
  campaignLevel,
  levelStars,
  onBack,
  onPlay,
}: LevelMapScreenProps): ReactElement {
  const doneStars = Object.values(levelStars).reduce((sum, value) => sum + value, 0);
  const currentIndex = NODES.findIndex((node) => node.level === campaignLevel);
  const splitAt = currentIndex < 0 ? NODES.length : currentIndex + 1;

  return (
    <ScreenShell
      title="Прохождение"
      subtitle={`Уровень ${campaignLevel} · звёзд за уровни: ${doneStars}`}
      onBack={onBack}
    >
      <div className="map" style={{ height: `${MAP_HEIGHT}px` }}>
        <svg
          className="map__path"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className="map__track" d={pathThrough(NODES)} />
          <path className="map__track map__track--done" d={pathThrough(NODES.slice(0, splitAt))} />
        </svg>

        {NODES.map((node) => {
          const unlocked = node.level <= campaignLevel;
          const done = node.level < campaignLevel;
          const current = node.level === campaignLevel;
          const earned = levelStars[String(node.level)] ?? 0;
          const state = done ? 'done' : current ? 'current' : 'locked';

          return (
            <button
              key={node.level}
              type="button"
              className={`map-node is-${state}`}
              style={{ left: `${(node.x / MAP_WIDTH) * 100}%`, top: `${node.y}px` }}
              disabled={!unlocked}
              onClick={() => {
                onPlay(node.level);
              }}
              aria-label={
                unlocked
                  ? `Уровень ${node.level}: ${node.title}`
                  : `Уровень ${node.level} закрыт`
              }
            >
              <span className="map-node__disc">
                {node.art === null || !unlocked ? (
                  <LockIcon size={20} />
                ) : (
                  <PatternPreview art={node.art} />
                )}
              </span>
              <span className="map-node__label">
                {node.level === PATTERN_LEVELS + 1 ? 'Дальше' : `${node.level}. ${node.title}`}
              </span>
              <span className="map-node__meta">
                {node.art === null ? '∞' : `${node.mines} мин`}
                {current ? ` · ${formatClock(parTimeMs(node.mines))}` : ''}
              </span>
              <Stars earned={earned} size={13} />
            </button>
          );
        })}
      </div>

      <p className="note">
        Фигуры — это расстановка мин: пройдёшь уровень, и увидишь её целиком. Первый ход
        всегда безопасен: игра сразу открывает стартовую зону. Три звезды дают за победу
        без подсказок и в пределах времени на узле.
      </p>
    </ScreenShell>
  );
}
