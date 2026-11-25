/**
 * Фигуры уровней.
 *
 * Поле уровня — это и есть фигура: клетки стоят только там, где нарисован `#`.
 * Мины расставляются внутри фигуры после первого клика, поэтому первый ход
 * безопасен, а раскладка каждый раз новая — заучить её нельзя.
 *
 * Каталог собирается из трёх источников: геометрические фигуры (условие на
 * координаты), буквы и цифры (шрифт 5×7, увеличенный вдвое) и рисованные
 * силуэты. Плюс зеркальные варианты рисованных — так набирается больше 150
 * уровней, и каждая фигура остаётся узнаваемой.
 */

import { FIGURE_ART, FONT_5X7, GEOMETRIC_SPECS, type ShapeArt } from './shapeArt';

/** Символ клетки поля в маске. */
export const CELL_CHAR = '#';
/** Символ пустоты: клетки здесь нет. */
export const VOID_CHAR = '.';

/** Фигура уровня. */
export type LevelShape = ShapeArt;

/** Высота фигуры. */
export function shapeRows(shape: LevelShape): number {
  return shape.art.length;
}

/** Ширина фигуры. */
export function shapeCols(shape: LevelShape): number {
  return shape.art.reduce((max, row) => Math.max(max, row.length), 0);
}

/** Есть ли клетка поля в этой позиции. */
export function isCellAllowed(shape: LevelShape, row: number, col: number): boolean {
  return shape.art[row]?.[col] === CELL_CHAR;
}

/** Сколько клеток в фигуре. */
export function shapeArea(shape: LevelShape): number {
  return shape.art.reduce(
    (sum, row) => sum + [...row].filter((char) => char === CELL_CHAR).length,
    0,
  );
}

/**
 * Сколько мин на уровне.
 *
 * Сложность задаётся плотностью, но с оговорками: не меньше четырёх мин (иначе
 * уровень неинтересен) и не больше двадцати (иначе он превращается в мучение).
 * Плюс всегда оставляем запас безопасных клеток под стартовую зону.
 */
export function shapeMines(shape: LevelShape): number {
  const area = shapeArea(shape);
  const byDensity = Math.round(area * shape.density);
  const ceiling = Math.min(20, Math.max(4, area - 9));
  return Math.min(Math.max(4, byDensity), ceiling);
}

/** Плоская маска фигуры: `true` — клетка поля. */
export function shapeMask(shape: LevelShape): readonly boolean[] {
  const cols = shapeCols(shape);
  const mask: boolean[] = [];
  for (let row = 0; row < shapeRows(shape); row += 1) {
    for (let col = 0; col < cols; col += 1) {
      mask.push(isCellAllowed(shape, row, col));
    }
  }
  return mask;
}

/** Обрезать пустые строки и столбцы: поле должно быть плотно по фигуре. */
export function trimShape(shape: LevelShape): LevelShape {
  const rows = shape.art.filter((row) => row.includes(CELL_CHAR));
  if (rows.length === 0) return shape;

  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  let left = width;
  let right = 0;

  for (const row of rows) {
    for (let col = 0; col < row.length; col += 1) {
      if (row[col] === CELL_CHAR) {
        left = Math.min(left, col);
        right = Math.max(right, col);
      }
    }
  }

  return {
    ...shape,
    art: rows.map((row) => row.slice(left, right + 1).padEnd(right + 1 - left, VOID_CHAR)),
  };
}

/** Вариант отражения: 0 — как есть, 1 — зеркало по горизонтали, 2 — по вертикали, 3 — поворот. */
export function transformShape(shape: LevelShape, variant: number): LevelShape {
  const mode = ((Math.trunc(variant) % 4) + 4) % 4;
  if (mode === 0) return shape;

  const mirrored = shape.art.map((row) => [...row].reverse().join(''));
  if (mode === 1) return { ...shape, art: mirrored };
  if (mode === 2) return { ...shape, art: [...shape.art].reverse() };
  return { ...shape, art: [...mirrored].reverse() };
}

/** Проверка маски: прямоугольность, площадь и осмысленное число мин. */
export function validateShape(shape: LevelShape): readonly string[] {
  const problems: string[] = [];
  if (shape.art.length === 0) return ['пустая фигура'];

  const width = shapeCols(shape);
  shape.art.forEach((row, index) => {
    if (row.length !== width) {
      problems.push(`строка ${index}: ${row.length} символов вместо ${width}`);
    }
    for (const char of row) {
      if (char !== CELL_CHAR && char !== VOID_CHAR) {
        problems.push(`строка ${index}: неизвестный символ «${char}»`);
      }
    }
  });

  const area = shapeArea(shape);
  if (area < 8) problems.push(`клеток всего ${area}: фигура слишком маленькая`);

  const mines = shapeMines(shape);
  if (mines < 2) problems.push(`мин ${mines}`);
  if (mines >= area) problems.push(`мин ${mines} при ${area} клетках`);

  return problems;
}

/** Увеличить маску вдвое: буквы шрифта 5×7 становятся полем 10×14. */
function scaleTwice(art: readonly string[]): readonly string[] {
  return art.flatMap((row) => {
    const doubled = [...row].map((char) => char + char).join('');
    return [doubled, doubled];
  });
}

/** Буквы и цифры: шрифт, увеличенный вдвое. */
function letterShapes(): readonly LevelShape[] {
  return Object.entries(FONT_5X7).map(([title, art]) => ({
    title: /^\d$/.test(title) ? `Цифра ${title}` : `Буква ${title}`,
    art: scaleTwice(art),
    density: 0.18,
  }));
}

/** Геометрические фигуры: маска строится условием. */
function geometricShapes(): readonly LevelShape[] {
  return GEOMETRIC_SPECS.map((spec) => {
    const width = spec.width ?? spec.size;
    const art: string[] = [];

    for (let row = 0; row < spec.size; row += 1) {
      let line = '';
      for (let col = 0; col < width; col += 1) {
        line += spec.allowed(row, col, spec.size, width) ? CELL_CHAR : VOID_CHAR;
      }
      art.push(line);
    }

    return trimShape({ title: spec.title, art, density: spec.density });
  });
}

/** Рисованные силуэты. */
function figureShapes(): readonly LevelShape[] {
  return FIGURE_ART.map((figure) => trimShape(figure));
}

/**
 * Зеркальные и повёрнутые варианты рисованных фигур.
 *
 * Для симметричных фигур вариант совпал бы с исходной — такие пропускаем,
 * чтобы в каталоге не было двух одинаковых полей.
 */
function figureVariants(figures: readonly LevelShape[]): readonly LevelShape[] {
  const result: LevelShape[] = [];
  const seen = new Set(figures.map((figure) => figure.art.join('|')));

  for (const figure of figures) {
    const variants: readonly (readonly [number, string])[] = [
      [1, 'зеркало'],
      [3, 'поворот'],
    ];

    for (const [mode, suffix] of variants) {
      const variant = trimShape(transformShape(figure, mode));
      const key = variant.art.join('|');
      // Симметричная фигура в отражении выглядит так же — второй раз не нужна.
      if (seen.has(key)) continue;

      seen.add(key);
      result.push({ ...variant, title: `${figure.title} (${suffix})` });
    }
  }

  return result;
}

/** Основа названия: у зеркальных вариантов есть суффикс в скобках. */
function baseTitle(shape: LevelShape): string {
  return shape.title.replace(/\s*\(.*\)$/, '');
}

/** Это вариант другой фигуры (зеркало или поворот)? */
function isVariant(shape: LevelShape): boolean {
  return baseTitle(shape) !== shape.title;
}

/**
 * Сложность уровня одной цифрой.
 *
 * Мины важнее размера: большая, но редкая фигура проходится легче, чем плотная
 * маленькая. Размер идёт вторым слагаемым, чтобы среди одинаковых по минам
 * уровней первыми шли компактные. Варианты фигур получают штраф: они идут после
 * «своих» фигур, а не вклиниваются в разминку.
 */
function difficulty(shape: LevelShape): number {
  const penalty = isVariant(shape) ? 24 : 0;
  return shapeMines(shape) * 8 + shapeArea(shape) / 8 + penalty;
}

/**
 * Развести соседние варианты одной фигуры.
 *
 * «Ключ» и «Ключ (зеркало)» имеют одинаковую сложность и после сортировки
 * встают рядом — два почти одинаковых уровня подряд выглядят как ошибка.
 * Меняем такой уровень местами с ближайшим, у которого другое название.
 */
function spreadVariants(sorted: readonly LevelShape[]): readonly LevelShape[] {
  const result = [...sorted];

  for (let index = 1; index < result.length; index += 1) {
    const current = result[index];
    const previous = result[index - 1];
    if (current === undefined || previous === undefined) continue;
    if (baseTitle(current) !== baseTitle(previous)) continue;

    const swapIndex = result.findIndex(
      (candidate, position) =>
        position > index && baseTitle(candidate) !== baseTitle(previous),
    );
    const replacement = result[swapIndex];
    if (swapIndex > index && replacement !== undefined) {
      result[index] = replacement;
      result[swapIndex] = current;
    }
  }

  return result;
}

/** Порядок кампании: считаем сложность и раскладываем волной. */
function campaignOrder(shapes: readonly LevelShape[]): readonly LevelShape[] {
  const sorted = [...shapes].sort(
    (left, right) =>
      difficulty(left) - difficulty(right) || left.title.localeCompare(right.title),
  );

  const half = Math.ceil(sorted.length / 2);
  const easy = sorted.slice(0, half);
  const hard = sorted.slice(half);
  const result: LevelShape[] = [];
  let easyIndex = 0;
  let hardIndex = 0;

  // Начало кампании — сплошь лёгкие фигуры: первые уровни должны затягивать,
  // а не наказывать.
  const intro = 6;
  for (let step = 0; step < intro && easyIndex < easy.length; step += 1) {
    const shape = easy[easyIndex];
    easyIndex += 1;
    if (shape !== undefined) result.push(shape);
  }

  // Дальше три уровня полегче, один — из тяжёлой половины: сложность растёт,
  // но после плотной фигуры всегда идёт передых.
  while (result.length < sorted.length) {
    for (let step = 0; step < 3 && easyIndex < easy.length; step += 1) {
      const shape = easy[easyIndex];
      easyIndex += 1;
      if (shape !== undefined) result.push(shape);
    }

    const heavy = hard[hardIndex];
    hardIndex += 1;
    if (heavy !== undefined) result.push(heavy);
  }

  return spreadVariants(result.slice(0, sorted.length));
}

function buildCatalog(): readonly LevelShape[] {
  const figures = figureShapes();
  const all = [
    ...geometricShapes(),
    ...letterShapes(),
    ...figures,
    ...figureVariants(figures),
  ];

  // Одинаковые поля в каталоге не нужны: у каждой фигуры свой рисунок.
  const unique = new Map<string, LevelShape>();
  for (const shape of all) {
    const key = shape.art.join('|');
    if (!unique.has(key)) unique.set(key, shape);
  }

  return campaignOrder([...unique.values()]);
}

/** Кампания: все фигуры в порядке прохождения. */
export const LEVEL_SHAPES: readonly LevelShape[] = buildCatalog();

/** Сколько уровней идёт с фигурами. */
export const SHAPE_LEVEL_COUNT = LEVEL_SHAPES.length;

/** Фигура уровня или `null`, если уровень идёт с обычным полем 9×9. */
export function shapeForLevel(level: number): LevelShape | null {
  if (!Number.isFinite(level)) return null;
  return LEVEL_SHAPES[Math.floor(level) - 1] ?? null;
}
