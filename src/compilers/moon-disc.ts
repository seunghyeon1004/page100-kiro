import type { Cell } from "../grid/types.js";
import { canvasToCells, createCanvas, setPixel } from "./mosaic-canvas.js";
import type { Canvas } from "./mosaic-canvas.js";

// The moon as a 16 x 10 cell disc (rule-compilers requirements 5.5 and 15.2, design.md, "Drawing").

export const MOON_COLS = 16;
export const MOON_ROWS = 10;

const CENTRE_X = MOON_COLS; // 2 * cols / 2
const CENTRE_Y = (3 * MOON_ROWS) / 2;
/** Vertical radius in pixels. */
const RADIUS_Y = 15;
/**
 * Horizontal radius in pixels, scaled for the 5:4 screen: a pixel is 0.375em wide and 0.333em
 * tall, so 15 * 0.333 = RADIUS_X * 0.375 gives 15 * 8 / 9.
 */
const RADIUS_X = (15 * 8) / 9;

function inDisc(u: number, v: number): boolean {
  return u * u + v * v <= 1;
}

/** Every pixel on the disc, lit or not. */
export function moonDiscExtent(): Canvas {
  const canvas = createCanvas(MOON_COLS, MOON_ROWS);
  for (let y = 0; y < 3 * MOON_ROWS; y++) {
    for (let x = 0; x < 2 * MOON_COLS; x++) {
      const u = (x + 0.5 - CENTRE_X) / RADIUS_X;
      const v = (y + 0.5 - CENTRE_Y) / RADIUS_Y;
      if (inDisc(u, v)) setPixel(canvas, x, y);
    }
  }
  return canvas;
}

/**
 * The lit pixels, 32 x 30. Pixel (x, y) has u = (x + 0.5 - 16) / RADIUS_X and v = (y + 0.5 - 15) / 15,
 * is on the disc when u^2 + v^2 <= 1, and is lit when u > s (waxing) or u < -s (waning), with
 * s = (1 - 2f) * sqrt(1 - v^2). `fraction` is clamped to 0 to 1.
 */
export function moonDisc(fraction: number, waxing: boolean): Canvas {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const canvas = createCanvas(MOON_COLS, MOON_ROWS);
  for (let y = 0; y < 3 * MOON_ROWS; y++) {
    for (let x = 0; x < 2 * MOON_COLS; x++) {
      const u = (x + 0.5 - CENTRE_X) / RADIUS_X;
      const v = (y + 0.5 - CENTRE_Y) / RADIUS_Y;
      if (!inDisc(u, v)) continue;
      const s = (1 - 2 * f) * Math.sqrt(1 - v * v);
      if (waxing ? u > s : u < -s) setPixel(canvas, x, y);
    }
  }
  return canvas;
}

/**
 * The whole disc as cells. A cell with a lit pixel is a contiguous yellow mosaic of its lit
 * pixels. A cell that holds a disc pixel but no lit pixel is a separated mosaic of all six
 * blocks, blue. Every other cell is a blank text space.
 */
export function moonDiscCells(fraction: number, waxing: boolean): Cell[][] {
  const lit = canvasToCells(moonDisc(fraction, waxing), { fg: "yellow", bg: "black" });
  const extent = canvasToCells(moonDiscExtent(), { fg: "blue", bg: "black" });
  return lit.map((row, r) =>
    row.map((cell, c): Cell => {
      if (cell.kind === "mosaic") return cell;
      const inside = extent[r]?.[c]?.kind === "mosaic";
      return inside
        ? { kind: "mosaic", bits: 63, separated: true, fg: "blue", bg: "black", conceal: false }
        : cell;
    }),
  );
}
