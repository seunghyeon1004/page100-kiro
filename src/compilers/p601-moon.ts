import { CYAN, WHITE, YELLOW, finishPage } from "./compile-helpers.js";
import type { CompileResult } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import { formatDate, formatPercent, formatTimeUtc } from "./format.js";
import { moonAt } from "./moon.js";
import { moonDiscCells } from "./moon-disc.js";
import { noDataPage } from "./no-data-page.js";

// Page 601: the moon tonight (rule-compilers requirement 15.2, design.md, "Page layouts").

/** Where the text starts, to the right of the 16 cell disc (cols 1 to 16). */
const TEXT_COL = 19;

export function compile601(now: Date): CompileResult {
  const state = moonAt(now);
  if (state === undefined) return noDataPage(601, "no-data");

  const illuminated = `${formatPercent(state.illuminated * 100)} illuminated`;
  const full = `${formatDate(state.nextFull)} ${formatTimeUtc(state.nextFull)}`;
  const fresh = `${formatDate(state.nextNew)} ${formatTimeUtc(state.nextNew)}`;

  const b = createContentBuilder();
  b.heading(0, 1, state.phase, YELLOW);
  b.cells(2, 1, moonDiscCells(state.illuminated, state.waxing));
  b.text(3, TEXT_COL, illuminated, WHITE);
  b.alt({ kind: "paragraph", text: illuminated });
  b.text(5, TEXT_COL, "Next full moon", CYAN);
  b.text(6, TEXT_COL, full, WHITE);
  b.alt({ kind: "paragraph", text: `Next full moon: ${full}` });
  b.text(8, TEXT_COL, "Next new moon", CYAN);
  b.text(9, TEXT_COL, fresh, WHITE);
  b.alt({ kind: "paragraph", text: `Next new moon: ${fresh}` });
  b.lines(13, 1, [
    "Times are computed here and may differ",
    "from published tables by a few minutes.",
  ]);
  return finishPage(601, [b.build()], now);
}
