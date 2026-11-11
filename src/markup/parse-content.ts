import { BLANK_CELL } from "../grid/blank-cell.js";
import { CONTENT_FIRST_ROW, CONTENT_ROW_COUNT, GRID_COLS } from "../grid/dimensions.js";
import { toNonEmpty } from "../grid/non-empty.js";
import type { Cell, ContentRows } from "../grid/types.js";
import type { MarkupError, ParseResult } from "./markup-error.js";
import { parseRow } from "./parse-row.js";
import { splitLines } from "./split-lines.js";

/**
 * Parses content markup for a `pages/` file: 1 to 20 lines, line i is page row i + 2. Rows the file
 * leaves out are blank. Reports one error per bad row, plus one `row-count` error for 0 lines or
 * more than 20. Never throws.
 */
export function parseContent(text: string): ParseResult<ContentRows> {
  const lines = splitLines(text);
  const errors: MarkupError[] = [];
  const rows: (readonly Cell[])[] = [];

  const walk = Math.min(lines.length, CONTENT_ROW_COUNT);
  for (let i = 0; i < walk; i++) {
    const row = i + CONTENT_FIRST_ROW;
    const result = parseRow(lines[i] ?? "", row);
    if (result.ok) {
      rows.push(Object.freeze(result.cells.slice()));
    } else {
      errors.push(result.error);
    }
  }

  if (lines.length === 0) {
    errors.push({
      code: "row-count",
      row: CONTENT_FIRST_ROW,
      col: null,
      expected: CONTENT_ROW_COUNT,
      actual: 0,
      message: `content has 0 rows, expected 1 to ${String(CONTENT_ROW_COUNT)}`,
    });
  } else if (lines.length > CONTENT_ROW_COUNT) {
    errors.push({
      code: "row-count",
      row: CONTENT_FIRST_ROW + CONTENT_ROW_COUNT,
      col: null,
      expected: CONTENT_ROW_COUNT,
      actual: lines.length,
      message: `content has ${String(lines.length)} rows, limit ${String(CONTENT_ROW_COUNT)}`,
    });
  }

  // Rows the file leaves out are blank. This also fills the value when the lines are fewer than 20.
  const blankRow: readonly Cell[] = Object.freeze(
    Array.from({ length: GRID_COLS }, () => BLANK_CELL),
  );
  for (let i = walk; i < CONTENT_ROW_COUNT; i++) {
    rows.push(blankRow);
  }

  const failures = toNonEmpty(errors);
  if (failures !== undefined) {
    return { ok: false, errors: failures };
  }
  return { ok: true, value: Object.freeze(rows) };
}
