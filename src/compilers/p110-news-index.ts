import type { DraftRows, EditorialInput } from "./editorial-input.js";
import { checkDraft, rowCounts, rowsOfSlot, rulesDraft } from "./editorial-input.js";
import { WHITE, YELLOW, entryTime, finishPage } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder, joinRows } from "./content-builder.js";
import { formatFullDate } from "./format.js";
import { foldedStories } from "./news-stories.js";
import { noDataPage } from "./no-data-page.js";

// Page 110: the world news index (rule-compilers requirement 10.1, design.md, "Page layouts").

export { rulesDraft };

const WIDTH = 35;
const MAX_ROWS = 3;
const TOTAL_ROWS = 18;
/** Page row of the first story row: content row 2. */
const FIRST_ROW = 4;

/** One headline slot per story, `story-1` to `story-8` (requirement 8.2). */
export function editorialInput(entry: SourceEntry<"wikimedia-feed">): EditorialInput {
  return {
    page: 110,
    totalRows: TOTAL_ROWS,
    slots: foldedStories(entry.value).map((story, i) => ({
      id: `story-${String(i + 1)}`,
      mode: "headline",
      text: story.text,
      maxRows: MAX_ROWS,
      width: WIDTH,
    })),
  };
}

/** Lays out a draft: rejects one that breaks a limit, and gives the no-data page when no slot has rows. */
export function assemble(entry: SourceEntry<"wikimedia-feed">, rows: DraftRows): CompileResult {
  const input = editorialInput(entry);
  const counts = rowCounts(rows);
  const rowOf = (slot: number, row: number): number =>
    FIRST_ROW + counts.slice(0, slot).reduce((a, b) => a + b, 0) + row;
  const problems = checkDraft(input, rows, rowOf);
  const [first, ...rest] = problems;
  if (first !== undefined) return { ok: false, problems: [first, ...rest] };
  if (input.slots.every((_, i) => rowsOfSlot(rows, i).length === 0)) {
    return noDataPage(110, "no-data");
  }

  const b = createContentBuilder();
  b.heading(0, 1, `Top stories, ${formatFullDate(entry.value.date)}`, YELLOW);
  let row = 2;
  input.slots.forEach((_, i) => {
    const lines = rowsOfSlot(rows, i);
    if (lines.length === 0) return;
    const page = 111 + i;
    b.text(row, 1, String(page), YELLOW);
    lines.forEach((line, r) => {
      b.text(row + r, 5, line, WHITE);
    });
    b.alt({
      kind: "link",
      text: `${String(page)} ${joinRows(lines)}`,
      target: { page },
    });
    row += lines.length;
  });
  return finishPage(110, [b.build()], entryTime(entry.fetchedAt));
}

export function compile110(entry: SourceEntry<"wikimedia-feed">): CompileResult {
  return assemble(entry, rulesDraft(editorialInput(entry)));
}
