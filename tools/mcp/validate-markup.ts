import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import { validateGrid } from "../../src/grid/validate-grid.js";
import { parseContent } from "../../src/markup/parse-content.js";
import { parsePage } from "../../src/markup/parse-page.js";
import { invalidReport } from "./format-violations.js";

export type MarkupKind = "content" | "page";

/**
 * Parses and validates markup. `content` is the 1 to 20 lines of a `pages/` file, `page` is a
 * whole 24-line page. The parser runs first; the grid validator runs on what it produced, so a
 * parse error hides contrast problems until the parse errors are fixed.
 */
export function validateMarkup(markup: string, kind: MarkupKind): string {
  if (kind === "content") {
    const parsed = parseContent(markup);
    if (!parsed.ok) return invalidReport(parsed.errors);
    const checked = validateContentRows(parsed.value);
    if (!checked.ok) return invalidReport(checked.violations);
    return "OK: content markup, 20 rows (page rows 2-21) of 40 cells";
  }
  const parsed = parsePage(markup);
  if (!parsed.ok) return invalidReport(parsed.errors);
  const checked = validateGrid(parsed.value);
  if (!checked.ok) return invalidReport(checked.violations);
  return "OK: page markup, 24 rows of 40 cells";
}
