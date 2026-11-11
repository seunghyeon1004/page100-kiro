import { checkRows } from "./check-rows.js";
import { CONTENT_FIRST_ROW, CONTENT_ROW_COUNT } from "./dimensions.js";
import type { GridViolation } from "./grid-violation.js";
import type { NonEmpty, ValidContent } from "./types.js";

export type ContentResult =
  | { readonly ok: true; readonly content: ValidContent }
  | { readonly ok: false; readonly violations: NonEmpty<GridViolation> };

/**
 * The gate for the 20 content rows (page rows 2 to 21) before a frame exists. Accepts any input and
 * never throws. Reports row i as page row i + 2. On success it returns a frozen copy.
 */
export function validateContentRows(input: unknown): ContentResult {
  const checked = checkRows(input, {
    expectedRows: CONTENT_ROW_COUNT,
    firstRow: CONTENT_FIRST_ROW,
    label: "content",
  });
  if (!checked.ok) {
    return { ok: false, violations: checked.violations };
  }
  return { ok: true, content: checked.rows as ValidContent };
}
