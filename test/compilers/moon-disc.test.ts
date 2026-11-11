import { describe, expect, it } from "vitest";
import { moonDisc, moonDiscCells, moonDiscExtent } from "../../src/compilers/moon-disc.js";

function lit(f: number, waxing: boolean): number {
  return moonDisc(f, waxing).pixels.flat().filter(Boolean).length;
}

function discPixels(): number {
  let count = 0;
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 32; x++) {
      // Vertical radius 15 pixels; horizontal radius 15 * 8 / 9 for the 5:4 screen.
      const u = (x + 0.5 - 16) / ((15 * 8) / 9);
      const v = (y + 0.5 - 15) / 15;
      if (u * u + v * v <= 1) count++;
    }
  }
  return count;
}

describe("moonDisc", () => {
  it("is 16 x 10 cells, 32 x 30 pixels", () => {
    const canvas = moonDisc(0.5, true);
    expect([canvas.cols, canvas.rows]).toEqual([16, 10]);
    expect(canvas.pixels).toHaveLength(30);
    expect(canvas.pixels[0]).toHaveLength(32);
  });

  it("has vertical radius 15 pixels and a horizontal radius scaled for the 5:4 screen", () => {
    const extent = moonDiscExtent().pixels;
    const column = extent.map((row) => row[16] === true);
    expect(column.filter(Boolean)).toHaveLength(30);
    const middle = extent[15] ?? [];
    // 2 * 13.33 pixels across, not 30.
    expect(middle.filter(Boolean).length).toBeGreaterThanOrEqual(26);
    expect(middle.filter(Boolean).length).toBeLessThanOrEqual(27);
  });

  it("has an extent that is every pixel of the disc, and holds every lit pixel", () => {
    expect(moonDiscExtent().pixels.flat().filter(Boolean)).toHaveLength(discPixels());
    for (const [f, waxing] of [
      [0.04, true],
      [0.5, false],
      [1, true],
    ] as const) {
      const lit = moonDisc(f, waxing).pixels;
      const extent = moonDiscExtent().pixels;
      lit.forEach((row, y) => {
        row.forEach((on, x) => {
          if (on) expect(extent[y]?.[x]).toBe(true);
        });
      });
    }
  });

  it("lights no pixel at fraction 0 and every disc pixel at fraction 1", () => {
    expect(lit(0, true)).toBe(0);
    expect(lit(0, false)).toBe(0);
    expect(lit(1, true)).toBe(discPixels());
    expect(lit(1, false)).toBe(discPixels());
    expect(discPixels()).toBeGreaterThan(600);
  });

  it("clamps the fraction to 0 to 1", () => {
    expect(lit(-3, true)).toBe(0);
    expect(lit(7, false)).toBe(discPixels());
    expect(lit(Number.NaN, true)).toBe(0);
  });

  it("lights the right side when waxing and the left when waning", () => {
    const waxing = moonDisc(0.25, true).pixels;
    const waning = moonDisc(0.25, false).pixels;
    for (const row of waxing) expect(row.slice(0, 16).some(Boolean)).toBe(false);
    for (const row of waning) expect(row.slice(16).some(Boolean)).toBe(false);
    expect(waxing.flat().filter(Boolean).length).toBe(waning.flat().filter(Boolean).length);
    expect(waxing.flat().some(Boolean)).toBe(true);
  });

  it("lights exactly the right half at fraction 0.5", () => {
    const half = moonDisc(0.5, true).pixels;
    for (const row of half) expect(row.slice(0, 16).some(Boolean)).toBe(false);
    expect(lit(0.5, true) * 2).toBeGreaterThan(discPixels() - 30);
    expect(lit(0.5, true) * 2).toBeLessThanOrEqual(discPixels());
  });

  it("draws lit cells contiguous yellow and dark cells of the disc separated blue (bits 63)", () => {
    const cells = moonDiscCells(0.04, true);
    expect(cells).toHaveLength(10);
    const flat = cells.flat();
    expect(flat).toHaveLength(160);
    const yellow = flat.filter((c) => c.kind === "mosaic" && !c.separated);
    const blue = flat.filter((c) => c.kind === "mosaic" && c.separated);
    expect(yellow.length).toBeGreaterThan(0);
    expect(blue.length).toBeGreaterThan(yellow.length);
    for (const c of yellow) expect(c).toMatchObject({ fg: "yellow", bg: "black", conceal: false });
    for (const c of blue) expect(c).toMatchObject({ bits: 63, fg: "blue", bg: "black" });
    // Each cell is exactly one of: lit (yellow), dark disc (blue) or outside the disc (blank).
    const extent = moonDiscExtent().pixels;
    cells.forEach((row, r) => {
      row.forEach((cell, c) => {
        const inDisc = [0, 1, 2, 3, 4, 5].some(
          (k) => extent[3 * r + Math.floor(k / 2)]?.[2 * c + (k % 2)] === true,
        );
        if (!inDisc) expect(cell.kind).toBe("text");
        else expect(cell.kind).toBe("mosaic");
      });
    });
  });

  it("has no blue cell at full moon and no yellow cell at new moon", () => {
    const full = moonDiscCells(1, true).flat();
    expect(full.some((c) => c.kind === "mosaic" && c.separated)).toBe(false);
    expect(full.some((c) => c.kind === "mosaic")).toBe(true);
    const fresh = moonDiscCells(0, true).flat();
    expect(fresh.some((c) => c.kind === "mosaic" && !c.separated)).toBe(false);
    expect(fresh.some((c) => c.kind === "mosaic" && c.separated)).toBe(true);
  });
});
