import { CYAN, GREEN, WHITE, YELLOW, entryTime, finishPage, folded } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder, joinRows } from "./content-builder.js";
import { fitBody, wrapWords } from "./fit-text.js";
import { NOT_AVAILABLE, formatDate, formatTimeUtc } from "./format.js";
import { noDataPage } from "./no-data-page.js";

// Page 610: upcoming rocket launches (rule-compilers requirement 15.3, design.md, "Page layouts").
// The source gives a rocket and a mission, but no provider and no pad.

const MISSION_WIDTH = 38;
const MISSION_ROWS = 2;
const STATUS_WIDTH = 18;
const ROWS = 20;

interface Item {
  readonly date: string;
  readonly time: string;
  readonly status: string | undefined;
  readonly mission: readonly string[];
  readonly rocket: string | undefined;
}

function oneRow(text: string | null, width: number): string | undefined {
  if (text === null) return undefined;
  const clean = folded(text);
  if (clean === undefined) return undefined;
  const fit = fitBody(clean, width, 1);
  return fit.ok ? fit.rows[0] : undefined;
}

export function compile610(entry: SourceEntry<"launch-library">): CompileResult {
  const items: Item[] = [];
  for (const launch of entry.value.launches) {
    const mission = folded(launch.mission);
    const wrapped =
      mission === undefined ? undefined : wrapWords(mission, MISSION_WIDTH, MISSION_ROWS);
    if (wrapped?.ok !== true) continue;
    items.push({
      date: formatDate(launch.net),
      time: formatTimeUtc(launch.net),
      status: oneRow(launch.status, STATUS_WIDTH),
      mission: wrapped.rows,
      rocket: oneRow(launch.rocket, MISSION_WIDTH),
    });
  }
  if (items.length === 0) return noDataPage(610, "no-data");

  const b = createContentBuilder();
  let row = 0;
  const table: string[][] = [];
  for (const item of items) {
    const height = 1 + item.mission.length + (item.rocket === undefined ? 0 : 1);
    const gap = table.length === 0 ? 0 : 1;
    if (row + gap + height > ROWS) break;
    row += gap;
    b.text(row, 1, item.date, YELLOW);
    b.text(row, 12, item.time, WHITE);
    if (item.status !== undefined) b.text(row, 22, item.status, GREEN);
    item.mission.forEach((line, r) => {
      b.text(row + 1 + r, 1, line, WHITE);
    });
    if (item.rocket !== undefined) b.text(row + 1 + item.mission.length, 1, item.rocket, CYAN);
    table.push([
      item.date,
      item.time,
      item.status ?? NOT_AVAILABLE,
      joinRows(item.mission),
      item.rocket ?? NOT_AVAILABLE,
    ]);
    row += height;
  }
  b.alt({
    kind: "table",
    headers: ["Date", "Time UTC", "Status", "Mission", "Rocket"],
    rows: table,
  });
  return finishPage(610, [b.build()], entryTime(entry.fetchedAt));
}
