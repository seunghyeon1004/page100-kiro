import { checkCell } from "./check-cell.js";
import { GRID_COLS } from "./dimensions.js";
import { type GridViolation, locate } from "./grid-violation.js";
import { toNonEmpty } from "./non-empty.js";
import type { Cell, NonEmpty, Rows } from "./types.js";

export interface RowsOptions {
  /** How many rows the input must have. */
  readonly expectedRows: number;
  /** The page row of the first input row. */
  readonly firstRow: number;
  /** The word for the whole input in messages: `grid` or `content`. */
  readonly label: string;
}

export type RowsCheck =
  | { readonly ok: true; readonly rows: Rows }
  | { readonly ok: false; readonly violations: NonEmpty<GridViolation> };

type RowRead =
  | { readonly state: "row"; readonly row: readonly unknown[]; readonly length: number }
  | { readonly state: "not-array" }
  | { readonly state: "unreadable" };

type CellRead =
  { readonly state: "value"; readonly value: unknown } | { readonly state: "unreadable" };

function isArrayValue(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** Reads row `index` and its length. A getter or Proxy trap that throws gives `unreadable`. */
function readRow(source: readonly unknown[], index: number): RowRead {
  try {
    const value: unknown = source[index];
    if (!isArrayValue(value)) return { state: "not-array" };
    return { state: "row", row: value, length: value.length };
  } catch {
    return { state: "unreadable" };
  }
}

/** Reads cell `index` of a row. A getter or Proxy trap that throws gives `unreadable`. */
function readCell(row: readonly unknown[], index: number): CellRead {
  try {
    return { state: "value", value: row[index] };
  } catch {
    return { state: "unreadable" };
  }
}

/**
 * Walks an input that should hold `expectedRows` rows of 40 cells, and checks every row and cell
 * it can reach. Reads no row at or above `expectedRows` and no cell at or above 40 (requirement
 * 8.8). Shared by `validateGrid` and `validateContentRows`. The violations come out in the sort
 * order of requirement 10.4, so no sort step is needed.
 */
export function checkRows(input: unknown, options: RowsOptions): RowsCheck {
  const { expectedRows, firstRow, label } = options;
  const violations: GridViolation[] = [];

  let source: readonly unknown[];
  let length: number;
  try {
    if (!isArrayValue(input)) {
      return {
        ok: false,
        violations: [
          { code: "not-array", row: null, col: null, message: `${label} is not an array` },
        ],
      };
    }
    source = input;
    length = input.length;
  } catch {
    return {
      ok: false,
      violations: [
        { code: "unreadable", row: null, col: null, message: `${label} could not be read` },
      ],
    };
  }

  const rows: (readonly Cell[])[] = [];
  const walk = Math.min(length, expectedRows);
  for (let i = 0; i < walk; i++) {
    const row = firstRow + i;
    const read = readRow(source, i);
    if (read.state === "unreadable") {
      violations.push({
        code: "unreadable",
        row,
        col: null,
        message: `${locate(row, null)}row could not be read`,
      });
      continue;
    }
    if (read.state === "not-array") {
      violations.push({
        code: "row-not-array",
        row,
        col: null,
        message: `${locate(row, null)}row is not an array`,
      });
      continue;
    }

    const cells: Cell[] = [];
    const cellWalk = Math.min(read.length, GRID_COLS);
    for (let col = 0; col < cellWalk; col++) {
      const cellRead = readCell(read.row, col);
      if (cellRead.state === "unreadable") {
        violations.push({
          code: "unreadable",
          row,
          col,
          message: `${locate(row, col)}cell could not be read`,
        });
        continue;
      }
      const check = checkCell(cellRead.value, row, col);
      violations.push(...check.violations);
      if (check.cell !== undefined) cells.push(check.cell);
    }

    if (read.length !== GRID_COLS) {
      const col = read.length < GRID_COLS ? read.length : GRID_COLS;
      violations.push({
        code: "row-length",
        row,
        col,
        expected: GRID_COLS,
        actual: read.length,
        message: `${locate(row, null)}row has ${String(read.length)} cells, expected ${String(GRID_COLS)}`,
      });
    }
    rows.push(Object.freeze(cells));
  }

  if (length !== expectedRows) {
    const row = firstRow + (length < expectedRows ? length : expectedRows);
    violations.push({
      code: "row-count",
      row,
      col: null,
      expected: expectedRows,
      actual: length,
      message: `${label} has ${String(length)} rows, expected ${String(expectedRows)}`,
    });
  }

  const failures = toNonEmpty(violations);
  if (failures !== undefined) {
    return { ok: false, violations: failures };
  }
  return { ok: true, rows: Object.freeze(rows) };
}
