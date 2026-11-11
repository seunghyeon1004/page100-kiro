import { BLANK_CELL } from "../grid/blank-cell.js";
import { COLOUR_LETTER, COLOURS } from "../grid/colours.js";
import { formatCodePoint, quoteIfSafe } from "../grid/grid-violation.js";
import { mosaicBitsOf } from "../grid/mosaic-code-point.js";
import { isRepertoireCodePoint } from "../grid/repertoire.js";
import type { Cell, Colour } from "../grid/types.js";
import type { MarkupError } from "./markup-error.js";

const GRID_COLS = 40;

/** Foreground letters (`r`) and background letters (`R`) mapped to their colours. */
const FOREGROUND: ReadonlyMap<string, Colour> = new Map(
  COLOURS.map((colour) => [COLOUR_LETTER[colour], colour]),
);
const BACKGROUND: ReadonlyMap<string, Colour> = new Map(
  COLOURS.map((colour) => [COLOUR_LETTER[colour].toUpperCase(), colour]),
);

export type RowResult =
  | { readonly ok: true; readonly cells: readonly Cell[] }
  | { readonly ok: false; readonly error: MarkupError };

/**
 * The number of cells a line would make, counted over the whole line (design, "Counting rule for
 * row-too-long"). `{{` counts 1, a tag `{...}` counts 0, a `{` with no closing `}` counts 1, CR
 * counts 0 and any other code point counts 1.
 */
function countCells(line: string): number {
  let count = 0;
  let i = 0;
  while (i < line.length) {
    const unit = line[i];
    if (unit === "{") {
      if (line[i + 1] === "{") {
        count += 1;
        i += 2;
        continue;
      }
      const close = line.indexOf("}", i + 1);
      if (close === -1) {
        count += 1;
        i += 1;
        continue;
      }
      i = close + 1;
      continue;
    }
    if (unit === "\r") {
      i += 1;
      continue;
    }
    const cp = line.codePointAt(i) ?? 0;
    i += cp > 0xffff ? 2 : 1;
    count += 1;
  }
  return count;
}

/**
 * Parses one line into exactly 40 cells, or returns the first error by position. The state (fg
 * white, bg black, conceal off, separated off) starts fresh on every line (requirement 13.6).
 */
export function parseRow(line: string, row: number): RowResult {
  let fg: Colour = "white";
  let bg: Colour = "black";
  let conceal = false;
  let separated = false;
  const cells: Cell[] = [];

  const fail = (error: MarkupError): RowResult => ({ ok: false, error });
  const tooLong = (): RowResult =>
    fail({
      code: "row-too-long",
      row,
      col: GRID_COLS,
      cells: countCells(line),
      message: `row ${String(row)} is ${String(countCells(line))} cells, limit ${String(GRID_COLS)}`,
    });

  let i = 0;
  while (i < line.length) {
    const cp = line.codePointAt(i) ?? 0;
    const width = cp > 0xffff ? 2 : 1;
    const col = cells.length;
    const at = `row ${String(row)} col ${String(col)}`;

    if (cp === 0x0d) {
      return fail({
        code: "cr",
        row,
        col,
        message: `${at}: carriage return (U+000D) is not allowed; use LF line endings`,
      });
    }

    if (cp === 0x7b) {
      // `{{` is a literal `{` text cell.
      if (line[i + 1] === "{") {
        if (cells.length === GRID_COLS) return tooLong();
        cells.push({ kind: "text", ch: "{", fg, bg, conceal });
        i += 2;
        continue;
      }
      const close = line.indexOf("}", i + 1);
      if (close === -1) {
        return fail({
          code: "tag-unterminated",
          row,
          col,
          message: `${at}: { has no closing }; write {{ for a literal {`,
        });
      }
      const tag = line.slice(i, close + 1);
      const body = line.slice(i + 1, close);
      const foregroundColour = FOREGROUND.get(body);
      const backgroundColour = BACKGROUND.get(body);
      if (foregroundColour !== undefined) {
        fg = foregroundColour;
      } else if (backgroundColour !== undefined) {
        bg = backgroundColour;
      } else if (body === "?") {
        if (conceal) {
          return fail({
            code: "mode-already-on",
            row,
            col,
            mode: "conceal",
            message: `${at}: {?} but conceal is already on`,
          });
        }
        conceal = true;
      } else if (body === "/?") {
        if (!conceal) {
          return fail({
            code: "mode-not-on",
            row,
            col,
            mode: "conceal",
            message: `${at}: {/?} but conceal is not on`,
          });
        }
        conceal = false;
      } else if (body === "~") {
        if (separated) {
          return fail({
            code: "mode-already-on",
            row,
            col,
            mode: "separated",
            message: `${at}: {~} but separated mosaics are already on`,
          });
        }
        separated = true;
      } else if (body === "/~") {
        if (!separated) {
          return fail({
            code: "mode-not-on",
            row,
            col,
            mode: "separated",
            message: `${at}: {/~} but separated mosaics are not on`,
          });
        }
        separated = false;
      } else {
        const quoted = quoteIfSafe(tag);
        const shown = quoted === undefined ? "" : ` ${quoted}`;
        return fail({
          code: "tag-unknown",
          row,
          col,
          tag,
          message: `${at}: unknown tag${shown}`,
        });
      }
      i = close + 1;
      continue;
    }

    if (isRepertoireCodePoint(cp)) {
      // A text space is U+0020. Any other repertoire character is a text cell with that character.
      if (cells.length === GRID_COLS) return tooLong();
      cells.push({ kind: "text", ch: String.fromCodePoint(cp), fg, bg, conceal });
      i += width;
      continue;
    }

    const bits = mosaicBitsOf(cp);
    if (bits !== undefined && bits >= 1) {
      if (cells.length === GRID_COLS) return tooLong();
      cells.push({ kind: "mosaic", bits, separated, fg, bg, conceal });
      i += width;
      continue;
    }

    return fail({
      code: "char-not-allowed",
      row,
      col,
      codePoint: cp,
      message: `${at}: ${formatCodePoint(cp)} is not allowed`,
    });
  }

  while (cells.length < GRID_COLS) {
    cells.push(BLANK_CELL);
  }
  return { ok: true, cells };
}
