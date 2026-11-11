import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { foldText } from "../../src/grid/fold-text.js";
import { rulesDraft } from "../../src/compilers/editorial-input.js";
import type { DraftRows, EditorialInput } from "../../src/compilers/editorial-input.js";
import type { CompileResult } from "../../src/compilers/compile-types.js";
import { wrapWords } from "../../src/compilers/fit-text.js";
import * as p110 from "../../src/compilers/p110-news-index.js";
import * as p111 from "../../src/compilers/p111-news-story.js";
import * as p500 from "../../src/compilers/p500-on-this-day.js";
import * as p501 from "../../src/compilers/p501-births-deaths.js";
import * as p700 from "../../src/compilers/p700-featured-article.js";
import type { Snapshot } from "../../src/sources/snapshot.js";
import { snapshotArb } from "./compile-arbitraries.js";

// Property 9 (design.md). Each case is one AI page: its data, its compiler, its `editorialInput`
// and `assemble`, and the page row that the page layout gives a row of slot `slot` (written here
// from the layout table, not read from the code).

interface Case {
  readonly name: string;
  readonly compile: () => CompileResult;
  readonly input: EditorialInput;
  readonly assemble: (rows: DraftRows) => CompileResult;
  readonly rowOf: (draft: DraftRows, slot: number, row: number) => number;
}

function sum(draft: DraftRows, from: number, to: number): number {
  return draft.slice(from, to).reduce((total, rows) => total + rows.length, 0);
}

function foldedOk(s: string | null): string | undefined {
  if (s === null) return undefined;
  const f = foldText(s);
  return f.ok ? f.text : undefined;
}

function cases(snapshot: Snapshot): Case[] {
  const feed = snapshot.sources["wikimedia-feed"];
  const day = snapshot.sources["wikimedia-onthisday"];
  const out: Case[] = [];

  out.push({
    name: "110",
    compile: () => p110.compile110(feed),
    input: p110.editorialInput(feed),
    assemble: (rows) => p110.assemble(feed, rows),
    rowOf: (draft, slot, row) => 4 + sum(draft, 0, slot) + row,
  });

  for (let story = 1; story <= 8; story++) {
    const data = { entry: feed, story };
    const article = (feed.value.news ?? [])
      .filter((n) => foldedOk(n.text) !== undefined)
      [story - 1]?.articles.find(
        (a) => foldedOk(a.title) !== undefined && foldedOk(a.extract) !== undefined,
      );
    const title = foldedOk(article?.title ?? null);
    out.push({
      name: String(110 + story),
      compile: () => p111.compileStory(data),
      input: p111.editorialInput(data),
      assemble: (rows) => p111.assemble(data, rows),
      rowOf: (draft, slot, row) => {
        if (slot === 0) return 2 + row;
        const lead = draft[0]?.length ?? 0;
        const heading =
          title !== undefined && Array.from(`Background: ${title}`).length <= 38 ? 1 : 0;
        return 2 + (lead > 0 ? lead + 1 : 0) + heading + row;
      },
    });
  }

  out.push({
    name: "500",
    compile: () => p500.compile500(day),
    input: p500.editorialInput(day),
    assemble: (rows) => p500.assemble(day, rows),
    rowOf: (draft, slot, row) => 4 + sum(draft, 0, slot) + row,
  });

  const born = p501.editorialInput(day).slots.filter((s) => s.id.startsWith("born")).length;
  out.push({
    name: "501",
    compile: () => p501.compile501(day),
    input: p501.editorialInput(day),
    assemble: (rows) => p501.assemble(day, rows),
    rowOf: (draft, slot, row) =>
      slot < born ? 3 + sum(draft, 0, slot) + row : 13 + sum(draft, born, slot) + row,
  });

  const featured = feed.value.featuredArticle;
  const featuredTitle = foldedOk(featured?.title ?? null);
  const titleFit = featuredTitle === undefined ? undefined : wrapWords(featuredTitle, 38, 2);
  const titleRows = titleFit?.ok === true ? titleFit.rows.length : 0;
  out.push({
    name: "700",
    compile: () => p700.compile700(feed),
    input: p700.editorialInput(feed),
    assemble: (rows) => p700.assemble(feed, rows),
    rowOf: (_draft, _slot, row) => 2 + (titleRows > 0 ? titleRows + 1 : 0) + row,
  });
  return out;
}

describe("editor seam properties", () => {
  it("Property 9: compiler equals assemble of the rules draft and succeeds; an over-wide row is rejected at its page row; assemble never throws", () => {
    fc.assert(
      fc.property(
        snapshotArb,
        fc.nat(1000),
        fc.integer({ min: 1, max: 10 }),
        fc.array(fc.array(fc.string({ unit: "binary", maxLength: 50 }), { maxLength: 4 }), {
          maxLength: 9,
        }),
        (snapshot, pick, extra, junk) => {
          for (const c of cases(snapshot)) {
            const draft = rulesDraft(c.input);
            const viaCompiler = c.compile();
            const viaAssemble = c.assemble(draft);
            expect(viaCompiler, c.name).toEqual(viaAssemble);
            expect(viaCompiler.ok, c.name).toBe(true);

            // Replace one row of the draft with a string 1 to 10 cells over the slot's width.
            const spots = draft.flatMap((rows, slot) => rows.map((_, row) => [slot, row] as const));
            const spot = spots[pick % Math.max(1, spots.length)];
            if (spot !== undefined) {
              const [slot, row] = spot;
              const width = c.input.slots[slot]?.width ?? 0;
              const bad = draft.map((rows) => [...rows]);
              const rowsOfSlot = bad[slot];
              if (rowsOfSlot !== undefined) rowsOfSlot[row] = "w".repeat(width + extra);
              const result = c.assemble(bad);
              const expectedRow = c.rowOf(draft, slot, row);
              expect(result.ok, c.name).toBe(false);
              if (!result.ok) {
                expect(result.problems, c.name).toContainEqual({
                  code: "row-width",
                  subpage: null,
                  row: expectedRow,
                  col: width,
                  message: `row ${String(expectedRow)} is ${String(width + extra)} cells, limit ${String(width)}`,
                });
              }
            }

            // Arbitrary arrays of strings, and values that are not arrays, never throw.
            expect(() => c.assemble(junk)).not.toThrow();
            expect(() => c.assemble(junk.slice(0, c.input.slots.length))).not.toThrow();
            expect(() => c.assemble(5 as never)).not.toThrow();
            expect(() => c.assemble([[1], "x"] as never)).not.toThrow();
          }
        },
      ),
      { numRuns: 60 },
    );
  });
});
