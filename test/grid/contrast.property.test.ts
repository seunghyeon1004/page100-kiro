import fc from "fast-check";
import { describe, it } from "vitest";
import { COLOURS } from "../../src/grid/colours.js";
import { contrastRatio, isLegibleText } from "../../src/grid/contrast.js";
import type { Colour } from "../../src/grid/types.js";

// The 20 legible (fg, bg) pairs, written by hand from grid-rules.md (not derived from the code).
const LEGIBLE_PAIRS: readonly string[] = [
  "red/black",
  "green/black",
  "yellow/black",
  "magenta/black",
  "cyan/black",
  "white/black",
  "black/red",
  "black/green",
  "blue/green",
  "black/yellow",
  "blue/yellow",
  "green/blue",
  "yellow/blue",
  "cyan/blue",
  "white/blue",
  "black/magenta",
  "black/cyan",
  "blue/cyan",
  "black/white",
  "blue/white",
];

const colour = fc.constantFrom(...COLOURS);

describe("contrast properties (Property 1)", () => {
  it("Property 1: for all colours fg and bg, the ratio is symmetric and legibility matches the 20 listed pairs", () => {
    fc.assert(
      fc.property(colour, colour, (fg: Colour, bg: Colour) => {
        if (contrastRatio(fg, bg) !== contrastRatio(bg, fg)) return false;
        return isLegibleText(fg, bg) === LEGIBLE_PAIRS.includes(`${fg}/${bg}`);
      }),
    );
  });
});
