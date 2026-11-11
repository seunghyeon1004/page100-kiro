import { validateGrid } from "../grid/validate-grid.js";
import type { GridViolation } from "../grid/grid-violation.js";
import type { Cell, NonEmpty, ValidPage } from "../grid/types.js";
import type { CompiledPage } from "./compiled-page.js";
import { frameRows } from "./frame-rows.js";
import type { FrameOptions } from "./frame-rows.js";
import type { PageDef } from "./page-def.js";

export type { FrameOptions } from "./frame-rows.js";

/** At most this many subpages on one page; the indicator `n/m` is 3 characters wide. */
export const MAX_SUBPAGES = 9;

export type ScreenResult =
  | { readonly ok: true; readonly page: ValidPage }
  | {
      readonly ok: false;
      readonly error: "page-mismatch" | "subpage-count" | "subpage-index" | "time-invalid";
    }
  | {
      readonly ok: false;
      readonly error: "frame-invalid";
      readonly violations: NonEmpty<GridViolation>;
    };

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Builds one full screen: rows 0, 1, 22 and 23 from the frame, rows 2 to 21 from the chosen
 * subpage, then `validateGrid` (requirement 5). Pure and total. `subpageIndex` is 0-based.
 */
export function buildScreen(
  def: PageDef,
  compiled: CompiledPage,
  subpageIndex: number,
  opts: FrameOptions,
): ScreenResult {
  if (compiled.number !== def.number) return { ok: false, error: "page-mismatch" };
  const count = compiled.subpages.length;
  if (count > MAX_SUBPAGES) return { ok: false, error: "subpage-count" };
  const subpage = Number.isInteger(subpageIndex) ? compiled.subpages[subpageIndex] : undefined;
  if (subpage === undefined) return { ok: false, error: "subpage-index" };
  if (!isValidDate(opts.now) || (opts.lastGoodAt !== null && !isValidDate(opts.lastGoodAt))) {
    return { ok: false, error: "time-invalid" };
  }

  const frame = frameRows(def, subpageIndex, count, opts);
  const rows: (readonly Cell[])[] = [
    frame.row0,
    frame.row1,
    ...subpage.content,
    frame.row22,
    frame.row23,
  ];
  const result = validateGrid(rows);
  if (!result.ok) return { ok: false, error: "frame-invalid", violations: result.violations };
  return { ok: true, page: result.page };
}
