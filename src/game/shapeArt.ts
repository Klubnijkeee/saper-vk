/**
 * Данные фигур: буквы, цифры, геометрия и рисованные силуэты.
 *
 * Маска задаётся строками: `#` — клетка поля, `.` — пустота (там клетки нет).
 * Поле уровня — это и есть фигура, поэтому её видно с первого взгляда, а мины
 * расставляются внутри маски уже после первого клика.
 *
 * Всё данные, без логики: сборкой каталога занимается `shapes.ts`.
 */

/** Прямоугольная маска фигуры. */
export interface ShapeArt {
  readonly title: string;
  readonly art: readonly string[];
  /** Доля мин от числа клеток фигуры — это и есть сложность. */
  readonly density: number;
}

/** Разбор компактной записи: строки разделены `/`. */
function rows(spec: string): readonly string[] {
  return spec.split('/');
}

/**
 * Шрифт 5×7: буквы и цифры.
 *
 * Каждая буква — 7 строк по 5 символов, записанных через `/`. Из них
 * собираются уровни «Буква А», «Цифра 7» и так далее: игрок открывает поле
 * в форме буквы.
 */
export const FONT_5X7: Readonly<Record<string, readonly string[]>> = {
  А: rows('.###./#...#/#...#/#####/#...#/#...#/#...#'),
  Б: rows('#####/#..../#..../####./#...#/#...#/####.'),
  В: rows('####./#...#/#...#/####./#...#/#...#/####.'),
  Г: rows('#####/#..../#..../#..../#..../#..../#....'),
  Д: rows('..##./.#.#./.#.#./.#.#./.#.#./#####/#...#'),
  Е: rows('#####/#..../#..../####./#..../#..../#####'),
  Ж: rows('#.#.#/#.#.#/#.#.#/#####/#.#.#/#.#.#/#.#.#'),
  З: rows('.###./#...#/....#/..##./....#/#...#/.###.'),
  И: rows('#...#/#...#/#..##/#.#.#/##..#/#...#/#...#'),
  К: rows('#...#/#..#./#.#../##.../#.#../#..#./#...#'),
  Л: rows('.####/.#..#/.#..#/.#..#/.#..#/.#..#/##..#'),
  М: rows('#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#'),
  Н: rows('#...#/#...#/#...#/#####/#...#/#...#/#...#'),
  О: rows('.###./#...#/#...#/#...#/#...#/#...#/.###.'),
  П: rows('#####/#...#/#...#/#...#/#...#/#...#/#...#'),
  Р: rows('####./#...#/#...#/####./#..../#..../#....'),
  С: rows('.###./#...#/#..../#..../#..../#...#/.###.'),
  Т: rows('#####/..#../..#../..#../..#../..#../..#..'),
  У: rows('#...#/#...#/#...#/.####/....#/...#./.##..'),
  Ф: rows('..#../.###./#.#.#/#.#.#/#.#.#/.###./..#..'),
  Х: rows('#...#/#...#/.#.#./..#../.#.#./#...#/#...#'),
  Ц: rows('#..#./#..#./#..#./#..#./#..#./#..#./#####'),
  Ч: rows('#...#/#...#/#...#/.####/....#/....#/....#'),
  Ш: rows('#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#####'),
  Щ: rows('#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#####/....#'),
  Ъ: rows('##.../.#.../.#.../.###./.#..#/.#..#/.###.'),
  Ы: rows('#..#./#..#./#..#./###.#/#..##/#..#./###.#'),
  Ь: rows('#..../#..../#..../####./#...#/#...#/####.'),
  Э: rows('.###./#...#/....#/..###/....#/#...#/.###.'),
  Ю: rows('#.##./#.#.#/#.#.#/#.#.#/#.#.#/#.#.#/#.##.'),
  Я: rows('.####/#...#/#...#/.####/..#.#/.#..#/#...#'),
  '0': rows('.###./#...#/#..##/#.#.#/##..#/#...#/.###.'),
  '1': rows('..#../.##../..#../..#../..#../..#../.###.'),
  '2': rows('.###./#...#/....#/...#./..#../.#.../#####'),
  '3': rows('####./....#/....#/.###./....#/....#/####.'),
  '4': rows('#..#./#..#./#..#./#####/...#./...#./...#.'),
  '5': rows('#####/#..../####./....#/....#/#...#/.###.'),
  '6': rows('..##./.#.../#..../####./#...#/#...#/.###.'),
  '7': rows('#####/....#/...#./..#../.#.../.#.../.#...'),
  '8': rows('.###./#...#/#...#/.###./#...#/#...#/.###.'),
  '9': rows('.###./#...#/#...#/.####/....#/...#./.##..'),
};

/** Геометрическая фигура, заданная условием на координаты. */
export interface GeometricSpec {
  readonly title: string;
  readonly size: number;
  /** Ширина в клетках; по умолчанию равна `size`. */
  readonly width?: number;
  readonly density: number;
  /** Центр фигуры в координатах маски. */
  readonly allowed: (row: number, col: number, height: number, width: number) => boolean;
}

const half = (size: number): number => (size - 1) / 2;

/** Круг радиуса `k` от центра. */
const circle = (k: number, filled = true) => (row: number, col: number, h: number, w: number) => {
  const distance = Math.hypot(row - half(h), col - half(w));
  return filled ? distance <= k : Math.abs(distance - k) < 0.8;
};

/** Ромб: сумма расстояний по осям. */
const diamond = (k: number, filled = true) => (row: number, col: number, h: number, w: number) => {
  const distance = Math.abs(row - half(h)) + Math.abs(col - half(w));
  return filled ? distance <= k : Math.abs(distance - k) < 0.7;
};

/** Квадратное кольцо по Чебышёву. */
const squareRing = (k: number) => (row: number, col: number, h: number, w: number) =>
  Math.abs(Math.max(Math.abs(row - half(h)), Math.abs(col - half(w))) - k) < 0.6;

/** Многоугольник-звезда: лучи от центра. */
const star = (points: number, inner: number, outer: number) =>
  (row: number, col: number, h: number, w: number) => {
    const dy = row - half(h);
    const dx = col - half(w);
    const radius = Math.hypot(dy, dx);
    const angle = Math.atan2(dy, dx) + Math.PI;
    const step = (Math.PI * 2) / points;
    const phase = (angle % step) / step;
    const limit = inner + (outer - inner) * (1 - Math.abs(phase * 2 - 1));
    return radius <= limit;
  };

/** Полоса под углом: `(row * dy + col * dx) % period` без остатка. */
const stripe = (period: number, offset: number, factor: number) =>
  (row: number, col: number) => (row * factor + col * (period - factor) + offset) % period === 0;

/** Шахматная заливка внутри радиуса. */
const checker = (k: number) => (row: number, col: number, h: number, w: number) =>
  (row + col) % 2 === 0 && Math.hypot(row - half(h), col - half(w)) <= k;

/** Концентрические кольца. */
const rings = (step: number) => (row: number, col: number, h: number, w: number) =>
  Math.round(Math.hypot(row - half(h), col - half(w))) % step === 0;

/** Треугольник вершиной вверх. */
const triangle = (row: number, col: number, h: number, w: number) =>
  Math.abs(col - half(w)) <= (row / (h - 1)) * half(w);

/** Трапеция. */
const trapezoid = (row: number, col: number, h: number, w: number) =>
  Math.abs(col - half(w)) <= half(w) * (0.4 + (0.6 * row) / (h - 1));

/** Волна: синусоидальные полосы. */
const wave = (amplitude: number) => (row: number, col: number, h: number, w: number) =>
  Math.abs(row - half(h) - Math.sin((col / w) * Math.PI * 2) * amplitude) < 1.2;

/** Спираль: расстояние растёт с углом (приближённо). */
const spiral = (turns: number) => (row: number, col: number, h: number, w: number) => {
  const dy = row - half(h);
  const dx = col - half(w);
  const radius = Math.hypot(dy, dx);
  const angle = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
  const target = (0.5 + angle * turns) * half(h) * 1.05;
  return Math.abs(radius - target) < 0.9;
};

/** Шахматная заливка всего поля. */
const checkerAll = (row: number, col: number): boolean => (row + col) % 2 === 0;

/** Гребёнка: частые вертикальные зубцы. */
const comb = (period: number) => (row: number, col: number, _h: number) =>
  col % period === 0 || row < 1;

/** Пирамида из полос. */
const pyramid = (row: number, col: number, h: number, w: number) =>
  row % 2 === (h - 1) % 2 && Math.abs(col - half(w)) <= half(w) * (row / (h - 1));

/** Лабиринт из чередующихся перегородок. */
const labyrinth = (row: number, col: number, _h: number, w: number) =>
  (row % 3 !== 0 && col % 4 !== 0) || (row % 3 === 0 && col % 4 === 2 && w > 0);

/** Целевые кольца с перекрестием. */
const target = (row: number, col: number, h: number, w: number) => {
  const level = Math.round(Math.hypot(row - half(h), col - half(w)));
  return level % 3 === 0 || row === Math.round(half(h)) || col === Math.round(half(w));
};

/** Арка. */
const arch = (row: number, col: number, h: number, w: number) => {
  const inner = Math.hypot(row - half(h), col - half(w));
  return inner <= half(h) && !(row > half(h) && Math.abs(col - half(w)) < half(w) * 0.5);
};

/** Капля: круг сверху и клин снизу. */
const drop = (row: number, col: number, h: number, w: number) => {
  const dy = half(h) - row;
  const width = Math.max(0, dy) * 0.5 + 1;
  return Math.abs(col - half(w)) <= width && row <= h - 1;
};

/** Крест. */
const cross = (thickness: number) => (row: number, col: number, h: number, w: number) =>
  Math.abs(row - half(h)) <= thickness || Math.abs(col - half(w)) <= thickness;

/** Косой крест. */
const exx = (thickness: number) => (row: number, col: number, h: number, w: number) =>
  Math.abs(Math.abs(row - half(h)) - Math.abs(col - half(w))) <= thickness;

/** Рамка по периметру с толщиной. */
const frame = (thickness: number) => (row: number, col: number, h: number, w: number) =>
  row < thickness || col < thickness || row >= h - thickness || col >= w - thickness;

/** Веер: сектор круга. */
const fan = (row: number, col: number, h: number, w: number) => {
  const dy = half(h) - row;
  const dx = col - half(w);
  return dy >= 0 && Math.hypot(dy, dx) <= half(h) && Math.abs(dx) <= dy * 1.6 + 2;
};

/** Щит: прямоугольник со скруглённым низом. */
const shield = (row: number, col: number, h: number, w: number) => {
  const bottom = row >= h - 3;
  const shrink = bottom ? (row - (h - 4)) * 0.7 : 0;
  return Math.abs(col - half(w)) <= half(w) - shrink;
};

/** Каталог геометрических фигур: собираются условием, а не рисунком. */
export const GEOMETRIC_SPECS: readonly GeometricSpec[] = [
  { title: 'Квадрат', size: 11, density: 0.16, allowed: frame(1) },
  { title: 'Рамка', size: 13, density: 0.18, allowed: frame(2) },
  { title: 'Круг', size: 13, density: 0.16, allowed: circle(6) },
  { title: 'Обруч', size: 13, density: 0.2, allowed: circle(6, false) },
  { title: 'Кольца', size: 13, density: 0.22, allowed: rings(3) },
  { title: 'Ромб', size: 13, density: 0.16, allowed: diamond(6) },
  { title: 'Ромб-кольцо', size: 15, density: 0.2, allowed: diamond(7, false) },
  { title: 'Квадратное кольцо', size: 13, density: 0.2, allowed: squareRing(5) },
  { title: 'Звезда', size: 15, density: 0.18, allowed: star(5, 2.5, 7) },
  { title: 'Звезда-6', size: 15, density: 0.18, allowed: star(6, 3, 7) },
  { title: 'Звезда-8', size: 15, density: 0.18, allowed: star(8, 3.5, 7) },
  { title: 'Крест', size: 13, density: 0.2, allowed: cross(1.5) },
  { title: 'Косой крест', size: 13, density: 0.2, allowed: exx(1) },
  { title: 'Плюс', size: 13, density: 0.24, allowed: cross(2.5) },
  { title: 'Треугольник', size: 13, density: 0.18, allowed: triangle },
  { title: 'Трапеция', size: 13, density: 0.18, allowed: trapezoid },
  { title: 'Пирамида', size: 13, density: 0.2, allowed: pyramid },
  { title: 'Шестиугольник', size: 13, density: 0.18, allowed: (row, col, h, w) => {
    const dx = Math.abs(col - half(w));
    return dx <= half(w) && row >= Math.round(dx * 0.6) && row <= h - 1 - Math.round(dx * 0.6);
  } },
  { title: 'Восьмиугольник', size: 13, density: 0.18, allowed: (row, col, h, w) => {
    const dx = Math.abs(col - half(w));
    const dy = Math.abs(row - half(h));
    return dx + dy <= half(w) + half(h) * 0.55;
  } },
  { title: 'Соты', size: 13, density: 0.22, allowed: (row, col) => (row + 2 * col) % 5 === 0 },
  { title: 'Шахматы', size: 11, density: 0.3, allowed: checkerAll },
  { title: 'Шахматный круг', size: 13, density: 0.28, allowed: checker(6) },
  { title: 'Точки', size: 11, density: 0.3, allowed: (row, col) => row % 2 === 1 && col % 2 === 1 },
  { title: 'Полосы', size: 13, density: 0.22, allowed: stripe(4, 1, 1) },
  { title: 'Диагонали', size: 13, density: 0.22, allowed: stripe(5, 0, 3) },
  { title: 'Косые', size: 13, density: 0.22, allowed: (row, col) => (row + col) % 5 === 0 },
  { title: 'Сетка', size: 13, density: 0.24, allowed: (row, col) => (row % 4 === 0) !== (col % 4 === 0) },
  { title: 'Гребёнка', size: 13, density: 0.26, allowed: comb(3) },
  { title: 'Волны', size: 13, density: 0.24, allowed: wave(3) },
  { title: 'Спираль', size: 15, density: 0.22, allowed: spiral(2) },
  { title: 'Мишень', size: 15, density: 0.24, allowed: target },
  { title: 'Арка', size: 13, density: 0.2, allowed: arch },
  { title: 'Капля', size: 13, density: 0.18, allowed: drop },
  { title: 'Веер', size: 13, density: 0.2, allowed: fan },
  { title: 'Щит', size: 13, density: 0.18, allowed: shield },
  { title: 'Лабиринт', size: 15, density: 0.26, allowed: labyrinth },
  { title: 'Часы', size: 13, density: 0.2, allowed: (row, col, h, w) => {
    const distance = Math.hypot(row - half(h), col - half(w));
    const center = row === Math.round(half(h)) - 3;
    const stem = col === Math.round(half(w)) && row > half(h);
    const stem2 = row === Math.round(half(h)) && col > half(w);
    return Math.abs(distance - 5.5) < 1.2 || center || stem || stem2;
  } },
  { title: 'Полумесяц', size: 13, density: 0.2, allowed: (row, col, h, w) => {
    const outer = Math.hypot(row - half(h), col - half(w)) <= 6;
    const inner = Math.hypot(row - half(h) + 2.5, col - half(w) - 1.5) <= 5;
    return outer && !inner;
  } },
  { title: 'Снежинка', size: 15, density: 0.24, allowed: (row, col, h, w) =>
    row === Math.round(half(h)) ||
    col === Math.round(half(w)) ||
    Math.abs(Math.abs(row - half(h)) - Math.abs(col - half(w))) < 0.7 },
  { title: 'Клин', size: 13, density: 0.2, allowed: (row, col, _h, w) => col <= row && row <= half(w) + col },
  { title: 'Ромбики', size: 13, density: 0.24, allowed: (row, col) => (row % 4 === 1) !== (col % 4 === 1) },
  { title: 'Зубцы', size: 13, density: 0.24, allowed: (row, col, _h) => row < 2 || col % 4 === 0 },
  { title: 'Ступени', size: 13, density: 0.22, allowed: (row, col) => (row + col) % 6 < 2 },
  { title: 'Воронка', size: 13, density: 0.2, allowed: (row, col, _h, w) =>
    Math.abs(col - half(w)) <= Math.max(1, half(w) - row * 0.8) && row > 1 },
  { title: 'Туннель', size: 13, density: 0.22, allowed: (row, col, _h, w) => row < 2 || col < 2 || col >= w - 2 },
  { title: 'Пик', size: 13, density: 0.2, allowed: (row, col, _h, w) => Math.abs(col - half(w)) === Math.min(row, 6) },
  { title: 'Клинок', size: 13, density: 0.2, allowed: (row, col, h, w) => Math.abs(col - half(w)) <= (h - 1 - row) * 0.55 },
];

/**
 * Рисованные силуэты: животные, предметы, техника.
 *
 * Каждая фигура — залитый силуэт: клетки поля стоят там, где нарисован `#`.
 */
export const FIGURE_ART: readonly ShapeArt[] = [
  {
    title: 'Рыбка',
    density: 0.16,
    art: rows(
      '.........../...####..#./..#####.##./.#.####.###/.######.###/.######.###/..#####.##./...####..#./...........',
    ),
  },
  {
    title: 'Кит',
    density: 0.16,
    art: rows(
      '.........../.#######../##########./###########/###########/.#########./..######.#/....###..#./...........',
    ),
  },
  {
    title: 'Кошка',
    density: 0.16,
    art: rows(
      '.#.......#./.##.....##./.#########./###########/#.#########/###########/.#########./..#######../...........',
    ),
  },
  {
    title: 'Собака',
    density: 0.16,
    art: rows(
      '.##.....##./####...####/.#########./###########/###########/.####.####./..#######../...#####.../...........',
    ),
  },
  {
    title: 'Птица',
    density: 0.16,
    art: rows(
      '.........../.##.....##./####...####/.##########./..########../...######.../....####..../.....##...../...........',
    ),
  },
  {
    title: 'Бабочка',
    density: 0.16,
    art: rows(
      '.........../##.......##/####...####/.#########./...#####.../..#########/.#.#####.#./##..###..##/...........',
    ),
  },
  {
    title: 'Черепаха',
    density: 0.16,
    art: rows(
      '.........../....###..../..#######../.#########./###########/.#########./..#######../.#.#...#.#/...........',
    ),
  },
  {
    title: 'Змея',
    density: 0.18,
    art: rows(
      '..######.../.#######../.##....##./.##.....##/..##.....##/...##....##/....######./..........',
    ),
  },
  {
    title: 'Ёжик',
    density: 0.18,
    art: rows(
      '.#.#.#.#.#./##.#.#.#.##/###########/.#########./..#######../...#####.../...........',
    ),
  },
  {
    title: 'Пингвин',
    density: 0.16,
    art: rows(
      '...#####.../..#######../.#########./.###...###./.##.....##./.###...###./..#######../...#####.../....###....',
    ),
  },
  {
    title: 'Медведь',
    density: 0.16,
    art: rows(
      '.##.....##./####...####/.#########./####.#.####/###########/.####.####./..#######../...........',
    ),
  },
  {
    title: 'Заяц',
    density: 0.16,
    art: rows(
      '..#.....#../.###...###../.###...###../..#######../.#########./###########/..#######../...........',
    ),
  },
  {
    title: 'Дерево',
    density: 0.16,
    art: rows(
      '....###..../..#######../.#########./###########/.#########./..#######../....###..../....###..../....###....',
    ),
  },
  {
    title: 'Ёлка',
    density: 0.16,
    art: rows(
      '.....#...../....###..../...#####.../..#######../...#####.../..#######../.#########./.....#...../....###....',
    ),
  },
  {
    title: 'Гриб',
    density: 0.16,
    art: rows(
      '..#######../.#########./###########/.#########./.........../...#####.../...#####.../...#####.../...........',
    ),
  },
  {
    title: 'Цветок',
    density: 0.16,
    art: rows(
      '...#...#.../..##...##../.###.#.###./..#######../...#####.../..#..#..#../...#####.../.....#...../.....#.....',
    ),
  },
  {
    title: 'Кактус',
    density: 0.16,
    art: rows(
      '....###..../..#####..../.######.#../.######.##./..#####.###/...#####.##/....####..#/....###..../....###....',
    ),
  },
  {
    title: 'Дом',
    density: 0.16,
    art: rows(
      '.....#...../....###..../...#####.../..#######../.#########./.#########./.##.###.##./.##.###.##./.#########.',
    ),
  },
  {
    title: 'Замок',
    density: 0.18,
    art: rows(
      '##.##.##.##/###########/###########/.####.####./.###...###./.#########./.#.#####.#./.#########./...........',
    ),
  },
  {
    title: 'Машина',
    density: 0.16,
    art: rows(
      '.........../...######../..########./.#########./###########/##.#####.##/##.......##/.#########./...........',
    ),
  },
  {
    title: 'Танк',
    density: 0.18,
    art: rows(
      '.......###./....######./...#######./.########./###########/##.#####.##/#.#######.#/.#########./...........',
    ),
  },
  {
    title: 'Ракета',
    density: 0.16,
    art: rows(
      '.....#...../....###..../....###..../...#####.../...#####.../...#####.../..##.###.##./..#.......#./.#.........#',
    ),
  },
  {
    title: 'Самолёт',
    density: 0.16,
    art: rows(
      '.....#...../....###..../....###..../#########../###########/....###..../...#####.../..#.....#../.#.......#.',
    ),
  },
  {
    title: 'Корабль',
    density: 0.16,
    art: rows(
      '.....#...../....####.../....#####../....######./.....#...../.....#...../.##########/..########./...####....',
    ),
  },
  {
    title: 'Якорь',
    density: 0.18,
    art: rows(
      '....###..../...#...#.../....###..../..#######../....#...../....#...../#...#...#..#/##..#..#..##/.###...###.',
    ),
  },
  {
    title: 'Ключ',
    density: 0.18,
    art: rows(
      '..#####..../.##...##.../##.....##../.##...##.../..#####..../....#....../....##...../....#.#..../....##.....',
    ),
  },
  {
    title: 'Кубок',
    density: 0.18,
    art: rows(
      '###########/#.........#/#.........#/.#########./..#######../...#####.../....###..../....###..../.#########.',
    ),
  },
  {
    title: 'Корона',
    density: 0.16,
    art: rows(
      '#....#....#/#.#..#.#..#/##.#.#.##.#/###########/#.#########/#.#########/###########/.........../...........',
    ),
  },
  {
    title: 'Череп',
    density: 0.18,
    art: rows(
      '..#######../.#########./###.###.###/###.###.###/.#########./..#######../...#.#.#.../...#####.../...........',
    ),
  },
  {
    title: 'Робот',
    density: 0.16,
    art: rows(
      '.....#...../...#####.../...#.#.#.../...#####.../..#######../.##########/.#.#####.#./.#.#####.#./..#######..',
    ),
  },
];

