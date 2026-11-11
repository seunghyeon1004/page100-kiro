import { BLANK_CELL } from "../grid/blank-cell.js";
import { GRID_COLS } from "../grid/dimensions.js";
import type { Cell, Colour, TextCell } from "../grid/types.js";
import { ATTRIBUTION } from "./attribution.js";
import { formatHeaderClock, formatUtcTime } from "./frame-time.js";
import type { PageDef } from "./page-def.js";

/** The time inputs of the frame (requirement 5.1). `stale` and `lastGoodAt` only affect row 22. */
export interface FrameOptions {
  readonly now: Date;
  readonly stale: boolean;
  readonly lastGoodAt: Date | null;
}

export interface FrameRows {
  readonly row0: readonly Cell[];
  readonly row1: readonly Cell[];
  readonly row22: readonly Cell[];
  readonly row23: readonly Cell[];
}

function text(ch: string, fg: Colour, bg: Colour): TextCell {
  return { kind: "text", ch, fg, bg, conceal: false };
}

interface Run {
  readonly col: number;
  readonly text: string;
  readonly fg: Colour;
  readonly bg: Colour;
}

/** A row of `GRID_COLS` cells: every cell is `fill()`, then the runs overwrite it from their start column. */
function layRow(fill: () => Cell, runs: readonly Run[]): Cell[] {
  const row: Cell[] = Array.from({ length: GRID_COLS }, fill);
  for (const run of runs) {
    Array.from(run.text).forEach((ch, i) => {
      const col = run.col + i;
      if (col < GRID_COLS) row[col] = text(ch, run.fg, run.bg);
    });
  }
  return row;
}

const blank = (): Cell => BLANK_CELL;

function row0(def: PageDef, now: Date): Cell[] {
  return layRow(blank, [
    { col: 0, text: `P${String(def.number)}`, fg: "white", bg: "black" },
    { col: 5, text: "Page 100", fg: "cyan", bg: "black" },
    { col: 21, text: formatHeaderClock(now), fg: "yellow", bg: "black" },
  ]);
}

function row1(def: PageDef, subpageIndex: number, subpageCount: number): Cell[] {
  const runs: Run[] = [{ col: 0, text: def.banner, fg: "yellow", bg: "blue" }];
  if (subpageCount > 1) {
    const indicator = `${String(subpageIndex + 1)}/${String(subpageCount)}`;
    runs.push({ col: GRID_COLS - indicator.length, text: indicator, fg: "white", bg: "blue" });
  }
  return layRow(() => text(" ", "white", "blue"), runs);
}

function row22(def: PageDef, opts: FrameOptions): Cell[] {
  if (def.source === "static") return layRow(blank, []);
  if (opts.stale) {
    const message =
      opts.lastGoodAt === null
        ? "Data delayed"
        : `Data delayed: last good ${formatUtcTime(opts.lastGoodAt)}`;
    return layRow(blank, [{ col: 0, text: message, fg: "yellow", bg: "black" }]);
  }
  const runs: Run[] = [{ col: 0, text: ATTRIBUTION[def.source], fg: "cyan", bg: "black" }];
  if (opts.lastGoodAt !== null) {
    runs.push({ col: 31, text: formatUtcTime(opts.lastGoodAt), fg: "white", bg: "black" });
  }
  return layRow(blank, runs);
}

const LINK_COLOURS: readonly (readonly [Colour, Colour])[] = [
  ["black", "red"],
  ["black", "green"],
  ["black", "yellow"],
  ["white", "blue"],
];

function row23(def: PageDef): Cell[] {
  const row: Cell[] = [];
  def.links.forEach((link, block) => {
    const [fg, bg] = LINK_COLOURS[block] ?? ["black", "red"];
    const cells = Array.from({ length: 10 }, () => text(" ", fg, bg));
    Array.from(link.label).forEach((ch, i) => {
      if (i + 1 < 10) cells[i + 1] = text(ch, fg, bg);
    });
    row.push(...cells);
  });
  return row;
}

/**
 * Rows 0, 1, 22 and 23 for a page (grid-rules.md, Row roles; requirements 6 and 7). Pure. The
 * caller has checked the inputs (see `buildScreen`), and `validateGrid` checks the result.
 */
export function frameRows(
  def: PageDef,
  subpageIndex: number,
  subpageCount: number,
  opts: FrameOptions,
): FrameRows {
  return {
    row0: row0(def, opts.now),
    row1: row1(def, subpageIndex, subpageCount),
    row22: row22(def, opts),
    row23: row23(def),
  };
}
