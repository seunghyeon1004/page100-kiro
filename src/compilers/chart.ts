import type { Canvas } from "./mosaic-canvas.js";
import { createCanvas, setPixel } from "./mosaic-canvas.js";

// Line chart and range bars on a pixel canvas (rule-compilers requirement 5.3, design.md, "Drawing").

export interface Range {
  readonly low: number;
  readonly high: number;
}

/**
 * The pixel row of value v: the largest value on row 0, the smallest on the last row. The values
 * are halved first so that finite doubles of any size cannot overflow; the row is always from 0 to
 * height - 1.
 */
function scaleY(v: number, min: number, max: number, height: number): number {
  const span = max / 2 - min / 2;
  if (!(span > 0)) return Math.floor((height - 1) / 2);
  const row = Math.round(((max / 2 - v / 2) / span) * (height - 1));
  return Math.min(height - 1, Math.max(0, Number.isNaN(row) ? 0 : row));
}

/** A line through the non-null values, scaled linearly, with gaps at `null`. */
export function lineChart(values: readonly (number | null)[], cols: number, rows: number): Canvas {
  const canvas = createCanvas(cols, rows);
  const width = 2 * canvas.cols;
  const height = 3 * canvas.rows;
  const known = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (width === 0 || height === 0 || known.length === 0) return canvas;
  const max = Math.max(...known);
  const min = Math.min(...known);
  const n = values.length;
  const points = values.map((v, i) =>
    v === null || !Number.isFinite(v)
      ? null
      : {
          x: n === 1 ? 0 : Math.round((i * (width - 1)) / (n - 1)),
          y: scaleY(v, min, max, height),
        },
  );
  points.forEach((point, i) => {
    if (point === null) return;
    setPixel(canvas, point.x, point.y);
    const next = points[i + 1];
    if (next === undefined || next === null) return;
    let previousY = point.y;
    for (let x = point.x; x <= next.x; x++) {
      const y =
        next.x === point.x
          ? next.y
          : Math.round(point.y + ((next.y - point.y) * (x - point.x)) / (next.x - point.x));
      const [from, to] = previousY <= y ? [previousY, y] : [y, previousY];
      for (let fill = from; fill <= to; fill++) setPixel(canvas, x, fill);
      previousY = y;
    }
  });
  return canvas;
}

/** One bar per range from its high to its low, one scale for all, with a gap column on each side. */
export function rangeBars(ranges: readonly (Range | null)[], cols: number, rows: number): Canvas {
  const canvas = createCanvas(cols, rows);
  const width = 2 * canvas.cols;
  const height = 3 * canvas.rows;
  const valid = ranges.filter(
    (r): r is Range => r !== null && Number.isFinite(r.low) && Number.isFinite(r.high),
  );
  if (width === 0 || height === 0 || valid.length === 0) return canvas;
  const max = Math.max(...valid.map((r) => Math.max(r.low, r.high)));
  const min = Math.min(...valid.map((r) => Math.min(r.low, r.high)));
  const n = ranges.length;
  ranges.forEach((range, i) => {
    if (range === null || !Number.isFinite(range.low) || !Number.isFinite(range.high)) return;
    const x0 = Math.floor((i * width) / n) + 1;
    const x1 = Math.max(x0, Math.floor(((i + 1) * width) / n) - 2);
    const top = scaleY(Math.max(range.low, range.high), min, max, height);
    const bottom = scaleY(Math.min(range.low, range.high), min, max, height);
    for (let x = x0; x <= x1; x++) {
      for (let y = top; y <= bottom; y++) setPixel(canvas, x, y);
    }
  });
  return canvas;
}
