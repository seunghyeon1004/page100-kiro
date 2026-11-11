import { GRID_ROWS } from "../grid/dimensions.js";
import { toNonEmpty } from "../grid/non-empty.js";
import type { Cell, Grid } from "../grid/types.js";
import type { MarkupError, ParseResult } from "./markup-error.js";
import { parseRow } from "./parse-row.js";
import { splitLines } from "./split-lines.js";

/**
 * Parses a full page: exactly 24 lines, one per row. Reports one error per bad row, plus one
 * `row-count` error when the line count is wrong. Never throws.
 */
export function parsePage(text: string): ParseResult<Grid> {
  const lines = splitLines(text);
  const errors: MarkupError[] = [];
  const rows: (readonly Cell[])[] = [];

  const walk = Math.min(lines.length, GRID_ROWS);
  for (let row = 0; row < walk; row++) {
    const result = parseRow(lines[row] ?? "", row);
    if (result.ok) {
      rows.push(Object.freeze(result.cells.slice()));
    } else {
      errors.push(result.error);
    }
  }

  if (lines.length !== GRID_ROWS) {
    const row = lines.length < GRID_ROWS ? lines.length : GRID_ROWS;
    errors.push({
      code: "row-count",
      row,
      col: null,
      expected: GRID_ROWS,
      actual: lines.length,
      message: `page has ${String(lines.length)} rows, expected ${String(GRID_ROWS)}`,
    });
  }

  const failures = toNonEmpty(errors);
  if (failures !== undefined) {
    return { ok: false, errors: failures };
  }
  return { ok: true, value: Object.freeze(rows) };
}
