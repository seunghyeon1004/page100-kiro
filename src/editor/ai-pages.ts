import type { CompileResult } from "../compilers/compile-types.js";
import type { DraftRows, EditorialInput } from "../compilers/editorial-input.js";
import { rulesDraft } from "../compilers/editorial-input.js";
import * as p110 from "../compilers/p110-news-index.js";
import * as p111 from "../compilers/p111-news-story.js";
import * as p500 from "../compilers/p500-on-this-day.js";
import * as p501 from "../compilers/p501-births-deaths.js";
import * as p700 from "../compilers/p700-featured-article.js";
import type { Snapshot } from "../sources/snapshot.js";
import type { PageJob } from "./edit-page.js";
import { publishPage } from "./publish-page.js";

// The twelve pages the AI editor may write, in order (ai-editor glossary, design.md, "AI pages").

/** One page with its data taken from a snapshot. */
export interface PreparedPage {
  readonly input: EditorialInput;
  readonly assemble: (rows: DraftRows) => CompileResult;
}

export interface AiPage {
  readonly number: number;
  readonly prepare: (snapshot: Snapshot) => PreparedPage;
}

function story(n: number): AiPage {
  return {
    number: 110 + n,
    prepare: (snapshot) => {
      const data = { entry: snapshot.sources["wikimedia-feed"], story: n };
      return {
        input: p111.editorialInput(data),
        assemble: (rows) => p111.assemble(data, rows),
      };
    },
  };
}

export const AI_PAGES: readonly AiPage[] = Object.freeze([
  {
    number: 110,
    prepare: (snapshot) => {
      const entry = snapshot.sources["wikimedia-feed"];
      return { input: p110.editorialInput(entry), assemble: (rows) => p110.assemble(entry, rows) };
    },
  },
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(story),
  {
    number: 500,
    prepare: (snapshot) => {
      const entry = snapshot.sources["wikimedia-onthisday"];
      return { input: p500.editorialInput(entry), assemble: (rows) => p500.assemble(entry, rows) };
    },
  },
  {
    number: 501,
    prepare: (snapshot) => {
      const entry = snapshot.sources["wikimedia-onthisday"];
      return { input: p501.editorialInput(entry), assemble: (rows) => p501.assemble(entry, rows) };
    },
  },
  {
    number: 700,
    prepare: (snapshot) => {
      const entry = snapshot.sources["wikimedia-feed"];
      return { input: p700.editorialInput(entry), assemble: (rows) => p700.assemble(entry, rows) };
    },
  },
]);

/** The job `editPage` edits for a page of the snapshot at time `now`. */
export function jobFor(page: AiPage, snapshot: Snapshot, now: Date): PageJob {
  const prepared = page.prepare(snapshot);
  return {
    input: prepared.input,
    rules: rulesDraft(prepared.input),
    publish: (rows, editor) => publishPage(page.number, prepared.assemble(rows), now, editor),
  };
}
