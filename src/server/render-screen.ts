import { COLOUR_LETTER, COLOUR_RGB } from "../grid/colours.js";
import { mosaicCodePoint } from "../grid/mosaic-code-point.js";
import type { Cell, Colour, ValidPage } from "../grid/types.js";
import { escapeHtml } from "./escape-html.js";

// The screen renderers (server-and-viewer requirements 9.3, 9.4, 11.1, 11.2): HTML runs, plain
// text and ANSI. They take a screen that has already been stamped with the request clock.

/** U+1CE51 is the separated form of pattern 1; pattern b is U+1CE51 + b - 1. */
const SEPARATED_FIRST = 0x1ce51;

/** Which of the three fixed regions of the frame a run belongs to. */
export type RunRole = "pn" | "ck" | "si" | null;

/** A maximal sequence of cells in one row with equal `fg`, `bg` and `conceal`, split also at the fixed boundaries. */
export interface Run {
  readonly start: number;
  readonly cells: readonly Cell[];
  readonly fg: Colour;
  readonly bg: Colour;
  readonly conceal: boolean;
  readonly role: RunRole;
}

function roleAt(row: number, col: number): RunRole {
  if (row === 0) {
    if (col < 4) return "pn";
    return col >= 21 ? "ck" : null;
  }
  if (row === 1 && col >= 35) return "si";
  return null;
}

/**
 * The runs of one row. `r` is the row number; with `fixedSplits` the row also splits where the
 * page number (row 0, cols 0 to 3), the clock (row 0, cols 21 to 39) and the subpage indicator
 * (row 1, cols 35 to 39) begin and end.
 */
export function screenRuns(row: readonly Cell[], r: number, fixedSplits = true): Run[] {
  const runs: Run[] = [];
  let current: { start: number; cells: Cell[]; role: RunRole } | undefined;
  const flush = (): void => {
    const first = current?.cells[0];
    if (current === undefined || first === undefined) return;
    runs.push({
      start: current.start,
      cells: current.cells,
      fg: first.fg,
      bg: first.bg,
      conceal: first.conceal,
      role: current.role,
    });
  };
  row.forEach((cell, col) => {
    const role = fixedSplits ? roleAt(r, col) : null;
    const first = current?.cells[0];
    if (
      current !== undefined &&
      first?.fg === cell.fg &&
      first.bg === cell.bg &&
      first.conceal === cell.conceal &&
      current.role === role
    ) {
      current.cells.push(cell);
      return;
    }
    flush();
    current = { start: col, cells: [cell], role };
  });
  flush();
  return runs;
}

/** The character a cell is drawn with in HTML: its text, or its mosaic (the separated form has its own code points). */
export function htmlCodePoint(cell: Cell): string {
  if (cell.kind === "text") return cell.ch;
  const cp = cell.separated ? SEPARATED_FIRST + cell.bits - 1 : mosaicCodePoint(cell.bits);
  return String.fromCodePoint(cp ?? 0x20);
}

/** The character a cell has in the text and ANSI formats: a mosaic's `mosaicCodePoint` (separated too). */
function txtChar(cell: Cell, reveal: boolean): string {
  if (cell.conceal && !reveal) return " ";
  if (cell.kind === "text") return cell.ch;
  return String.fromCodePoint(mosaicCodePoint(cell.bits) ?? 0x20);
}

function classesOf(run: Run): string {
  const classes: string[] = [];
  if (run.fg !== "white") classes.push(`f${COLOUR_LETTER[run.fg]}`);
  if (run.bg !== "black") classes.push(`b${COLOUR_LETTER[run.bg]}`);
  if (run.conceal) classes.push("conceal");
  if (run.role !== null) classes.push(run.role);
  return classes.join(" ");
}

/** The screen as `<div class="screen" aria-hidden="true">` with 24 row divisions of runs. */
export function renderScreenHtml(screen: ValidPage): string {
  const rows = screen.map((row, r) => {
    const spans = screenRuns(row, r).map((run) => {
      const classes = classesOf(run);
      const open = classes === "" ? "<span>" : `<span class="${classes}">`;
      return `${open}${escapeHtml(run.cells.map(htmlCodePoint).join(""))}</span>`;
    });
    return `<div class="r">${spans.join("")}</div>`;
  });
  return `<div class="screen" aria-hidden="true">${rows.join("")}</div>`;
}

/** 24 lines of 40 code points, each ending in LF; a concealed cell is a space unless `reveal`. */
export function renderTxt(screen: ValidPage, reveal: boolean): string {
  return screen.map((row) => `${row.map((cell) => txtChar(cell, reveal)).join("")}\n`).join("");
}

function sgr(colour: Colour, layer: 38 | 48): string {
  const [red, green, blue] = COLOUR_RGB[colour];
  return `\u001b[${String(layer)};2;${String(red)};${String(green)};${String(blue)}m`;
}

/** As `renderTxt`, with a colour pair before each run and one reset at the end of each line. */
export function renderAnsi(screen: ValidPage, reveal: boolean): string {
  return screen
    .map((row, r) => {
      const body = screenRuns(row, r, false)
        .map(
          (run) =>
            `${sgr(run.fg, 38)}${sgr(run.bg, 48)}${run.cells.map((cell) => txtChar(cell, reveal)).join("")}`,
        )
        .join("");
      return `${body}\u001b[0m\n`;
    })
    .join("");
}
