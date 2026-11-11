import type { DraftRows, EditorialInput } from "./editorial-input.js";
import { checkDraft, rowCounts, rowsOfSlot, rulesDraft } from "./editorial-input.js";
import { WHITE, YELLOW, entryTime, finishPage } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder, joinRows } from "./content-builder.js";
import { spreadByYear } from "./day-entries.js";
import type { Day } from "./day-entries.js";
import { formatDayMonth, formatYear } from "./format.js";
import { noDataPage } from "./no-data-page.js";

// Page 501: births and deaths on this day (rule-compilers requirement 14.2, design.md, "Page layouts").

export { rulesDraft };

type Entry = SourceEntry<"wikimedia-onthisday">;

const PER_LIST = 4;
const WIDTH = 32;
const MAX_ROWS = 2;
const TOTAL_ROWS = 16;
/** Page rows of content rows 1 and 11, where the births and the deaths start. */
const BORN_ROW = 3;
const DIED_ROW = 13;

function choose(entry: Entry): { born: Day[]; died: Day[] } {
  return {
    born: spreadByYear(entry.value.births, PER_LIST),
    died: spreadByYear(entry.value.deaths, PER_LIST),
  };
}

/** Slots `born-1` to `born-4`, then `died-1` to `died-4`. */
export function editorialInput(entry: Entry): EditorialInput {
  const { born, died } = choose(entry);
  const slot = (prefix: string) => (day: Day, i: number) => ({
    id: `${prefix}-${String(i + 1)}`,
    mode: "body" as const,
    text: day.text,
    maxRows: MAX_ROWS,
    width: WIDTH,
  });
  return {
    page: 501,
    totalRows: TOTAL_ROWS,
    slots: [...born.map(slot("born")), ...died.map(slot("died"))],
  };
}

export function assemble(entry: Entry, rows: DraftRows): CompileResult {
  const input = editorialInput(entry);
  const { born, died } = choose(entry);
  const counts = rowCounts(rows);
  const rowOf = (slot: number, row: number): number => {
    const inBorn = slot < born.length;
    const first = inBorn ? 0 : born.length;
    const base = inBorn ? BORN_ROW : DIED_ROW;
    return base + counts.slice(first, slot).reduce((a, b) => a + b, 0) + row;
  };
  const [problem, ...more] = checkDraft(input, rows, rowOf);
  if (problem !== undefined) return { ok: false, problems: [problem, ...more] };
  if (input.slots.every((_, i) => rowsOfSlot(rows, i).length === 0)) {
    return noDataPage(501, "no-data");
  }

  const day = formatDayMonth(entry.value.month, entry.value.day);
  const b = createContentBuilder();
  const section = (title: string, titleRow: number, days: readonly Day[], offset: number): void => {
    const items: string[] = [];
    let row = titleRow + 1;
    days.forEach((entryDay, i) => {
      const lines = rowsOfSlot(rows, offset + i);
      if (lines.length === 0) return;
      const year = formatYear(entryDay.year);
      b.text(row, 7 - Array.from(year).length, year, YELLOW);
      lines.forEach((line, r) => {
        b.text(row + r, 8, line, WHITE);
      });
      items.push(`${year}: ${joinRows(lines)}`);
      row += lines.length;
    });
    const [head, ...others] = items;
    if (head === undefined) return;
    b.heading(titleRow, 1, title, YELLOW);
    b.alt({ kind: "list", ordered: false, items: [head, ...others] });
  };
  section(`Born on ${day}`, 0, born, 0);
  section(`Died on ${day}`, 10, died, born.length);
  return finishPage(501, [b.build()], entryTime(entry.fetchedAt));
}

export function compile501(entry: Entry): CompileResult {
  return assemble(entry, rulesDraft(editorialInput(entry)));
}
