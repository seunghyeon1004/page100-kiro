import { describe, expect, it } from "vitest";
import { mosaicBitsOf, mosaicCodePoint } from "../../src/grid/mosaic-code-point.js";

describe("mosaic code points (requirements 5.1 and 5.2)", () => {
  it("maps the four special patterns to their code points", () => {
    expect(mosaicCodePoint(0)).toBe(0x0020);
    expect(mosaicCodePoint(21)).toBe(0x258c);
    expect(mosaicCodePoint(42)).toBe(0x2590);
    expect(mosaicCodePoint(63)).toBe(0x2588);
  });

  it("maps the four anchor sextants: 1, 22 (SEXTANT-235), 43 (SEXTANT-1246) and 62", () => {
    expect(mosaicCodePoint(1)).toBe(0x1fb00);
    expect(mosaicCodePoint(22)).toBe(0x1fb14);
    expect(mosaicCodePoint(43)).toBe(0x1fb28);
    expect(mosaicCodePoint(62)).toBe(0x1fb3b);
  });
});

describe("mosaic order (requirement 5.5)", () => {
  it("is strictly increasing over the 60 sextant patterns, giving U+1FB00 to U+1FB3B in order", () => {
    const sextants: number[] = [];
    for (let v = 1; v <= 62; v++) {
      if (v === 21 || v === 42) continue;
      const cp = mosaicCodePoint(v);
      if (cp === undefined) throw new Error(`no code point for ${String(v)}`);
      sextants.push(cp);
    }
    expect(sextants).toHaveLength(60);
    expect(sextants[0]).toBe(0x1fb00);
    expect(sextants[59]).toBe(0x1fb3b);
    for (let i = 1; i < sextants.length; i++) {
      expect(sextants[i]).toBeGreaterThan(sextants[i - 1] ?? Number.NaN);
    }
  });
});

describe("invalid pattern values (requirement 5.4)", () => {
  it("returns undefined for values that are not integers from 0 to 63", () => {
    for (const v of [-1, 64, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(mosaicCodePoint(v)).toBeUndefined();
    }
  });
});

describe("mosaicBitsOf (requirement 5.3)", () => {
  it("returns undefined for code points that are not mosaic forms", () => {
    for (const cp of [0x41, 0x2587, 0x2589, 0x1fb3c, 0x1faff, 0x1fb00 - 1, Number.NaN]) {
      expect(mosaicBitsOf(cp)).toBeUndefined();
    }
  });
});
