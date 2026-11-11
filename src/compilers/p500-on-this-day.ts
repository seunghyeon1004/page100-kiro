import type { DraftRows, EditorialInput } from "./editorial-input.js";
import { checkDraft, rowCounts, rowsOfSlot, rulesDraft } from "./editorial-input.js";
import { WHITE, YELLOW, entryTime, finishPage } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder, joinRows } from "./content-builder.js";
import { spreadByYear } from "./day-entries.js";
import { formatDayMonth, formatYear } from "./format.js";
import { noDataPage } from "./no-data-page.js";

// Page 500: events on this day (rule-compilers requirement 14.2, design.md, "Page layouts").

export { rulesDraft };

type Entry = SourceEntry<"wikimedia-onthisday">;

const EVENTS = 6;
const WIDTH = 32;
const MAX_ROWS = 3;
const TOTAL_ROWS = 18;
/** Page row of content row 2, where the first item starts. */
const FIRST_ROW = 4;

/** The events chosen by the spread rule, as slots `event-1` to `event-6`. */
export function editorialInput(entry: Entry): EditorialInput {
  return {
    page: 500,
    totalRows: TOTAL_ROWS,
    slots: spreadByYear(entry.value.events, EVENTS).map((day, i) => ({
      id: `event-${String(i + 1)}`,
      mode: "body",
      text: day.text,
      maxRows: MAX_ROWS,
      width: WIDTH,
    })),
  };
}

export function assemble(entry: Entry, rows: DraftRows): CompileResult {
  const input = editorialInput(entry);
  const picked = spreadByYear(entry.value.events, EVENTS);
  const counts = rowCounts(rows);
  const rowOf = (slot: number, row: number): number =>
    FIRST_ROW + counts.slice(0, slot).reduce((a, b) => a + b, 0) + row;
  const [first, ...rest] = checkDraft(input, rows, rowOf);
  if (first !== undefined) return { ok: false, problems: [first, ...rest] };
  if (input.slots.every((_, i) => rowsOfSlot(rows, i).length === 0)) {
    return noDataPage(500, "no-data");
  }

  const day = formatDayMonth(entry.value.month, entry.value.day);
  const b = createContentBuilder();
  b.heading(0, 1, `Events on ${day}`, YELLOW);
  const items: string[] = [];
  let row = 2;
  picked.forEach((event, i) => {
    const lines = rowsOfSlot(rows, i);
    if (lines.length === 0) return;
    const year = formatYear(event.year);
    b.text(row, 7 - Array.from(year).length, year, YELLOW);
    lines.forEach((line, r) => {
      b.text(row + r, 8, line, WHITE);
    });
    items.push(`${year}: ${joinRows(lines)}`);
    row += lines.length;
  });
  const [head, ...others] = items;
  if (head !== undefined) b.alt({ kind: "list", ordered: false, items: [head, ...others] });
  return finishPage(500, [b.build()], entryTime(entry.fetchedAt));
}

export function compile500(entry: Entry): CompileResult {
  return assemble(entry, rulesDraft(editorialInput(entry)));
}
