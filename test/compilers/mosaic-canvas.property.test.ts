import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { COLOURS } from "../../src/grid/colours.js";
import {
  canvasToCells,
  cellsToCanvas,
  createCanvas,
  setPixel,
} from "../../src/compilers/mosaic-canvas.js";
import type { Canvas } from "../../src/compilers/mosaic-canvas.js";
import { mosaicCodePoint } from "../../src/grid/mosaic-code-point.js";

// Property 6 (design.md).

const canvases = fc
  .tuple(fc.integer({ min: 1, max: 40 }), fc.integer({ min: 1, max: 20 }))
  .chain(([cols, rows]) =>
    fc
      .array(fc.tuple(fc.nat(2 * cols - 1), fc.nat(3 * rows - 1)), { maxLength: 400 })
      .map((points): Canvas => {
        const canvas = createCanvas(cols, rows);
        for (const [x, y] of points) setPixel(canvas, x, y);
        return canvas;
      }),
  );
const style = fc.record({ fg: fc.constantFrom(...COLOURS), bg: fc.constantFrom(...COLOURS) });

describe("mosaic canvas properties", () => {
  it("Property 6: cellsToCanvas inverts canvasToCells, and every cell is a mosaic of bits 1 to 63 or a text space", () => {
    fc.assert(
      fc.property(canvases, style, (canvas, s) => {
        const cells = canvasToCells(canvas, s);
        expect(cells).toHaveLength(canvas.rows);
        for (const row of cells) {
          expect(row).toHaveLength(canvas.cols);
          for (const cell of row) {
            if (cell.kind === "mosaic") {
              expect(cell.bits).toBeGreaterThanOrEqual(1);
              expect(cell.bits).toBeLessThanOrEqual(63);
              expect(mosaicCodePoint(cell.bits)).toBeDefined();
              expect(cell).toMatchObject({ fg: s.fg, bg: s.bg, separated: false, conceal: false });
            } else {
              expect(cell).toEqual({ kind: "text", ch: " ", fg: s.fg, bg: s.bg, conceal: false });
            }
          }
        }
        expect(cellsToCanvas(cells)).toEqual(canvas);
      }),
    );
  });
});
