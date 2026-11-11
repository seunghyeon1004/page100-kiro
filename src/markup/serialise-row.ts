import { COLOUR_LETTER } from "../grid/colours.js";
import { isBlankCell } from "../grid/blank-cell.js";
import { mosaicCodePoint } from "../grid/mosaic-code-point.js";
import type { Cell, Colour } from "../grid/types.js";

/** The text a cell contributes to the markup, without the tags before it. */
function cellText(cell: Cell): string {
  if (cell.kind === "text") {
    return cell.ch === "{" ? "{{" : cell.ch;
  }
  const cp = mosaicCodePoint(cell.bits);
  // A validated page has bits from 1 to 63, so this is an invariant, not an input error.
  if (cp === undefined) throw new Error(`mosaic bits ${String(cell.bits)} have no code point`);
  return String.fromCodePoint(cp);
}

/**
 * The canonical markup of one row (requirements 16.2 to 16.4). Before each cell it writes only the
 * tags whose state changes, in the order bg, fg, conceal, separated. Trailing blank cells are
 * dropped. The row starts from the default state of requirement 13.6.
 */
export function serialiseRow(cells: readonly Cell[]): string {
  let last = -1;
  cells.forEach((cell, index) => {
    if (!isBlankCell(cell)) last = index;
  });

  let bg: Colour = "black";
  let fg: Colour = "white";
  let conceal = false;
  let separated = false;
  let out = "";
  for (let index = 0; index <= last; index++) {
    const cell = cells[index];
    if (cell === undefined) break;
    if (cell.bg !== bg) {
      out += `{${COLOUR_LETTER[cell.bg].toUpperCase()}}`;
      bg = cell.bg;
    }
    if (cell.fg !== fg) {
      out += `{${COLOUR_LETTER[cell.fg]}}`;
      fg = cell.fg;
    }
    if (cell.conceal !== conceal) {
      out += cell.conceal ? "{?}" : "{/?}";
      conceal = cell.conceal;
    }
    if (cell.kind === "mosaic" && cell.separated !== separated) {
      out += cell.separated ? "{~}" : "{/~}";
      separated = cell.separated;
    }
    out += cellText(cell);
  }
  return out;
}
