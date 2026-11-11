import { BLANK_CELL, isBlankCell } from "../grid/blank-cell.js";
import { CONTENT_FIRST_ROW, CONTENT_ROW_COUNT, GRID_COLS } from "../grid/dimensions.js";
import { formatCodePoint } from "../grid/grid-violation.js";
import { toNonEmpty } from "../grid/non-empty.js";
import { isRepertoireCodePoint } from "../grid/repertoire.js";
import type { Cell, NonEmpty, Rows, TextCell } from "../grid/types.js";
import { validateContentRows } from "../grid/validate-content-rows.js";
import { parseContent } from "../markup/parse-content.js";
import { checkAltAgreement } from "../pages/alt-agreement.js";
import type { AltBlock, LinkTarget } from "../pages/alt-block.js";
import type { Subpage } from "../pages/compiled-page.js";
import type { CellStyle } from "./cell-style.js";
import { DEFAULT_STYLE } from "./cell-style.js";
import type { CompileProblem, CompileProblemCode } from "./compile-types.js";

// The content builder (rule-compilers requirement 4, design.md, "Content builder"). Rows and
// columns given to its methods are content rows 0 to 19 and cells 0 to 39. A problem carries the
// page row (content row + 2). The builder never throws and never cuts text.

export type { CellStyle } from "./cell-style.js";

/** One table column: where it sits on the grid and how its values are aligned. */
export interface Column {
  readonly header: string;
  readonly col: number;
  readonly width: number;
  readonly align: "left" | "right";
  readonly style: CellStyle;
  /** False keeps the header out of the grid; it stays in the text alternative. Default true. */
  readonly showHeader?: boolean;
}

export type BuildResult =
  | { readonly ok: true; readonly subpage: Subpage }
  | { readonly ok: false; readonly problems: NonEmpty<CompileProblem> };

export interface ContentBuilder {
  /** Text on the grid only. */
  text(row: number, col: number, text: string, style?: CellStyle): void;
  /** One line of content markup on the grid only, from cell 0 to its last visible cell. */
  markup(row: number, line: string): void;
  /** Ready-made cells (mosaics from `canvasToCells`) on the grid only. */
  cells(row: number, col: number, cells: Rows): void;
  /** A block of the text alternative only. */
  alt(block: AltBlock): void;
  heading(row: number, col: number, text: string, style?: CellStyle, level?: 2 | 3): void;
  /** Wrapped rows on the grid and one paragraph in the alternative. */
  lines(row: number, col: number, rows: readonly string[], style?: CellStyle): void;
  /** A table; returns the number of rows it used. */
  table(
    row: number,
    columns: NonEmpty<Column>,
    records: readonly (readonly (string | readonly string[])[])[],
    headerRow: boolean,
  ): number;
  link(
    row: number,
    col: number,
    parts: readonly (readonly [string, CellStyle])[],
    target: LinkTarget,
  ): void;
  /** A label and a value that stays concealed until Reveal; the alternative gets a `concealed` block. */
  concealed(
    row: number,
    col: number,
    label: readonly [string, CellStyle],
    value: readonly [string, CellStyle],
    summary: string,
  ): void;
  build(): BuildResult;
}

/** Runs of spaces become one space, and the ends are trimmed. */
export function collapseSpaces(text: string): string {
  return text.replace(/ {2,}/g, " ").trim();
}

/**
 * Joins wrapped rows into one text: with one space, or with nothing after a row that ends in a
 * hyphen inside a word (a split made by `wrapWords`).
 */
export function joinRows(rows: readonly string[]): string {
  let joined = "";
  rows.forEach((row, i) => {
    joined += row;
    const splitHyphen = row.length > 1 && row.endsWith("-") && !row.endsWith(" -");
    if (i < rows.length - 1 && !splitHyphen) joined += " ";
  });
  return joined;
}

function width(text: string): number {
  return Array.from(text).length;
}

function textCells(text: string, style: CellStyle): TextCell[] {
  return Array.from(text).map((ch): TextCell => ({
    kind: "text",
    ch,
    fg: style.fg,
    bg: style.bg,
    conceal: style.conceal === true,
  }));
}

/** A new builder with an empty grid and no alternative. */
export function createContentBuilder(): ContentBuilder {
  const grid: (Cell | undefined)[][] = Array.from({ length: CONTENT_ROW_COUNT }, () =>
    Array.from({ length: GRID_COLS }, () => undefined),
  );
  const problems: CompileProblem[] = [];
  const altBlocks: AltBlock[] = [];

  function record(
    code: CompileProblemCode,
    row: number,
    col: number | null,
    message: string,
  ): void {
    const pageRow = Number.isInteger(row) ? row + CONTENT_FIRST_ROW : null;
    problems.push({ code, subpage: null, row: pageRow, col, message });
  }

  /** Checks one run of cells; records the problems and says whether the run may be written. */
  function check(row: number, col: number, cells: readonly Cell[]): boolean {
    if (cells.length === 0) return true;
    const rowOk = Number.isInteger(row) && row >= 0 && row < CONTENT_ROW_COUNT;
    const colOk = Number.isInteger(col) && col >= 0 && col + cells.length <= GRID_COLS;
    if (!rowOk || !colOk) {
      const at = !Number.isInteger(col)
        ? null
        : col < 0
          ? col
          : col + cells.length > GRID_COLS
            ? Math.max(col, GRID_COLS)
            : col;
      record(
        "out-of-bounds",
        row,
        at,
        `${String(cells.length)} cells at content row ${String(row)}, col ${String(col)} do not fit in 20 rows of 40 cells`,
      );
      return false;
    }
    let ok = true;
    let overlapped = false;
    cells.forEach((cell, i) => {
      if (cell.kind === "text") {
        const cp = cell.ch.codePointAt(0);
        if (
          cp === undefined ||
          cell.ch.length !== (cp > 0xffff ? 2 : 1) ||
          !isRepertoireCodePoint(cp)
        ) {
          ok = false;
          record(
            "not-repertoire",
            row,
            col + i,
            `code point ${cp === undefined ? "none" : formatCodePoint(cp)} is not in the character repertoire`,
          );
        }
      }
      if (!overlapped && grid[row]?.[col + i] !== undefined) {
        overlapped = true;
        ok = false;
        record("overlap", row, col + i, `cell at col ${String(col + i)} was already written`);
      }
    });
    return ok;
  }

  function write(row: number, col: number, cells: readonly Cell[]): void {
    cells.forEach((cell, i) => {
      const line = grid[row];
      if (line !== undefined) line[col + i] = cell;
    });
  }

  function put(row: number, col: number, cells: readonly Cell[]): void {
    if (check(row, col, cells)) write(row, col, cells);
  }

  function text(row: number, col: number, value: string, style: CellStyle = DEFAULT_STYLE): void {
    put(row, col, textCells(value, style));
  }

  function writeAligned(row: number, column: Column, value: string): void {
    const size = width(value);
    if (size > column.width) {
      record(
        "out-of-bounds",
        row,
        column.col,
        `"${value}" is ${String(size)} cells, column "${column.header}" is ${String(column.width)}`,
      );
      return;
    }
    const start = column.align === "right" ? column.col + column.width - size : column.col;
    text(row, start, value, column.style);
  }

  const builder: ContentBuilder = {
    text,

    markup(row, line) {
      if (line.includes("\n") || line.includes("\r")) {
        record("markup", row, null, "markup line holds a line break");
        return;
      }
      const parsed = parseContent(line);
      if (!parsed.ok) {
        for (const error of parsed.errors) record("markup", row, error.col, error.message);
        return;
      }
      const first = parsed.value[0] ?? [];
      let last = -1;
      first.forEach((cell, i) => {
        if (!isBlankCell(cell)) last = i;
      });
      put(row, 0, first.slice(0, last + 1));
    },

    cells(row, col, cells) {
      const ok = cells.map((line, i) => check(row + i, col, line));
      if (ok.every(Boolean))
        cells.forEach((line, i) => {
          write(row + i, col, line);
        });
    },

    alt(block) {
      altBlocks.push(block);
    },

    heading(row, col, value, style = DEFAULT_STYLE, level = 2) {
      text(row, col, value, style);
      altBlocks.push({ kind: "heading", level, text: value });
    },

    lines(row, col, rows, style = DEFAULT_STYLE) {
      if (rows.length === 0) return;
      rows.forEach((value, i) => {
        text(row + i, col, value, style);
      });
      altBlocks.push({ kind: "paragraph", text: joinRows(rows) });
    },

    table(row, columns, records, headerRow) {
      let r = row;
      if (headerRow) {
        for (const column of columns.filter((c) => c.showHeader !== false)) {
          writeAligned(r, { ...column, style: { fg: "cyan", bg: column.style.bg } }, column.header);
        }
        r += 1;
      }
      const altRows: string[][] = [];
      for (const record of records) {
        const cellRows = columns.map((_, i): readonly string[] => {
          const value = record[i];
          return value === undefined ? [] : typeof value === "string" ? [value] : value;
        });
        const height = Math.max(1, ...cellRows.map((rows) => rows.length));
        columns.forEach((column, i) => {
          (cellRows[i] ?? []).forEach((value, j) => {
            if (value !== "") writeAligned(r + j, column, value);
          });
        });
        altRows.push(cellRows.map((rows) => joinRows(rows)));
        r += height;
      }
      const [firstColumn, ...otherColumns] = columns;
      const headers: NonEmpty<string> = [firstColumn.header, ...otherColumns.map((c) => c.header)];
      altBlocks.push({ kind: "table", headers, rows: altRows });
      return r - row;
    },

    link(row, col, parts, target) {
      let at = col;
      for (const [value, style] of parts) {
        text(row, at, value, style);
        at += width(value);
      }
      altBlocks.push({
        kind: "link",
        text: collapseSpaces(parts.map(([value]) => value).join("")),
        target,
      });
    },

    concealed(row, col, label, value, summary) {
      text(row, col, label[0], label[1]);
      text(row, col + width(label[0]) + 1, value[0], { ...value[1], conceal: true });
      altBlocks.push({ kind: "concealed", summary, text: `${label[0]} ${value[0]}` });
    },

    build() {
      const all: CompileProblem[] = [...problems];
      const rows: Rows = grid.map((line) => line.map((cell) => cell ?? BLANK_CELL));
      const checked = validateContentRows(rows);
      if (!checked.ok) {
        for (const v of checked.violations) {
          all.push({ code: "grid", subpage: null, row: v.row, col: v.col, message: v.message });
        }
      }
      if (altBlocks.length === 0) {
        all.push({
          code: "alt-empty",
          subpage: null,
          row: null,
          col: null,
          message: "the text alternative has no block",
        });
      }
      const agreement = checkAltAgreement(rows, altBlocks);
      if (!agreement.ok) {
        for (const word of agreement.missing) {
          all.push({
            code: "alt-missing",
            subpage: null,
            row: null,
            col: null,
            message: `word "${word}" is on the grid but not in the text alternative`,
          });
        }
      }
      const failed = toNonEmpty(all);
      if (failed !== undefined) return { ok: false, problems: failed };
      const alt = toNonEmpty(altBlocks);
      if (!checked.ok || alt === undefined) {
        // Unreachable: a violation or an empty alternative was recorded above.
        const unreachable: NonEmpty<CompileProblem> = [
          { code: "grid", subpage: null, row: null, col: null, message: "content is not valid" },
        ];
        return { ok: false, problems: unreachable };
      }
      return { ok: true, subpage: { content: checked.content, alt } };
    },
  };
  return builder;
}
