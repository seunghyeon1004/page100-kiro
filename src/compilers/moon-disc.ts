import { createCanvas, setPixel } from "./mosaic-canvas.js";
import type { Canvas } from "./mosaic-canvas.js";

// The moon as an 8 x 6 cell disc (rule-compilers requirement 5.5, design.md, "Drawing").

export const MOON_COLS = 8;
export const MOON_ROWS = 6;

/**
 * The disc, 16 x 18 pixels. Pixel (x, y) has u = (x + 0.5 - 8) / 8 and v = (y + 0.5 - 9) / 9, is
 * on the disc when u^2 + v^2 <= 1, and is lit when u > s (waxing) or u < -s (waning), with
 * s = (1 - 2f) * sqrt(1 - v^2). `fraction` is clamped to 0 to 1.
 */
export function moonDisc(fraction: number, waxing: boolean): Canvas {
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const canvas = createCanvas(MOON_COLS, MOON_ROWS);
  for (let y = 0; y < 3 * MOON_ROWS; y++) {
    for (let x = 0; x < 2 * MOON_COLS; x++) {
      const u = (x + 0.5 - 8) / 8;
      const v = (y + 0.5 - 9) / 9;
      if (u * u + v * v > 1) continue;
      const s = (1 - 2 * f) * Math.sqrt(1 - v * v);
      if (waxing ? u > s : u < -s) setPixel(canvas, x, y);
    }
  }
  return canvas;
}
