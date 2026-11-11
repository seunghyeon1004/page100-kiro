import { describe, expect, it } from "vitest";
import { GLYPHS, blockText } from "../../src/compilers/block-font.js";

const CHARS = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");

describe("block font", () => {
  it("has 36 distinct glyphs of 5 x 7 pixels, and a blank space", () => {
    const seen = new Set<string>();
    for (const ch of CHARS) {
      const glyph = GLYPHS[ch];
      expect(glyph, ch).toHaveLength(7);
      for (const line of glyph ?? []) expect(line).toMatch(/^[#.]{5}$/);
      seen.add((glyph ?? []).join("/"));
      expect((glyph ?? []).join("").includes("#"), ch).toBe(true);
    }
    expect(seen.size).toBe(36);
    expect(GLYPHS[" "]?.join("")).toBe(".".repeat(35));
  });

  it("draws glyph n at x = 6n and y = 1 on a canvas 3 cells high", () => {
    const canvas = blockText("PAGE 100");
    expect(canvas?.rows).toBe(3);
    expect(canvas?.cols).toBe(24);
    const pixel = (x: number, y: number): boolean => canvas?.pixels[y]?.[x] === true;
    // P: ####. on its first row, at x 0..3; column 4 empty on the first row.
    expect([0, 1, 2, 3].map((x) => pixel(x, 1))).toEqual([true, true, true, true]);
    expect(pixel(4, 1)).toBe(false);
    // The second glyph (A) starts at x = 6: .###. on its first row.
    expect([6, 7, 8, 9, 10].map((x) => pixel(x, 1))).toEqual([false, true, true, true, false]);
    // Row 0 and row 8 of the canvas stay off, and so does the gap column between glyphs.
    expect(canvas?.pixels[0]?.some(Boolean)).toBe(false);
    expect(canvas?.pixels[8]?.some(Boolean)).toBe(false);
    for (const x of [5, 11, 17, 23, 29, 35, 41]) {
      expect(
        canvas?.pixels.some((row) => row[x] === true),
        `gap ${String(x)}`,
      ).toBe(false);
    }
  });

  it("returns undefined for any other character", () => {
    expect(blockText("?")).toBeUndefined();
    expect(blockText("a")).toBeUndefined();
    expect(blockText("PAGE-1")).toBeUndefined();
    expect(blockText("É")).toBeUndefined();
    expect(blockText("toString")).toBeUndefined();
  });
});
