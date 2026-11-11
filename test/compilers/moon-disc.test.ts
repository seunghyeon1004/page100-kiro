import { describe, expect, it } from "vitest";
import { moonDisc } from "../../src/compilers/moon-disc.js";

function lit(f: number, waxing: boolean): number {
  return moonDisc(f, waxing).pixels.flat().filter(Boolean).length;
}

function discPixels(): number {
  let count = 0;
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 16; x++) {
      const u = (x + 0.5 - 8) / 8;
      const v = (y + 0.5 - 9) / 9;
      if (u * u + v * v <= 1) count++;
    }
  }
  return count;
}

describe("moonDisc", () => {
  it("is 8 x 6 cells", () => {
    const canvas = moonDisc(0.5, true);
    expect([canvas.cols, canvas.rows]).toEqual([8, 6]);
    expect(canvas.pixels).toHaveLength(18);
    expect(canvas.pixels[0]).toHaveLength(16);
  });

  it("lights no pixel at fraction 0 and every disc pixel at fraction 1", () => {
    expect(lit(0, true)).toBe(0);
    expect(lit(0, false)).toBe(0);
    expect(lit(1, true)).toBe(discPixels());
    expect(lit(1, false)).toBe(discPixels());
    expect(discPixels()).toBeGreaterThan(150);
  });

  it("clamps the fraction to 0 to 1", () => {
    expect(lit(-3, true)).toBe(0);
    expect(lit(7, false)).toBe(discPixels());
    expect(lit(Number.NaN, true)).toBe(0);
  });

  it("lights the right side when waxing and the left when waning", () => {
    const waxing = moonDisc(0.25, true).pixels;
    const waning = moonDisc(0.25, false).pixels;
    for (const row of waxing) expect(row.slice(0, 8).some(Boolean)).toBe(false);
    for (const row of waning) expect(row.slice(8).some(Boolean)).toBe(false);
    expect(waxing.flat().filter(Boolean).length).toBe(waning.flat().filter(Boolean).length);
    expect(waxing.flat().some(Boolean)).toBe(true);
  });

  it("lights exactly the right half at fraction 0.5", () => {
    const half = moonDisc(0.5, true).pixels;
    for (const row of half) expect(row.slice(0, 8).some(Boolean)).toBe(false);
    expect(lit(0.5, true) * 2).toBeGreaterThan(discPixels() - 8);
    expect(lit(0.5, true) * 2).toBeLessThanOrEqual(discPixels());
  });
});
