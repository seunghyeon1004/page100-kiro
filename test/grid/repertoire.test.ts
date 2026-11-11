import { describe, expect, it } from "vitest";
import { isRepertoireCodePoint, REPERTOIRE } from "../../src/grid/repertoire.js";

describe("repertoire (requirement 6.1)", () => {
  it("has exactly 160 code points in ascending order", () => {
    expect(REPERTOIRE).toHaveLength(160);
    for (let i = 1; i < REPERTOIRE.length; i++) {
      expect(REPERTOIRE[i]).toBeGreaterThan(REPERTOIRE[i - 1] ?? Number.NaN);
    }
  });

  it("holds the three ranges of the table and no others", () => {
    expect(REPERTOIRE.filter((cp) => cp >= 0x20 && cp <= 0x7e)).toHaveLength(95);
    expect(REPERTOIRE.filter((cp) => cp === 0xa3 || cp === 0xb0 || cp === 0x20ac)).toHaveLength(3);
    const latin1 = REPERTOIRE.filter((cp) => cp >= 0xc0 && cp <= 0xff);
    expect(latin1).toHaveLength(62);
    expect(latin1).not.toContain(0xd7);
    expect(latin1).not.toContain(0xf7);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(REPERTOIRE)).toBe(true);
  });
});

describe("isRepertoireCodePoint (requirement 6.2)", () => {
  it("rejects the excluded code points named in the requirement", () => {
    const excluded = [
      0xd7, 0xf7, 0xa0, 0x7f, 0x09, 0x0a, 0x0d, 0x2588, 0x258c, 0x2590, 0xd800, 0xdfff,
    ];
    for (const cp of excluded) {
      expect(isRepertoireCodePoint(cp), `U+${cp.toString(16)}`).toBe(false);
    }
    for (let cp = 0x1fb00; cp <= 0x1fb3b; cp++) {
      expect(isRepertoireCodePoint(cp)).toBe(false);
    }
  });

  it("rejects non-integers and values outside 0 to U+10FFFF", () => {
    for (const value of [1.5, -1, 0x110000, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isRepertoireCodePoint(value)).toBe(false);
    }
  });

  it("agrees with the array on every value from -1 to U+110000", () => {
    const members = new Set(REPERTOIRE);
    for (let cp = -1; cp <= 0x110000; cp++) {
      expect(isRepertoireCodePoint(cp)).toBe(members.has(cp));
    }
  });
});
