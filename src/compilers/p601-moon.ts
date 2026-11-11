import { CYAN, WHITE, YELLOW, finishPage } from "./compile-helpers.js";
import type { CompileResult } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import { formatDate, formatPercent, formatTimeUtc } from "./format.js";
import { moonAt } from "./moon.js";
import { moonDisc } from "./moon-disc.js";
import { canvasToCells } from "./mosaic-canvas.js";
import { noDataPage } from "./no-data-page.js";

// Page 601: the moon tonight (rule-compilers requirement 15.2, design.md, "Page layouts").

export function compile601(now: Date): CompileResult {
  const state = moonAt(now);
  if (state === undefined) return noDataPage(601, "no-data");

  const illuminated = `${formatPercent(state.illuminated * 100)} illuminated`;
  const full = `${formatDate(state.nextFull)} ${formatTimeUtc(state.nextFull)}`;
  const fresh = `${formatDate(state.nextNew)} ${formatTimeUtc(state.nextNew)}`;

  const b = createContentBuilder();
  b.heading(0, 1, state.phase, YELLOW);
  b.cells(2, 1, canvasToCells(moonDisc(state.illuminated, state.waxing), WHITE));
  b.text(2, 11, illuminated, WHITE);
  b.alt({ kind: "paragraph", text: illuminated });
  b.text(4, 11, "Next full moon", CYAN);
  b.text(5, 11, full, WHITE);
  b.alt({ kind: "paragraph", text: `Next full moon: ${full}` });
  b.text(6, 11, "Next new moon", CYAN);
  b.text(7, 11, fresh, WHITE);
  b.alt({ kind: "paragraph", text: `Next new moon: ${fresh}` });
  b.lines(10, 1, [
    "Times are computed here and may differ",
    "from published tables by a few minutes.",
  ]);
  return finishPage(601, [b.build()], now);
}
