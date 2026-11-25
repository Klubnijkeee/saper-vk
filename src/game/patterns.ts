/**
 * Фигуры уровней кампании.
 *
 * Каждый уровень — не случайная россыпь мин, а фигура: рыбка, танк, ёлка и так
 * далее. Фигура описана ASCII-артом 9×9, где `#` — мина, `.` — пусто,
 * `S` — точка старта (тоже пусто). Вокруг `S` всегда свободная зона 3×3:
 * игра сама открывает её при входе на уровень, поэтому первый ход игрока
 * никогда не бывает «вслепую».
 *
 * Фигуры отличаются числом мин — это и есть сложность. Уровни идут по
 * возрастанию, а дальше кампания продолжается обычной случайной расстановкой.
 */

import type { LevelConfig } from './types';

/** Размер фигуры: совпадает с полем кампании. */
export const PATTERN_ROWS = 9;
export const PATTERN_COLS = 9;

/** Символы арта. */
export const MINE_CHAR = '#';
export const EMPTY_CHAR = '.';
export const START_CHAR = 'S';

/** Одна фигура уровня. */
export interface LevelPattern {
  readonly title: string;
  /** Ровно `PATTERN_ROWS` строк по `PATTERN_COLS` символов. */
  readonly art: readonly string[];
}

/**
 * Кампания: 16 фигур по возрастанию числа мин.
 *
 * Порядок = порядок прохождения. После последней фигуры уровни идут
 * со случайной расстановкой (и растёт число мин).
 */
export const LEVEL_PATTERNS: readonly LevelPattern[] = [
  {
    title: 'Крест',
    art: [
      '.........',
      '....#....',
      '....#....',
      '..#####..',
      '....#....',
      '....#....',
      '.........',
      '.........',
      '..S......',
    ],
  },
  {
    title: 'Птица',
    art: [
      '.........',
      '.##...##.',
      '#..#.#..#',
      '...#.#...',
      '....#....',
      '.........',
      '.........',
      '.........',
      '..S......',
    ],
  },
  {
    title: 'Стрелка',
    art: [
      '....#....',
      '...###...',
      '..#####..',
      '....#....',
      '....#....',
      '.........',
      '.........',
      '.........',
      '......S..',
    ],
  },
  {
    title: 'Ромб',
    art: [
      '....#....',
      '...#.#...',
      '..#...#..',
      '.#.....#.',
      '..#...#..',
      '...#.#...',
      '....#....',
      '.........',
      '..S......',
    ],
  },
  {
    title: 'Кораблик',
    art: [
      '....#....',
      '...###...',
      '...###...',
      '....#....',
      '.........',
      '.#####...',
      '.........',
      '.........',
      '..S......',
    ],
  },
  {
    title: 'Корона',
    art: [
      '#...#...#',
      '#.#.#.#.#',
      '#.......#',
      '#.......#',
      '#.......#',
      '.........',
      '.........',
      '.........',
      '....S....',
    ],
  },
  {
    title: 'Ракета',
    art: [
      '....#....',
      '...###...',
      '...###...',
      '...###...',
      '..#.#.#..',
      '..#...#..',
      '.........',
      '.........',
      '...S.....',
    ],
  },
  {
    title: 'Ёлка',
    art: [
      '....#....',
      '...###...',
      '..#...#..',
      '...###...',
      '..#...#..',
      '.#.....#.',
      '....#....',
      '....#....',
      'S........',
    ],
  },
  {
    title: 'Домик',
    art: [
      '....#....',
      '...###...',
      '..#.#.#..',
      '.#.....#.',
      '#.......#',
      '#.......#',
      '#.......#',
      '.........',
      '..S......',
    ],
  },
  {
    title: 'Танк',
    art: [
      '.........',
      '......##.',
      '...####..',
      '..#####..',
      '.#.....#.',
      '.#.....#.',
      '.........',
      '.........',
      '...S.....',
    ],
  },
  {
    title: 'Флаг',
    art: [
      '...#..#..',
      '...#.###.',
      '...#.####',
      '...#.....',
      '...#.....',
      '...#.....',
      '...#.....',
      '.........',
      'S........',
    ],
  },
  {
    title: 'Ключ',
    art: [
      '..###....',
      '.#...#...',
      '.#...#...',
      '..###....',
      '....#....',
      '....#....',
      '....#.#..',
      '....##...',
      '........S',
    ],
  },
  {
    title: 'Сердце',
    art: [
      '.##...##.',
      '#..#.#..#',
      '#.......#',
      '.#.....#.',
      '..#...#..',
      '...#.#...',
      '....#....',
      '.........',
      'S........',
    ],
  },
  {
    title: 'Рыбка',
    art: [
      '...##....',
      '..#..#...',
      '.#....##.',
      '#......##',
      '.#....##.',
      '..#..#...',
      '...##....',
      '.........',
      'S........',
    ],
  },
  {
    title: 'Череп',
    art: [
      '..#####..',
      '.#.....#.',
      '#.#...#.#',
      '#.......#',
      '.#..#..#.',
      '..#...#..',
      '.........',
      '.........',
      '....S....',
    ],
  },
  {
    title: 'Кошка',
    art: [
      '#.......#',
      '##.....##',
      '#.......#',
      '#.......#',
      '#.#...#.#',
      '.#.....#.',
      '..#...#..',
      '.........',
      'S........',
    ],
  },
];

/** Сколько уровней идут с фигурами. */
export const PATTERN_LEVELS = LEVEL_PATTERNS.length;

/** Фигура уровня или `null`, если уровень идёт со случайной расстановкой. */
export function patternForLevel(level: number): LevelPattern | null {
  if (!Number.isFinite(level)) return null;
  const index = Math.floor(level) - 1;
  return LEVEL_PATTERNS[index] ?? null;
}

/** Символ в позиции арта. */
function charAt(pattern: LevelPattern, row: number, col: number): string {
  return pattern.art[row]?.[col] ?? EMPTY_CHAR;
}

/** Индексы мин фигуры в координатах поля. */
export function patternMineCells(
  pattern: LevelPattern,
  config: LevelConfig,
): readonly number[] {
  const result: number[] = [];
  for (let row = 0; row < Math.min(PATTERN_ROWS, config.rows); row += 1) {
    for (let col = 0; col < Math.min(PATTERN_COLS, config.cols); col += 1) {
      if (charAt(pattern, row, col) === MINE_CHAR) result.push(row * config.cols + col);
    }
  }
  return result;
}

/** Сколько мин в фигуре. */
export function patternMineCount(pattern: LevelPattern): number {
  return pattern.art.reduce(
    (sum, row) => sum + [...row].filter((char) => char === MINE_CHAR).length,
    0,
  );
}

/**
 * Точка старта. Если `S` в арте нет (или их несколько) — берём первую клетку,
 * вокруг которой свободна зона 3×3.
 */
export function patternStartCell(pattern: LevelPattern, config: LevelConfig): number {
  const marked: number[] = [];
  for (let row = 0; row < PATTERN_ROWS; row += 1) {
    for (let col = 0; col < PATTERN_COLS; col += 1) {
      if (charAt(pattern, row, col) === START_CHAR) marked.push(row * config.cols + col);
    }
  }

  const first = marked.find((index) => isZoneFree(pattern, config, index));
  if (first !== undefined) return first;

  // Страховка: ищем любую свободную зону 3×3.
  for (let row = 0; row < config.rows; row += 1) {
    for (let col = 0; col < config.cols; col += 1) {
      const index = row * config.cols + col;
      if (isZoneFree(pattern, config, index)) return index;
    }
  }

  return 0;
}

/** Свободна ли зона 3×3 вокруг клетки от мин фигуры. */
export function isZoneFree(pattern: LevelPattern, config: LevelConfig, index: number): boolean {
  const row = Math.floor(index / config.cols);
  const col = index % config.cols;
  for (let dRow = -1; dRow <= 1; dRow += 1) {
    for (let dCol = -1; dCol <= 1; dCol += 1) {
      const r = row + dRow;
      const c = col + dCol;
      if (r < 0 || r >= config.rows || c < 0 || c >= config.cols) continue;
      if (charAt(pattern, r, c) === MINE_CHAR) return false;
    }
  }
  return true;
}

/**
 * Проверка арта: размеры, символы, старт и свободная зона вокруг него.
 * Возвращает список проблем — пустой список означает корректную фигуру.
 * Используется тестами: опечатка в арте не должна доехать до игрока.
 */
export function validatePattern(pattern: LevelPattern): readonly string[] {
  const problems: string[] = [];
  const config: LevelConfig = { rows: PATTERN_ROWS, cols: PATTERN_COLS, mines: 0 };

  if (pattern.art.length !== PATTERN_ROWS) {
    problems.push(`строк ${pattern.art.length}, а нужно ${PATTERN_ROWS}`);
  }

  pattern.art.forEach((row, index) => {
    if (row.length !== PATTERN_COLS) {
      problems.push(`строка ${index}: ${row.length} символов вместо ${PATTERN_COLS}`);
    }
    for (const char of row) {
      if (char !== MINE_CHAR && char !== EMPTY_CHAR && char !== START_CHAR) {
        problems.push(`строка ${index}: неизвестный символ «${char}»`);
      }
    }
  });

  const starts = pattern.art.reduce(
    (sum, row) => sum + [...row].filter((char) => char === START_CHAR).length,
    0,
  );
  if (starts !== 1) problems.push(`точек старта ${starts}, а нужна ровно одна`);

  const startIndex = patternStartCell(pattern, config);
  if (!isZoneFree(pattern, config, startIndex)) {
    problems.push('вокруг старта нет свободной зоны 3×3');
  }

  const mines = patternMineCount(pattern);
  if (mines < 8 || mines > 20) {
    problems.push(`мин ${mines}: уровень должен быть в диапазоне 8..20`);
  }

  return problems;
}
