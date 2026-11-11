import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mosaicCodePoint } from "../../src/grid/mosaic-code-point.js";
import { REPERTOIRE } from "../../src/grid/repertoire.js";

// server-and-viewer 13.5: the coverage file of the font subset lists every code point the
// screen can draw: the repertoire, the 63 mosaics and the 63 separated mosaics.

const ROOT = resolve(import.meta.dirname, "..", "..");
const SEPARATED_FIRST = 0x1ce51;

function readCoverage(): ReadonlySet<number> {
  const value: unknown = JSON.parse(
    readFileSync(resolve(ROOT, "public/fonts/bedstead-extended-subset.coverage.json"), "utf8"),
  );
  if (!Array.isArray(value) || !value.every((v): v is number => typeof v === "number")) {
    throw new Error("coverage file is not an array of numbers");
  }
  return new Set(value);
}

describe("font coverage (13.5)", () => {
  const coverage = readCoverage();

  it("holds every code point of REPERTOIRE", () => {
    expect(REPERTOIRE).toHaveLength(160);
    for (const cp of REPERTOIRE) {
      expect(coverage.has(cp), cp.toString(16)).toBe(true);
    }
  });

  it("holds mosaicCodePoint(v) for v from 1 to 63", () => {
    for (let v = 1; v <= 63; v++) {
      expect(coverage.has(mosaicCodePoint(v) ?? -1), `v=${String(v)}`).toBe(true);
    }
  });

  it("holds U+1CE51 to U+1CE8F", () => {
    for (let cp = SEPARATED_FIRST; cp < SEPARATED_FIRST + 63; cp++) {
      expect(coverage.has(cp), cp.toString(16)).toBe(true);
    }
  });

  it("holds nothing else (160 + 63 + 63 code points)", () => {
    expect(coverage.size).toBe(286);
  });
});
