import type { DraftRows, EditorialInput } from "./editorial-input.js";
import { checkDraft, rowsOfSlot, rulesDraft } from "./editorial-input.js";
import { WHITE, YELLOW, entryTime, finishPage, folded } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder, joinRows } from "./content-builder.js";
import { wrapWords } from "./fit-text.js";
import { noDataPage } from "./no-data-page.js";

// Page 700: the featured article of the day (rule-compilers requirement 10.4, design.md, "Page layouts").

export { rulesDraft };

const WIDTH = 38;
const TITLE_ROWS = 2;
const BODY_ROWS = 16;

type Entry = SourceEntry<"wikimedia-feed">;

function article(entry: Entry) {
  const found = entry.value.featuredArticle;
  if (found === null) return undefined;
  const title = folded(found.title);
  const extract = found.extract === null ? undefined : folded(found.extract);
  if (title === undefined || extract === undefined) return undefined;
  return { title, extract, url: found.url };
}

/** The single `body` slot, or none when the feed has no usable featured article. */
export function editorialInput(entry: Entry): EditorialInput {
  const found = article(entry);
  return {
    page: 700,
    totalRows: BODY_ROWS,
    slots:
      found === undefined
        ? []
        : [{ id: "body", mode: "body", text: found.extract, maxRows: BODY_ROWS, width: WIDTH }],
  };
}

export function assemble(entry: Entry, rows: DraftRows): CompileResult {
  const found = article(entry);
  const input = editorialInput(entry);
  const titleFit = found === undefined ? undefined : wrapWords(found.title, WIDTH, TITLE_ROWS);
  const titleRows = titleFit?.ok === true ? titleFit.rows : [];
  const bodyStart = 2 + (titleRows.length > 0 ? titleRows.length + 1 : 0);
  const problems = checkDraft(input, rows, (_slot, row) => bodyStart + row);
  const [first, ...rest] = problems;
  if (first !== undefined) return { ok: false, problems: [first, ...rest] };
  const body = rowsOfSlot(rows, 0);
  if (found === undefined || body.length === 0) return noDataPage(700, "no-data");

  const b = createContentBuilder();
  titleRows.forEach((line, r) => {
    b.text(r, 1, line, YELLOW);
  });
  const bodyRow = titleRows.length > 0 ? titleRows.length + 1 : 0;
  body.forEach((line, r) => {
    b.text(bodyRow + r, 1, line, WHITE);
  });
  b.alt({ kind: "heading", level: 2, text: found.title });
  b.alt({ kind: "paragraph", text: joinRows(body) });
  if (found.url !== null) {
    b.alt({
      kind: "link",
      text: `Read on Wikipedia: ${found.title}`,
      target: { url: found.url },
    });
  }
  return finishPage(700, [b.build()], entryTime(entry.fetchedAt));
}

export function compile700(entry: Entry): CompileResult {
  return assemble(entry, rulesDraft(editorialInput(entry)));
}
