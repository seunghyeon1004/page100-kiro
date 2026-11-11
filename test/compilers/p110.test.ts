import { describe, expect, it } from "vitest";
import { checkDraft } from "../../src/compilers/editorial-input.js";
import {
  assemble,
  compile110,
  editorialInput,
  rulesDraft,
} from "../../src/compilers/p110-news-index.js";
import {
  NOW,
  SNAPSHOT,
  cloneSnapshot,
  markupOf,
  pageOf,
  pageProblems,
  screenText,
} from "./boot-snapshot.js";

const ENTRY = SNAPSHOT.sources["wikimedia-feed"];

describe("page 110 (requirement 10.1)", () => {
  const result = compile110(ENTRY);

  it("is sound and takes its time from the feed", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({
      number: 110,
      dataAt: new Date(ENTRY.fetchedAt),
      editor: "rules",
    });
    expect(result.ok && result.outcome).toBe("compiled");
  });

  it("builds one headline slot per folded story, 3 rows of 35", () => {
    const input = editorialInput(ENTRY);
    expect(input.page).toBe(110);
    expect(input.totalRows).toBe(18);
    expect(input.slots.map((s) => s.id)).toEqual([
      "story-1",
      "story-2",
      "story-3",
      "story-4",
      "story-5",
    ]);
    for (const slot of input.slots) {
      expect([slot.mode, slot.maxRows, slot.width]).toEqual(["headline", 3, 35]);
    }
  });

  it("shows the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P110 Page 100        Wed 11 Nov 14:05:09
      WORLD NEWS                              
       Top stories, 11 Nov 2026               
                                              
       111 In stock car racing, Kyle Larson   
           wins the NASCAR Cup Series         
       112 Mass shooting in the Main Square of
           Kraków, Poland, leaves six people  
           dead and sixteen others injured    
       115 In motorsport, Kimi Antonelli      
           becomes the youngest ever winner of
           the Formula One World Championship 
                                              
                                              
                                              
                                              
                                              
                                              
                                              
                                              
                                              
                                              
      Wikipedia, CC BY-SA 4.0        07:16 UTC
       Index     Story     Popular   Weather  "
    `);
  });

  it("lists whole items with their story page, as links", () => {
    const alt = pageOf(result).subpages[0].alt;
    expect(alt[0]).toMatchObject({ kind: "heading", text: "Top stories, 11 Nov 2026" });
    const links = alt.filter((b) => b.kind === "link");
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toMatchObject({ target: { page: 111 } });
  });
});

describe("page 110: other feeds", () => {
  it("gives the no-data page when the feed has no news", () => {
    const snapshot = cloneSnapshot();
    const entry = {
      ...snapshot.sources["wikimedia-feed"],
      value: { ...snapshot.sources["wikimedia-feed"].value, news: null },
    };
    const result = compile110(entry);
    expect(result.ok && result.outcome).toBe("no-data");
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result).dataAt).toBeNull();
  });

  it("skips a story that does not fold and shows fewer than 8 stories", () => {
    const value = SNAPSHOT.sources["wikimedia-feed"].value;
    const entry = {
      ...ENTRY,
      value: {
        ...value,
        news: [
          { text: "Bad \u2603 story", articles: [] },
          { text: "Short story here.", articles: [] },
        ],
      },
    };
    const input = editorialInput(entry);
    expect(input.slots.map((s) => [s.id, s.text])).toEqual([["story-1", "Short story here."]]);
    expect(markupOf(compile110(entry))).toContain("{y}111{w}");
  });
});

describe("page 110: assemble rejects and never trims (requirement 8.4)", () => {
  it("rejects a row over 35 cells with the page row in the message", () => {
    const input = editorialInput(ENTRY);
    const draft = rulesDraft(input).map((rows) => [...rows]);
    draft[0] = ["x".repeat(38)];
    const result = assemble(ENTRY, draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0]).toMatchObject({
      code: "row-width",
      row: 4,
      message: "row 4 is 38 cells, limit 35",
    });
  });

  it("agrees with checkDraft on the page row of a later slot", () => {
    const input = editorialInput(ENTRY);
    const draft = rulesDraft(input).map((rows) => [...rows]);
    const used = draft[0]?.length ?? 0;
    draft[1] = ["y".repeat(36)];
    const result = assemble(ENTRY, draft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0].row).toBe(4 + used);
    expect(checkDraft(input, draft, (s, r) => s * 100 + r)).toHaveLength(1);
  });

  it("gives the no-data page when every slot has zero rows", () => {
    const input = editorialInput(ENTRY);
    const result = assemble(
      ENTRY,
      input.slots.map(() => []),
    );
    expect(result.ok && result.outcome).toBe("no-data");
  });
});
