import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COLOUR_RGB } from "../../src/grid/colours.js";
import { contrastRatio, isLegibleText, relativeLuminance } from "../../src/grid/contrast.js";
import type { Colour } from "../../src/grid/types.js";

// The full matrix of grid-rules.md. Rows are fg, columns are bg, both in the order k r g y b m c w.
const ORDER: readonly Colour[] = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
];

const MATRIX: readonly (readonly string[])[] = [
  ["1.00", "5.25", "15.30", "19.56", "2.44", "6.70", "16.75", "21.00"],
  ["5.25", "1.00", "2.91", "3.72", "2.15", "1.27", "3.19", "4.00"],
  ["15.30", "2.91", "1.00", "1.28", "6.26", "2.29", "1.09", "1.37"],
  ["19.56", "3.72", "1.28", "1.00", "8.00", "2.92", "1.17", "1.07"],
  ["2.44", "2.15", "6.26", "8.00", "1.00", "2.74", "6.85", "8.59"],
  ["6.70", "1.27", "2.29", "2.92", "2.74", "1.00", "2.50", "3.14"],
  ["16.75", "3.19", "1.09", "1.17", "6.85", "2.50", "1.00", "1.25"],
  ["21.00", "4.00", "1.37", "1.07", "8.59", "3.14", "1.25", "1.00"],
];

// The 20 legible (fg, bg) pairs, written out from the allowed-pairs table of grid-rules.md.
const LEGIBLE_PAIRS: readonly (readonly [Colour, Colour])[] = [
  ["red", "black"],
  ["green", "black"],
  ["yellow", "black"],
  ["magenta", "black"],
  ["cyan", "black"],
  ["white", "black"],
  ["black", "red"],
  ["black", "green"],
  ["blue", "green"],
  ["black", "yellow"],
  ["blue", "yellow"],
  ["green", "blue"],
  ["yellow", "blue"],
  ["cyan", "blue"],
  ["white", "blue"],
  ["black", "magenta"],
  ["black", "cyan"],
  ["blue", "cyan"],
  ["black", "white"],
  ["blue", "white"],
];

describe("relative luminance (requirement 3.4)", () => {
  it("rounds to the table values to 4 decimals", () => {
    const expected: Record<Colour, string> = {
      black: "0.0000",
      red: "0.2126",
      green: "0.7152",
      yellow: "0.9278",
      blue: "0.0722",
      magenta: "0.2848",
      cyan: "0.7874",
      white: "1.0000",
    };
    for (const colour of ORDER) {
      expect(relativeLuminance(COLOUR_RGB[colour]).toFixed(4)).toBe(expected[colour]);
    }
  });
});

describe("contrast ratio (requirements 4.1 and 4.2)", () => {
  it("rounds all 64 pairs to the matrix of grid-rules.md", () => {
    ORDER.forEach((fg, row) => {
      ORDER.forEach((bg, col) => {
        const expected = MATRIX[row]?.[col];
        expect(contrastRatio(fg, bg).toFixed(2), `${fg} on ${bg}`).toBe(expected);
      });
    });
  });

  it("puts the closest values to the threshold on the right side of 4.5", () => {
    expect(contrastRatio("white", "red").toFixed(2)).toBe("4.00");
    expect(contrastRatio("red", "black").toFixed(2)).toBe("5.25");
  });

  it("holds no matrix value other than 1.00 as a numeric literal in contrast.ts", () => {
    const source = readFileSync(resolve(import.meta.dirname, "../../src/grid/contrast.ts"), "utf8");
    const matrixValues = new Set(
      MATRIX.flat()
        .map(Number)
        .filter((value) => value !== 1),
    );
    const literals = source.match(/\d+(?:\.\d+)?/g) ?? [];
    expect(literals.length).toBeGreaterThan(0);
    const clashes = literals.filter((literal) => matrixValues.has(Number(literal)));
    expect(clashes).toEqual([]);
  });
});

describe("symmetry and legibility (requirements 4.3, 4.4 and 4.5)", () => {
  it("returns the same ratio for both argument orders", () => {
    for (const a of ORDER) {
      for (const b of ORDER) {
        expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
      }
    }
  });

  it("is legible for exactly the 20 listed pairs", () => {
    const legible = new Set(LEGIBLE_PAIRS.map(([fg, bg]) => `${fg}/${bg}`));
    expect(legible.size).toBe(20);
    for (const fg of ORDER) {
      for (const bg of ORDER) {
        expect(isLegibleText(fg, bg), `${fg} on ${bg}`).toBe(legible.has(`${fg}/${bg}`));
      }
    }
  });

  it("rejects white on red and accepts red on black", () => {
    expect(isLegibleText("white", "red")).toBe(false);
    expect(isLegibleText("red", "black")).toBe(true);
  });
});
