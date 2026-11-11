import { describe, expect, it } from "vitest";
import { rulesDraft } from "../../src/compilers/editorial-input.js";
import { assemble, compile700, editorialInput } from "../../src/compilers/p700-featured-article.js";
import {
  NOW,
  SNAPSHOT,
  markupOf,
  pageOf,
  pageProblems,
  plainOf,
  screenText,
} from "./boot-snapshot.js";

const ENTRY = SNAPSHOT.sources["wikimedia-feed"];

function withArticle(
  article: { title: string; extract: string | null; url: string | null } | null,
) {
  return { ...ENTRY, value: { ...ENTRY.value, featuredArticle: article } };
}

describe("page 700 (requirement 10.4)", () => {
  const result = compile700(ENTRY);

  it("is sound and takes the feed's time", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({ number: 700, dataAt: new Date(ENTRY.fetchedAt) });
  });

  it("has one body slot of 16 x 38", () => {
    expect(editorialInput(ENTRY)).toMatchObject({
      page: 700,
      totalRows: 16,
      slots: [{ id: "body", mode: "body", maxRows: 16, width: 38 }],
    });
  });

  it("shows the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P700 Page 100        Wed 11 Nov 14:05:09
      FEATURED ARTICLE                        
       U.S. Route 101                         
                                              
       U.S. Route 101, or U.S. Highway 101    
       (US 101), is a major north-south       
       highway that traverses the states of   
       California, Oregon, and Washington on  
       the West Coast of the United States.   
       It is part of the United States        
       Numbered Highway System and runs for   
       over 1,500 miles (2,400 km) along the  
       Pacific Ocean. The highway is also     
       known by various names, including El   
       Camino Real in parts of California,    
       the Oregon Coast Highway, and the      
       Olympic Highway in Washington.         
                                              
                                              
                                              
                                              
                                              
      Wikipedia, CC BY-SA 4.0        07:16 UTC
       Index     News      Popular   Help     "
    `);
  });

  it("gives a heading, a paragraph and a link", () => {
    const alt = pageOf(result).subpages[0].alt;
    expect(alt.map((b) => b.kind)).toEqual(["heading", "paragraph", "link"]);
    expect(alt[2]).toMatchObject({ text: "Read on Wikipedia: U.S. Route 101" });
  });

  it("leaves out a title that does not wrap into 2 rows but keeps the heading in the alternative", () => {
    const entry = withArticle({ title: "x".repeat(60), extract: "Body only.", url: null });
    const markup = plainOf(markupOf(compile700(entry)));
    expect(markup).toBe(" Body only.\n");
    expect(pageOf(compile700(entry)).subpages[0].alt[0]).toMatchObject({ kind: "heading" });
  });

  it("gives the no-data page for no article, a title or extract that does not fold, or no extract", () => {
    for (const article of [
      null,
      { title: "Bad \u2603", extract: "Text.", url: null },
      { title: "Fine", extract: "Bad \u2603", url: null },
      { title: "Fine", extract: null, url: null },
    ]) {
      const out = compile700(withArticle(article));
      expect(out.ok && out.outcome).toBe("no-data");
      expect(pageProblems(out)).toEqual([]);
    }
  });

  it("rejects a body row over 38 cells at its page row", () => {
    const draft = rulesDraft(editorialInput(ENTRY)).map((rows) => [...rows]);
    draft[0] = ["q".repeat(40)];
    const out = assemble(ENTRY, draft);
    expect(out.ok).toBe(false);
    // The title is one row, so the body starts at page row 4.
    if (!out.ok)
      expect(out.problems[0]).toMatchObject({
        code: "row-width",
        row: 4,
        message: "row 4 is 40 cells, limit 38",
      });
  });
});
