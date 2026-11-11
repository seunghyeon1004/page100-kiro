import { WHITE, YELLOW, entryTime, finishPage, folded } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import type { Column } from "./content-builder.js";
import { wrapWords } from "./fit-text.js";
import { formatInteger } from "./format.js";
import { noDataPage } from "./no-data-page.js";

// Page 120: most read on Wikipedia (rule-compilers requirement 10.3, design.md, "Page layouts").

const TITLE_WIDTH = 25;
const TITLE_ROWS = 2;
/** Rows r1 to r19 hold items; r0 holds the column headers. */
const ITEM_ROWS = 19;

const COLUMNS: [Column, ...Column[]] = [
  { header: "Rank", col: 0, width: 3, align: "right", style: YELLOW, showHeader: false },
  { header: "Article", col: 4, width: TITLE_WIDTH, align: "left", style: WHITE },
  { header: "Views", col: 30, width: 10, align: "right", style: WHITE },
];

export function compile120(entry: SourceEntry<"wikimedia-feed">): CompileResult {
  const items: { rank: string; title: readonly string[]; views: string }[] = [];
  let used = 0;
  for (const item of entry.value.mostRead ?? []) {
    const title = folded(item.title);
    const wrapped = title === undefined ? undefined : wrapWords(title, TITLE_WIDTH, TITLE_ROWS);
    if (wrapped?.ok !== true) continue;
    if (used + wrapped.rows.length > ITEM_ROWS) break;
    used += wrapped.rows.length;
    items.push({
      // The position in our list (1, 2, 3, no gaps), not the feed's own rank.
      rank: formatInteger(items.length + 1, 999),
      title: wrapped.rows,
      views: formatInteger(item.views, 99_999_999),
    });
  }
  if (items.length === 0) return noDataPage(120, "no-data");

  const b = createContentBuilder();
  b.table(
    0,
    COLUMNS,
    items.map((i) => [i.rank, i.title, i.views]),
    true,
  );
  return finishPage(120, [b.build()], entryTime(entry.fetchedAt));
}
