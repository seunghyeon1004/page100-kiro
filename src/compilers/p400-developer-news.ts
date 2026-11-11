import { toNonEmpty } from "../grid/non-empty.js";
import type { HnStory } from "../sources/hacker-news.js";
import { CYAN, WHITE, YELLOW, entryTime, finishPage, folded } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import { wrapWords } from "./fit-text.js";
import { formatInteger } from "./format.js";
import { noDataPage } from "./no-data-page.js";

// Pages 400, 401 and 402: Hacker News top, Show and Ask (rule-compilers requirement 13.1,
// design.md, "Page layouts").

export type HnList = "top" | "show" | "ask";

export interface HnData {
  readonly entry: SourceEntry<"hacker-news">;
  readonly list: HnList;
}

const NUMBERS: Readonly<Record<HnList, number>> = { top: 400, show: 401, ask: 402 };
const TITLE_WIDTH = 36;
const TITLE_ROWS = 2;
const ROWS = 20;

function count(n: number | null, one: string, many: string): string {
  const text = formatInteger(n, 999_999);
  return text === "1" ? `1 ${one}` : `${text} ${many}`;
}

function infoLine(story: HnStory): string {
  return `${count(story.score, "point", "points")}, ${count(story.comments, "comment", "comments")}`;
}

export function compileHn(data: HnData): CompileResult {
  const number = NUMBERS[data.list];
  const stories = data.entry.value[data.list];
  const shown: { rank: string; title: readonly string[]; info: string; text: string }[] = [];
  let used = 0;
  for (const [i, story] of stories.entries()) {
    const title = folded(story.title);
    const wrapped = title === undefined ? undefined : wrapWords(title, TITLE_WIDTH, TITLE_ROWS);
    if (title === undefined || wrapped?.ok !== true) continue;
    if (used + wrapped.rows.length + 1 > ROWS) break;
    used += wrapped.rows.length + 1;
    const info = infoLine(story);
    shown.push({
      rank: formatInteger(i + 1, 99),
      title: wrapped.rows,
      info,
      text: `${String(i + 1)} ${title}, ${info}`,
    });
  }
  if (shown.length === 0) return noDataPage(number, "no-data");

  const b = createContentBuilder();
  let row = 0;
  for (const item of shown) {
    b.text(row, 2 - Array.from(item.rank).length, item.rank, YELLOW);
    item.title.forEach((line, r) => {
      b.text(row + r, 3, line, WHITE);
    });
    b.text(row + item.title.length, 3, item.info, CYAN);
    row += item.title.length + 1;
  }
  const items = toNonEmpty(shown.map((s) => s.text));
  if (items !== undefined) b.alt({ kind: "list", ordered: false, items });
  return finishPage(number, [b.build()], entryTime(data.entry.fetchedAt));
}
