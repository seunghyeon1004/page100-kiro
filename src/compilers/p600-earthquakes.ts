import { WHITE, YELLOW, entryTime, finishPage, folded } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import type { Column } from "./content-builder.js";
import { fitBody } from "./fit-text.js";
import { NOT_AVAILABLE, formatInteger, formatKm, formatMagnitude, formatTime } from "./format.js";
import { noDataPage } from "./no-data-page.js";

// Page 600: earthquakes of magnitude 4.5 and over in the last 24 hours (rule-compilers requirement
// 15.1, design.md, "Page layouts").

const PLACE_WIDTH = 18;
const PLACE_ROWS = 2;
/** Content rows 1 to 18 hold items; row 0 holds the headers and row 19 the count. */
const ITEM_ROWS = 18;

const COLUMNS: [Column, ...Column[]] = [
  { header: "UTC", col: 1, width: 5, align: "left", style: WHITE },
  { header: "Mag", col: 7, width: 5, align: "left", style: YELLOW },
  { header: "Depth", col: 13, width: 8, align: "right", style: WHITE },
  { header: "Place", col: 22, width: PLACE_WIDTH, align: "left", style: WHITE },
];

export function compile600(entry: SourceEntry<"usgs">): CompileResult {
  const quakes = entry.value.quakes;
  if (quakes.length === 0) {
    const b = createContentBuilder();
    b.lines(1, 1, ["No earthquakes are listed for this", "period."]);
    return finishPage(600, [b.build()], entryTime(entry.fetchedAt));
  }

  const usable: (readonly [string, string, string, readonly string[]])[] = [];
  for (const quake of quakes) {
    let place: readonly string[] = [NOT_AVAILABLE];
    if (quake.place !== null) {
      const text = folded(quake.place);
      const fit = text === undefined ? undefined : fitBody(text, PLACE_WIDTH, PLACE_ROWS);
      if (fit?.ok !== true) continue;
      place = fit.rows;
    }
    usable.push([
      formatTime(quake.time),
      formatMagnitude(quake.magnitude),
      formatKm(quake.depthKm),
      place,
    ]);
  }
  if (usable.length === 0) return noDataPage(600, "no-data");

  const shown: (readonly [string, string, string, readonly string[]])[] = [];
  let used = 0;
  for (const item of usable) {
    if (used + item[3].length > ITEM_ROWS) break;
    used += item[3].length;
    shown.push(item);
  }
  const b = createContentBuilder();
  b.table(
    0,
    COLUMNS,
    shown.map((s) => [s[0], s[1], s[2], s[3]]),
    true,
  );
  if (shown.length < usable.length) {
    const n = formatInteger(shown.length, 99_999);
    const m = formatInteger(usable.length, 99_999);
    b.lines(19, 1, [`Showing ${n} of ${m}.`]);
  }
  return finishPage(600, [b.build()], entryTime(entry.fetchedAt));
}
