import { contrastRatio, isLegibleText } from "../../src/grid/contrast.js";
import type { Colour } from "../../src/grid/types.js";

/** The ratio of a text pair and whether the validator allows it (4.5:1 or more, unrounded). */
export function contrastReport(fg: Colour, bg: Colour): string {
  const ratio = contrastRatio(fg, bg);
  const verdict = isLegibleText(fg, bg)
    ? "text allowed"
    : "text NOT allowed (needs 4.5:1; text spaces and mosaic cells are exempt)";
  return `${fg} on ${bg}: ${ratio.toFixed(2)}:1 (${String(ratio)}), ${verdict}`;
}
