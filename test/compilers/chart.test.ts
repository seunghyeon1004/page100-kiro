import { describe, expect, it } from "vitest";
import { lineChart, rangeBars } from "../../src/compilers/chart.js";
import { canvasToCells, createCanvas, setPixel } from "../../src/compilers/mosaic-canvas.js";

const STYLE = { fg: "cyan", bg: "black" } as const;

function lit(pixels: readonly (readonly boolean[])[]): [number, number][] {
  const out: [number, number][] = [];
  pixels.forEach((row, y) => {
    row.forEach((on, x) => on && out.push([x, y]));
  });
  return out;
}

describe("canvas", () => {
  it("ignores a pixel outside the canvas", () => {
    const canvas = createCanvas(2, 1);
    for (const [x, y] of [
      [-1, 0],
      [4, 0],
      [0, 3],
      [0, -1],
      [0.5, 1],
    ] as const)
      setPixel(canvas, x, y);
    expect(lit(canvas.pixels)).toEqual([]);
  });

  it("numbers the six pixels of a cell by grid-rules.md", () => {
    const canvas = createCanvas(1, 1);
    setPixel(canvas, 0, 0);
    setPixel(canvas, 1, 2);
    expect(canvasToCells(canvas, STYLE)[0]?.[0]).toMatchObject({ kind: "mosaic", bits: 1 + 32 });
  });
});

describe("lineChart", () => {
  it("puts the largest value on the top pixel row and the smallest on the bottom one", () => {
    const canvas = lineChart([1, 5, 3, 2], 8, 4);
    const points = lit(canvas.pixels);
    expect(Math.min(...points.map(([, y]) => y))).toBe(0);
    expect(Math.max(...points.map(([, y]) => y))).toBe(11);
    expect(canvas.pixels[0]?.some(Boolean)).toBe(true);
    expect(canvas.pixels[11]?.some(Boolean)).toBe(true);
  });

  it("draws a worked example: three points on a 1 x 1 canvas", () => {
    const canvas = lineChart([1, 2, 3], 1, 1);
    expect(lit(canvas.pixels).sort()).toEqual(
      [
        [0, 2],
        [1, 0],
        [1, 1],
        [1, 2],
      ].sort(),
    );
    expect(canvasToCells(canvas, STYLE)[0]?.[0]).toMatchObject({ bits: 16 + 32 + 8 + 2 });
  });

  it("draws all equal values on the middle pixel row", () => {
    const canvas = lineChart([4, 4, 4], 6, 3);
    expect(new Set(lit(canvas.pixels).map(([, y]) => y))).toEqual(new Set([4]));
  });

  it("leaves a gap at null and draws a single value as a pixel", () => {
    const canvas = lineChart([1, null, 3], 6, 2);
    const columns = new Set(lit(canvas.pixels).map(([x]) => x));
    expect(columns.has(0)).toBe(true);
    expect(columns.has(11)).toBe(true);
    expect(columns.has(5) || columns.has(6)).toBe(false);
    expect(lit(lineChart([7], 3, 2).pixels)).toEqual([[0, 2]]);
    expect(lit(lineChart([null, null], 3, 2).pixels)).toEqual([]);
  });

  it("joins consecutive points without a break in the columns", () => {
    const canvas = lineChart([1, 9, 1, 9, 1], 20, 5);
    const columns = new Set(lit(canvas.pixels).map(([x]) => x));
    for (let x = 0; x < 40; x++) expect(columns.has(x)).toBe(true);
  });
});

describe("rangeBars", () => {
  it("draws each bar from its high to its low with a gap between bars", () => {
    const canvas = rangeBars(
      [{ low: 0, high: 10 }, { low: 5, high: 10 }, null, { low: 0, high: 4 }],
      8,
      4,
    );
    const rowsOfColumn = (x: number): number[] =>
      canvas.pixels.flatMap((row, y) => (row[x] === true ? [y] : []));
    // 16 pixels wide, 4 bars: bar 0 covers x 1..2, bar 1 x 5..6, bar 3 x 13..14.
    expect(rowsOfColumn(1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(rowsOfColumn(0)).toEqual([]);
    expect(rowsOfColumn(3)).toEqual([]);
    expect(rowsOfColumn(5)[0]).toBe(0);
    expect(rowsOfColumn(5)[rowsOfColumn(5).length - 1]).toBe(6);
    expect(rowsOfColumn(9)).toEqual([]);
    expect(rowsOfColumn(13)).toEqual([7, 8, 9, 10, 11]);
  });

  it("uses the middle row when every value is equal and draws nothing for no data", () => {
    const canvas = rangeBars([{ low: 3, high: 3 }], 4, 4);
    expect(new Set(lit(canvas.pixels).map(([, y]) => y))).toEqual(new Set([5]));
    expect(lit(rangeBars([null], 4, 4).pixels)).toEqual([]);
  });
});

describe("charts with extreme values", () => {
  it("keep every pixel on the canvas and finish for doubles of any size", () => {
    const extremes = [-1e308, 1e308, 0, 5e-324, -5e-324, 1e-300];
    for (const canvas of [
      lineChart(extremes, 8, 4),
      rangeBars(
        extremes.map((v) => ({ low: -v, high: v })),
        8,
        4,
      ),
    ]) {
      expect(canvas.pixels).toHaveLength(12);
      const points = lit(canvas.pixels);
      expect(points.length).toBeGreaterThan(0);
      expect(Math.min(...points.map(([, y]) => y))).toBe(0);
      expect(Math.max(...points.map(([, y]) => y))).toBe(11);
    }
  });
});
