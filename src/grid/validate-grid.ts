import { checkRows } from "./check-rows.js";
import { GRID_ROWS } from "./dimensions.js";
import type { GridViolation } from "./grid-violation.js";
import type { NonEmpty, ValidPage } from "./types.js";

export type GridResult =
  | { readonly ok: true; readonly page: ValidPage }
  | { readonly ok: false; readonly violations: NonEmpty<GridViolation> };

/**
 * The only gate to a `ValidPage`. Accepts any input and never throws. On success it returns a
 * frozen copy that shares nothing with the input.
 */
export function validateGrid(input: unknown): GridResult {
  const checked = checkRows(input, { expectedRows: GRID_ROWS, firstRow: 0, label: "grid" });
  if (!checked.ok) {
    return { ok: false, violations: checked.violations };
  }
  return { ok: true, page: checked.rows as ValidPage };
}
