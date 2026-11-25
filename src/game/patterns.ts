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
 * Готовые фигуры: собираются формулой, а не рисуются руками.
 *
 * Геометрические узоры дают много уровней без риска «нечитаемой» картинки,
 * а стартовая зона вырезается автоматически — вокруг `S` мин не бывает.
 */
function shape(
  title: string,
  mineAt: (row: number, col: number) => boolean,
  start: readonly [number, number] = [8, 1],
): LevelPattern {
  const [startRow, startCol] = start;
  const rows: string[] = [];

  for (let row = 0; row < PATTERN_ROWS; row += 1) {
    let line = '';
    for (let col = 0; col < PATTERN_COLS; col += 1) {
      const nearStart = Math.abs(row - startRow) <= 1 && Math.abs(col - startCol) <= 1;
      if (row === startRow && col === startCol) line += START_CHAR;
      else line += !nearStart && mineAt(row, col) ? MINE_CHAR : EMPTY_CHAR;
    }
    rows.push(line);
  }

  return { title, art: rows };
}

/** Расстояние до центра поля по Чебышёву (квадратные кольца). */
const ring = (row: number, col: number): number =>
  Math.max(Math.abs(row - 4), Math.abs(col - 4));

/** Расстояние до центра по манхэттену (ромбы). */
const diamond = (row: number, col: number): number =>
  Math.abs(row - 4) + Math.abs(col - 4);

const GENERATED_PATTERNS: readonly LevelPattern[] = [
  shape('Рамка', (row, col) => ring(row, col) === 2, [8, 1]),
  shape('Ромб-кольцо', (row, col) => diamond(row, col) === 3, [8, 1]),
  shape('Крест-Х', (row, col) => row === col || row + col === PATTERN_COLS - 1, [8, 4]),
  shape('Волны', (row, col) => (row + col) % 4 === 0, [8, 1]),
  shape('Полосы', (row) => row % 4 === 1, [8, 4]),
  shape('Шахматы', (row, col) => (row + col) % 2 === 0 && ring(row, col) <= 2, [8, 1]),
  shape(
    'Снежинка',
    (row, col) =>
      ring(row, col) <= 2 &&
      (row === 4 || col === 4 || Math.abs(row - 4) === Math.abs(col - 4)),
    [8, 1],
  ),
  shape('Точки', (row, col) => row % 2 === 1 && col % 2 === 1, [8, 4]),
  shape('Соты', (row, col) => (row + 2 * col) % 5 === 0, [8, 1]),
  shape('Уголки', (row, col) => (row <= 1 || row >= 7) && (col <= 1 || col >= 7), [4, 4]),
  shape('Зигзаг', (row, col) => col === 4 - (row % 4) || col === 4 + (row % 4), [8, 1]),
  shape('Диагонали', (row, col) => (row - col + PATTERN_ROWS) % 5 === 0, [4, 4]),
  shape('Косые', (row, col) => (row + col) % 5 === 0, [8, 4]),
  shape('Квадраты', (row, col) => row % 4 === 0 && col % 4 === 0, [8, 1]),
  shape('Треугольник', (row, col) => Math.abs(col - 4) === 3 - Math.min(row, 3), [8, 1]),
  shape('Воронка', (row, col) => Math.abs(col - 4) === Math.min(row, 4), [8, 1]),
  shape('Штрихи', (row, col) => row % 3 !== 0 && col % 3 === 0, [8, 1]),
  shape('Лучи', (row, col) => (row === 4 || col === 4) && diamond(row, col) % 2 === 0, [8, 1]),
];

/** Дорисованные вручную фигуры: животные, предметы, символы. */
const FIGURES: readonly LevelPattern[] = [
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
  {
    title: 'Молния',
    art: [
      '...##....',
      '..##.....',
      '.##......',
      '...##....',
      '..##.....',
      '.##......',
      '##.......',
      '.........',
      '....S....',
    ],
  },
  {
    title: 'Месяц',
    art: [
      '..####...',
      '.#.......',
      '#........',
      '#........',
      '#........',
      '.#.......',
      '..####...',
      '.........',
      '....S....',
    ],
  },
  {
    title: 'Якорь',
    art: [
      '....#....',
      '...#.#...',
      '....#....',
      '..#####..',
      '....#....',
      '....#....',
      '.#..#..#.',
      '..##.##..',
      'S........',
    ],
  },
  {
    title: 'Зонт',
    art: [
      '...###...',
      '.#.....#.',
      '#.......#',
      '....#....',
      '....#....',
      '....#....',
      '...#.....',
      '.........',
      '....S....',
    ],
  },
  {
    title: 'Гриб',
    art: [
      '..#####..',
      '.#.....#.',
      '.........',
      '...###...',
      '...###...',
      '.........',
      '.........',
      '.........',
      '....S....',
    ],
  },
  {
    title: 'Кубок',
    art: [
      '..#####..',
      '.#.....#.',
      '.#.....#.',
      '..#...#..',
      '...#.#...',
      '....#....',
      '...###...',
      '.........',
      '....S....',
    ],
  },
];

/**
 * Порядок кампании.
 *
 * Сложность в целом растёт (она равна числу мин в фигуре), но не монотонно:
 * лёгкие фигуры попадаются и дальше — после тяжёлого уровня нужен передых.
 * Список задаётся названиями: опечатка падает с понятной ошибкой, а тест
 * проверяет, что все фигуры использованы ровно по разу.
 */
const CAMPAIGN_ORDER: readonly string[] = [
  // Разминка: 8–14 мин, фигуры читаются с первого взгляда.
  'Крест', // 9
  'Квадраты', // 8
  'Зонт', // 11
  'Птица', // 11
  'Лучи', // 9
  'Стрелка', // 11
  'Ромб', // 12
  'Ромб-кольцо', // 12
  'Треугольник', // 12
  'Гриб', // 13
  'Месяц', // 13
  'Шахматы', // 13
  'Кораблик', // 13
  'Точки', // 14
  // «Спина» кампании: 15 и больше, но с передыхами — после трёх-четырёх
  // плотных уровней идёт фигура на 14 мин.
  'Воронка', // 15
  'Соты', // 15
  'Зигзаг', // 14 — передых
  'Косые', // 15
  'Домик', // 15
  'Ёлка', // 15
  'Ракета', // 15
  'Молния', // 14 — передых
  'Танк', // 15
  'Флаг', // 15
  'Ключ', // 16
  'Корона', // 14 — передых
  'Рамка', // 16
  'Уголки', // 16
  'Штрихи', // 16
  'Крест-Х', // 17
  'Диагонали', // 14 — передых
  // Финал: самые плотные поля.
  'Кубок', // 17
  'Рыбка', // 17
  'Сердце', // 17
  'Снежинка', // 17
  'Кошка', // 18
  'Полосы', // 18
  'Череп', // 18
  'Якорь', // 18
  'Волны', // 19
];

/** Все нарисованные и сгенерированные фигуры вместе. */
export const ALL_PATTERNS: readonly LevelPattern[] = [...FIGURES, ...GENERATED_PATTERNS];

/** Кампания в порядке прохождения. */
export const LEVEL_PATTERNS: readonly LevelPattern[] = CAMPAIGN_ORDER.map((title) => {
  const pattern = ALL_PATTERNS.find((item) => item.title === title);
  if (pattern === undefined) throw new Error(`Фигура «${title}» не найдена`);
  return pattern;
});

/** Сколько уровней идут с фигурами. */
export const PATTERN_LEVELS = LEVEL_PATTERNS.length;

/** Сколько вариантов отражения фигуры. */
export const PATTERN_VARIANTS = 4;

/**
 * Отражение/поворот фигуры.
 *
 * Нужен против заучивания: после проигрыша поле раскрывается, и при повторной
 * попытке с той же раскладкой игрок просто знал бы, где мины. Поэтому каждая
 * попытка получает свой вариант — фигура та же, а расположение другое.
 * Отражения сохраняют свободную зону вокруг старта, так что проверять ничего
 * дополнительно не нужно.
 */
export function variantPattern(pattern: LevelPattern, variant: number): LevelPattern {
  const mode = ((Math.trunc(variant) % PATTERN_VARIANTS) + PATTERN_VARIANTS) % PATTERN_VARIANTS;
  if (mode === 0) return pattern;

  const mirrored = pattern.art.map((row) => [...row].reverse().join(''));
  if (mode === 1) return { ...pattern, art: mirrored };
  if (mode === 2) return { ...pattern, art: [...pattern.art].reverse() };
  return { ...pattern, art: [...mirrored].reverse() };
}

/** Фигура уровня или `null`, если уровень идёт со случайной расстановкой. */
export function patternForLevel(level: number): LevelPattern | null {
  if (!Number.isFinite(level)) return null;
  const index = Math.floor(level) - 1;
  return LEVEL_PATTERNS[index] ?? null;
}

/** Фигура уровня в конкретном варианте отражения. */
export function patternForAttempt(level: number, seed: number): LevelPattern | null {
  const pattern = patternForLevel(level);
  if (pattern === null) return null;
  return variantPattern(pattern, seed);
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
