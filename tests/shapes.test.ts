/**
 * Тесты фигур уровней: каталог, маски, сложность и кривая.
 *
 * Часть тестов печатает фигуры в консоль — так их видно глазами, а не только
 * в ассертах.
 */

import { describe, expect, it } from 'vitest';
import { FONT_5X7 } from '../src/game/shapeArt';
import {
  CELL_CHAR,
  LEVEL_SHAPES,
  SHAPE_LEVEL_COUNT,
  isCellAllowed,
  shapeArea,
  shapeCols,
  shapeForLevel,
  shapeMask,
  shapeMines,
  shapeRows,
  transformShape,
  trimShape,
  validateShape,
  type LevelShape,
} from '../src/game/shapes';

/** Фигура в виде текста: `#` — клетка, `·` — пустота. */
function render(shape: LevelShape): string {
  return shape.art.map((row) => row.replaceAll(CELL_CHAR, '██').replaceAll('.', ' ·')).join('\n');
}

describe('shapes: каталог', () => {
  it('уровней не меньше 150', () => {
    expect(SHAPE_LEVEL_COUNT).toBeGreaterThanOrEqual(150);
    expect(LEVEL_SHAPES).toHaveLength(SHAPE_LEVEL_COUNT);
  });

  it('шрифт набран ровно: 7–8 строк по 5 символов', () => {
    for (const [letter, art] of Object.entries(FONT_5X7)) {
      expect(art.length, `буква ${letter}`).toBeGreaterThanOrEqual(7);
      expect(art.length, `буква ${letter}`).toBeLessThanOrEqual(8);
      for (const row of art) {
        expect(row.length, `буква ${letter}: «${row}»`).toBe(5);
      }
    }
  });

  it('каждая фигура валидна', () => {
    LEVEL_SHAPES.forEach((shape, index) => {
      expect(validateShape(shape), `уровень ${index + 1} (${shape.title})`).toEqual([]);
    });
  });

  it('названия и рисунки не повторяются', () => {
    const titles = LEVEL_SHAPES.map((shape) => shape.title);
    const arts = LEVEL_SHAPES.map((shape) => shape.art.join('|'));

    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(arts).size).toBe(arts.length);
  });

  it('размеры поля разумные: влезают на телефон', () => {
    for (const shape of LEVEL_SHAPES) {
      expect(shapeRows(shape)).toBeGreaterThanOrEqual(5);
      expect(shapeRows(shape)).toBeLessThanOrEqual(20);
      expect(shapeCols(shape)).toBeLessThanOrEqual(20);
    }
  });

  it('фигур хватает с запасом по количеству мин', () => {
    const mines = LEVEL_SHAPES.map(shapeMines);
    expect(Math.min(...mines)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...mines)).toBeLessThanOrEqual(20);
  });

  it('shapeForLevel работает на границах', () => {
    expect(shapeForLevel(1)).not.toBeNull();
    expect(shapeForLevel(SHAPE_LEVEL_COUNT)).not.toBeNull();
    expect(shapeForLevel(SHAPE_LEVEL_COUNT + 1)).toBeNull();
    expect(shapeForLevel(0)).toBeNull();
  });
});

describe('shapes: кривая сложности', () => {
  it('старт легче финала', () => {
    const mines = LEVEL_SHAPES.map(shapeMines);
    const average = (values: readonly number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(average(mines.slice(0, 12))).toBeLessThan(average(mines.slice(-12)));
  });

  it('первые уровни совсем простые', () => {
    const first = LEVEL_SHAPES.slice(0, 5).map(shapeMines);
    expect(Math.max(...first)).toBeLessThanOrEqual(8);
  });

  it('лёгкие фигуры попадаются и в конце — это передыхи', () => {
    const mines = LEVEL_SHAPES.map(shapeMines);
    const late = mines.slice(Math.floor(mines.length * 0.6));
    const median = [...mines].sort((a, b) => a - b)[Math.floor(mines.length / 2)] ?? 10;

    expect(late.filter((value) => value <= median).length).toBeGreaterThanOrEqual(5);
  });
});

describe('shapes: маска', () => {
  it('маска соответствует рисунку', () => {
    const shape = LEVEL_SHAPES[0];
    expect(shape).toBeDefined();
    if (shape === undefined) return;

    const mask = shapeMask(shape);
    expect(mask).toHaveLength(shapeRows(shape) * shapeCols(shape));

    let allowed = 0;
    for (let row = 0; row < shapeRows(shape); row += 1) {
      for (let col = 0; col < shapeCols(shape); col += 1) {
        if (isCellAllowed(shape, row, col)) allowed += 1;
      }
    }
    expect(mask.filter(Boolean)).toHaveLength(allowed);
    expect(allowed).toBe(shapeArea(shape));
  });

  it('обрезка убирает пустые края', () => {
    const padded = trimShape({
      title: 'тест',
      density: 0.2,
      art: ['.....', '.###.', '.###.', '.....'],
    });
    expect(padded.art).toEqual(['###', '###']);
  });

  it('отражения сохраняют площадь и число мин', () => {
    for (const shape of LEVEL_SHAPES.slice(0, 20)) {
      for (let variant = 0; variant < 4; variant += 1) {
        const mirrored = transformShape(shape, variant);
        expect(shapeArea(mirrored)).toBe(shapeArea(shape));
        expect(shapeMines(mirrored)).toBe(shapeMines(shape));
      }
    }
  });
});

describe('shapes: как выглядят', () => {
  it('печатает несколько фигур', () => {
    const wanted = ['Рыбка', 'Кошка', 'Танк', 'Ракета', 'Буква А', 'Круг'];

    for (const title of wanted) {
      const shape = LEVEL_SHAPES.find((item) => item.title === title);
      if (shape === undefined) {
        console.log(`\n${title}: НЕ НАЙДЕНА`);
        continue;
      }
      console.log(
        `\n${title}: ${shapeRows(shape)}×${shapeCols(shape)}, клеток ${shapeArea(shape)}, мин ${shapeMines(shape)}`,
      );
      console.log(render(shape));
    }
  });
});
