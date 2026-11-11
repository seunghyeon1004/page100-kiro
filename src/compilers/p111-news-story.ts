import type { DraftRows, EditorialInput } from "./editorial-input.js";
import { checkDraft, rowsOfSlot, rulesDraft } from "./editorial-input.js";
import { CYAN, WHITE, entryTime, finishPage } from "./compile-helpers.js";
import type { CompileResult, SourceEntry } from "./compile-types.js";
import { createContentBuilder, joinRows } from "./content-builder.js";
import { firstBackground, foldedStories } from "./news-stories.js";
import type { Background } from "./news-stories.js";
import { noDataPage } from "./no-data-page.js";

// Pages 111 to 118: one news story each (rule-compilers requirement 10.2, design.md, "Page layouts").

export { rulesDraft };

const WIDTH = 38;
const LEAD_ROWS = 5;
const BACKGROUND_ROWS = 12;
const TOTAL_ROWS = 17;

/** The feed and the story number, 1 to 8. */
export interface StoryData {
  readonly entry: SourceEntry<"wikimedia-feed">;
  readonly story: number;
}

function parts(data: StoryData) {
  const story = foldedStories(data.entry.value)[data.story - 1];
  if (story === undefined) return undefined;
  const background: Background | undefined = firstBackground(story.articles);
  return { story, background };
}

/** The `lead` slot and, when an article folds, the `background` slot (requirement 8.2). */
export function editorialInput(data: StoryData): EditorialInput {
  const found = parts(data);
  const slots: EditorialInput["slots"] =
    found === undefined
      ? []
      : [
          { id: "lead", mode: "body", text: found.story.text, maxRows: LEAD_ROWS, width: WIDTH },
          ...(found.background === undefined
            ? []
            : [
                {
                  id: "background",
                  mode: "body" as const,
                  text: found.background.extract,
                  maxRows: BACKGROUND_ROWS,
                  width: WIDTH,
                },
              ]),
        ];
  return { page: 110 + data.story, slots, totalRows: TOTAL_ROWS };
}

export function assemble(data: StoryData, rows: DraftRows): CompileResult {
  const number = 110 + data.story;
  const found = parts(data);
  if (found === undefined) return noDataPage(number, "no-story");
  const input = editorialInput(data);
  const heading =
    found.background === undefined ? undefined : `Background: ${found.background.title}`;
  const headingFits = heading !== undefined && Array.from(heading).length <= WIDTH;
  const leadLength = rowsOfSlot(rows, 0).length;
  const backgroundStart = 2 + (leadLength > 0 ? leadLength + 1 : 0) + (headingFits ? 1 : 0);
  const rowOf = (slot: number, row: number): number =>
    slot === 0 ? 2 + row : backgroundStart + row;
  const problems = checkDraft(input, rows, rowOf);
  const [first, ...rest] = problems;
  if (first !== undefined) return { ok: false, problems: [first, ...rest] };
  const lead = rowsOfSlot(rows, 0);
  const background = rowsOfSlot(rows, 1);
  if (lead.length === 0 && background.length === 0) return noDataPage(number, "no-data");

  const b = createContentBuilder();
  let row = 0;
  if (lead.length > 0) {
    b.lines(row, 1, lead, WHITE);
    row += lead.length + 1;
  }
  if (found.background !== undefined && background.length > 0) {
    if (headingFits) {
      b.text(row, 1, heading, CYAN);
      row += 1;
    }
    background.forEach((line, r) => {
      b.text(row + r, 1, line, WHITE);
    });
    b.alt({ kind: "heading", level: 3, text: `Background: ${found.background.title}` });
    b.alt({ kind: "paragraph", text: joinRows(background) });
  }
  const url = found.background?.url ?? null;
  if (found.background !== undefined && url !== null) {
    b.alt({
      kind: "link",
      text: `Read on Wikipedia: ${found.background.title}`,
      target: { url },
    });
  }
  return finishPage(number, [b.build()], entryTime(data.entry.fetchedAt));
}

export function compileStory(data: StoryData): CompileResult {
  return assemble(data, rulesDraft(editorialInput(data)));
}
