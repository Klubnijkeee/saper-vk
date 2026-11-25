/**
 * Карта кампании.
 *
 * Уровни идут змеевиком, как тропа; вокруг — трава, камни и звёзды, чтобы карта
 * не выглядела пустой. В узле показывается силуэт поля-фигуры — но только
 * у пройденных уровней: у текущего и будущих стоит замок или вопрос.
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
import { parTimeMs } from '../game/stats';

/** Шаг между узлами по вертикали, px. */
const NODE_SPACING = 104;
/** Логическая ширина карты: к ней привязаны и SVG, и позиции узлов. */
const MAP_WIDTH = 360;
/** Отступ сверху до первого узла. */
const TOP_PAD = 56;

export interface LevelMapScreenProps {
  /** Следующий уровень кампании: он же «текущий» на карте. */
  readonly campaignLevel: number;
  readonly levelStars: Readonly<Record<string, number>>;
  readonly onBack: () => void;
  /** Начать уровень (перепрохождение разрешено для пройденных). */
  readonly onPlay: (level: number) => void;
  /** Открыть коллекцию фигур. */
  readonly onCollection: () => void;
}

/** Узел карты: точка на «тропе». */
interface MapNode {
  readonly level: number;
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly mines: number;
  readonly shape: LevelShape | null;
}

/** Украшение вдоль тропы. */
interface Decor {
  readonly kind: 'tree' | 'rock' | 'star';
  readonly x: number;
  readonly y: number;
}

const DECOR_KINDS = ['tree', 'rock', 'star'] as const;

/**
 * Координаты узлов. Змеевик считается от индекса, поэтому карта всегда
 * выглядит одинаково и не зависит от размеров экрана.
 */
function buildNodes(): readonly MapNode[] {
  const total = SHAPE_LEVEL_COUNT + 1;
  const nodes: MapNode[] = [];

  for (let index = 0; index < total; index += 1) {
    const level = index + 1;
    const shape = LEVEL_SHAPES[index] ?? null;
    nodes.push({
      level,
      x: MAP_WIDTH / 2 + Math.sin(index * 0.85) * (MAP_WIDTH * 0.26),
      y: TOP_PAD + index * NODE_SPACING,
      title: shape?.title ?? 'Дальше',
      mines: shape === null ? 15 : shapeMines(shape),
      shape,
    });
  }

  return nodes;
}

const NODES = buildNodes();
const MAP_HEIGHT = TOP_PAD * 2 + (NODES.length - 1) * NODE_SPACING;

/** Украшения ставим между узлами, поочерёдно слева и справа от тропы. */
const DECOR: readonly Decor[] = NODES.flatMap((node, index) => {
  if (index === 0) return [];
  return [
    {
      kind: DECOR_KINDS[index % DECOR_KINDS.length] ?? 'tree',
      x: node.x + (index % 2 === 0 ? 46 : -46),
      y: node.y - NODE_SPACING / 2,
    },
  ];
});

/** Ломаная через узлы: сначала пройденная часть, потом оставшаяся. */
function pathThrough(nodes: readonly MapNode[]): string {
  return nodes
    .map((node, index) => `${index === 0 ? 'M' : 'L'} ${node.x.toFixed(1)} ${node.y}`)
    .join(' ');
}

/** Дерево, камень или звезда — мелкое украшение карты. */
function Decoration({ kind }: { readonly kind: Decor['kind'] }): ReactElement {
  if (kind === 'tree') {
    return (
      <svg className="map__decor" viewBox="0 0 12 14" aria-hidden="true">
        <path d="M6 1l4 6H2z" fill="currentColor" opacity="0.75" />
        <path d="M6 5l4.6 6.4H1.4z" fill="currentColor" />
        <path d="M5.4 11h1.2v2.6H5.4z" fill="currentColor" opacity="0.6" />
      </svg>
    );
  }

  if (kind === 'rock') {
    return (
      <svg className="map__decor" viewBox="0 0 14 10" aria-hidden="true">
        <path d="M1 9l3-6 3 2 2-4 4 8z" fill="currentColor" opacity="0.7" />
      </svg>
    );
  }

  return (
    <svg className="map__decor" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 0l1.6 4.4L12 6l-4.4 1.6L6 12 4.4 7.6 0 6l4.4-1.6z" fill="currentColor" />
    </svg>
  );
}

export function LevelMapScreen({
  campaignLevel,
  levelStars,
  onBack,
  onPlay,
  onCollection,
}: LevelMapScreenProps): ReactElement {
  const doneStars = Object.values(levelStars).reduce((sum, value) => sum + value, 0);
  const collected = Math.min(Math.max(0, campaignLevel - 1), SHAPE_LEVEL_COUNT);
  const currentIndex = NODES.findIndex((node) => node.level === campaignLevel);
  const splitAt = currentIndex < 0 ? NODES.length : currentIndex + 1;

  return (
    <ScreenShell
      title="Прохождение"
      subtitle={`Уровень ${campaignLevel} из ${SHAPE_LEVEL_COUNT} · звёзд за уровни: ${doneStars}`}
      onBack={onBack}
    >
      <button type="button" className="map__collection" onClick={onCollection}>
        <span className="map__collection-art" aria-hidden="true">
          <QuestionIcon size={18} />
        </span>
        <span className="map__collection-text">
          <span className="map__collection-title">Коллекция фигур</span>
          <span className="map__collection-meta">
            собрано {collected} из {SHAPE_LEVEL_COUNT}
          </span>
        </span>
      </button>

      <div className="progress progress--big" aria-hidden="true">
        <span
          className="progress__fill"
          style={{ width: `${(collected / SHAPE_LEVEL_COUNT) * 100}%` }}
        />
      </div>

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

        {DECOR.map((decor, index) => (
          <span
            key={`decor-${index}`}
            className={`map__prop map__prop--${decor.kind}`}
            style={{ left: `${(decor.x / MAP_WIDTH) * 100}%`, top: `${decor.y}px` }}
          >
            <Decoration kind={decor.kind} />
          </span>
        ))}

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
                unlocked ? `Уровень ${node.level}: ${node.title}` : `Уровень ${node.level} закрыт`
              }
            >
              <span className="map-node__disc">
                {node.shape === null ? (
                  <span className="map-node__endless">∞</span>
                ) : done ? (
                  <ShapePreview
                    mask={shapeMask(node.shape)}
                    rows={shapeRows(node.shape)}
                    cols={shapeCols(node.shape)}
                  />
                ) : current ? (
                  <QuestionIcon size={22} />
                ) : (
                  <LockIcon size={20} />
                )}
              </span>
              <span className="map-node__label">
                {node.shape === null
                  ? 'Дальше'
                  : `${node.level}. ${node.title}`}
              </span>
              <span className="map-node__meta">
                {node.shape === null ? 'без фигуры' : `${node.mines} мин`}
                {current ? ` · ${formatClock(parTimeMs(node.mines))}` : ''}
              </span>
              <Stars earned={earned} size={13} />
            </button>
          );
        })}
      </div>

      <p className="note">
        Поле уровня — это и есть фигура: клетки стоят только внутри силуэта. Первый ход
        всегда безопасен, а мины расставляются заново при каждой попытке, поэтому заучить
        раскладку нельзя. Три звезды дают за победу без подсказок и в пределах времени
        на узле. После последней фигуры кампания продолжается случайными полями.
      </p>
    </ScreenShell>
  );
}
