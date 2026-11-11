import type { CellStyle } from "./cell-style.js";
import type { Cell, Colour, Rows } from "../grid/types.js";

// A pixel canvas for charts, symbols, the moon and block letters (rule-compilers requirement 5.1,
// design.md, "Drawing"). A cell covers 2 x 3 pixels; bit k of a cell is pixel
// (2c + k mod 2, 3r + floor(k / 2)), the numbering of grid-rules.md, "Mosaics".

export interface Canvas {
  readonly cols: number;
  readonly rows: number;
  /** `pixels[y][x]`, 3 * rows by 2 * cols. */
  readonly pixels: boolean[][];
}

/** A canvas of `cols` by `rows` cells with every pixel off. Sizes below 0 or not whole give an empty canvas. */
export function createCanvas(cols: number, rows: number): Canvas {
  const c = Number.isInteger(cols) && cols > 0 ? cols : 0;
  const r = Number.isInteger(rows) && rows > 0 ? rows : 0;
  return {
    cols: c,
    rows: r,
    pixels: Array.from({ length: 3 * r }, () => Array.from({ length: 2 * c }, () => false)),
  };
}

/** Turns a pixel on. A pixel outside the canvas, or a non-integer position, does nothing. */
export function setPixel(canvas: Canvas, x: number, y: number): void {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return;
  const row = canvas.pixels[y];
  if (row === undefined || x < 0 || x >= row.length) return;
  row[x] = true;
}

function textSpace(fg: Colour, bg: Colour, conceal: boolean): Cell {
  return { kind: "text", ch: " ", fg, bg, conceal };
}

/** One cell per 2 x 3 pixels: a mosaic cell for bits 1 to 63, a text space for 0 (requirement 5.2). */
export function canvasToCells(canvas: Canvas, style: CellStyle): Cell[][] {
  const conceal = style.conceal === true;
  return Array.from({ length: canvas.rows }, (_, r) =>
    Array.from({ length: canvas.cols }, (_, c): Cell => {
      let bits = 0;
      for (let k = 0; k < 6; k++) {
        if (canvas.pixels[3 * r + Math.floor(k / 2)]?.[2 * c + (k % 2)] === true) bits |= 1 << k;
      }
      return bits === 0
        ? textSpace(style.fg, style.bg, conceal)
        : { kind: "mosaic", bits, separated: false, fg: style.fg, bg: style.bg, conceal };
    }),
  );
}

/** The canvas a set of cells draws: a mosaic cell's bits are its pixels, any text cell is off. */
export function cellsToCanvas(cells: Rows): Canvas {
  const cols = cells[0]?.length ?? 0;
  const canvas = createCanvas(cols, cells.length);
  cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell.kind !== "mosaic") return;
      for (let k = 0; k < 6; k++) {
        if ((cell.bits & (1 << k)) !== 0)
          setPixel(canvas, 2 * c + (k % 2), 3 * r + Math.floor(k / 2));
      }
    });
  });
  return canvas;
}
