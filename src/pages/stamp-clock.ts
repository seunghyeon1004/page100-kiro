import { validateGrid } from "../grid/validate-grid.js";
import type { Cell, ValidPage } from "../grid/types.js";
import { formatHeaderClock } from "./frame-time.js";

const CLOCK_COL = 21;

/**
 * The screen with the header clock of row 0, cols 21 to 39, set to `now` (server-and-viewer 9.5),
 * written as `frameRows` writes it: yellow on black. Re-validated. Returns the screen as it is when
 * `now` is not a valid Date or the result does not validate. Pure and total.
 */
export function stampClock(screen: ValidPage, now: Date): ValidPage {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return screen;
  const clock = Array.from(formatHeaderClock(now));
  const rows: Cell[][] = screen.map((row) => [...row]);
  const header = rows[0];
  if (header === undefined) return screen;
  clock.forEach((ch, i) => {
    header[CLOCK_COL + i] = { kind: "text", ch, fg: "yellow", bg: "black", conceal: false };
  });
  const checked = validateGrid(rows);
  return checked.ok ? checked.page : screen;
}
