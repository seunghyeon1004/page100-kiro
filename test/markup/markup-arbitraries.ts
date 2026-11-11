import fc from "fast-check";
import { COLOUR_LETTER } from "../../src/grid/colours.js";
import { mosaicCodePoint } from "../../src/grid/mosaic-code-point.js";
import type { Cell } from "../../src/grid/types.js";

// A second, independent writer of markup. The parser under test is checked against it, so this
// file does not call the serialiser: it writes every tag itself, with optional noise.

/** Per-cell choices that add noise without changing the grid. */
export interface NoiseChoices {
  /** Emit the colour tags of a cell even when the colour has not changed. */
  readonly repeatColour: readonly boolean[];
  /** Emit an open-and-close pair (`{?}{/?}` or `{~}{/~}`) that leaves the mode as it was. */
  readonly togglePair: readonly boolean[];
}

/** Tokens that are never valid markup, placed in content rows by the parser properties. */
export const ALWAYS_INVALID_TOKENS = ["{x}", "{}", "\t", "\r", "\u{1f600}"] as const;

/**
 * Writes the cells of one row as one group per cell. A group is a list of tokens: the tags that
 * change state before the cell, then the cell's character. Joining the groups gives the row.
 */
export function rowGroups(cells: readonly Cell[], noise: NoiseChoices): string[][] {
  let bg: Cell["bg"] = "black";
  let fg: Cell["fg"] = "white";
  let conceal = false;
  let separated = false;
  return cells.map((cell, k) => {
    const group: string[] = [];
    const repeat = noise.repeatColour[k] === true;
    if (cell.bg !== bg || repeat) {
      group.push(`{${COLOUR_LETTER[cell.bg].toUpperCase()}}`);
      bg = cell.bg;
    }
    if (cell.fg !== fg || repeat) {
      group.push(`{${COLOUR_LETTER[cell.fg]}}`);
      fg = cell.fg;
    }
    if (cell.conceal !== conceal) {
      group.push(cell.conceal ? "{?}" : "{/?}");
      conceal = cell.conceal;
    } else if (noise.togglePair[k] === true && !conceal) {
      group.push("{?}{/?}");
    }
    if (cell.kind === "mosaic") {
      if (cell.separated !== separated) {
        group.push(cell.separated ? "{~}" : "{/~}");
        separated = cell.separated;
      } else if (noise.togglePair[k] === true && !separated) {
        group.push("{~}{/~}");
      }
      const cp = mosaicCodePoint(cell.bits);
      if (cp === undefined) throw new Error("the test cell has invalid bits");
      group.push(String.fromCodePoint(cp));
    } else {
      group.push(cell.ch === "{" ? "{{" : cell.ch);
    }
    return group;
  });
}

/** Noise choices for one row of `cells` cells, from fast-check. */
export const noiseFor = (cells: number): fc.Arbitrary<NoiseChoices> =>
  fc.record({
    repeatColour: fc.array(fc.boolean(), { minLength: cells, maxLength: cells }),
    togglePair: fc.array(fc.boolean(), { minLength: cells, maxLength: cells }),
  });

/** Whether a line parsed from this group list would still be a line: groups joined by nothing. */
export function joinGroups(groups: readonly (readonly string[])[], upTo = groups.length): string {
  return groups
    .slice(0, upTo)
    .map((group) => group.join(""))
    .join("");
}
