import { describe, expect, it } from "vitest";
import { assemble, compileStory, editorialInput } from "../../src/compilers/p111-news-story.js";
import { rulesDraft } from "../../src/compilers/editorial-input.js";
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

describe("pages 111 to 118 (requirement 10.2)", () => {
  it("is sound for each of the five stories and takes the feed's time", () => {
    for (let story = 1; story <= 5; story++) {
      const result = compileStory({ entry: ENTRY, story });
      expect(pageProblems(result), `story ${String(story)}`).toEqual([]);
      expect(pageOf(result)).toMatchObject({
        number: 110 + story,
        dataAt: new Date(ENTRY.fetchedAt),
      });
      expect(result.ok && result.outcome).toBe("compiled");
    }
  });

  it("has a lead slot of 5 x 38 and a background slot of 12 x 38, 17 rows in all", () => {
    const input = editorialInput({ entry: ENTRY, story: 1 });
    expect(input.slots.map((s) => [s.id, s.mode, s.maxRows, s.width])).toEqual([
      ["lead", "body", 5, 38],
      ["background", "body", 12, 38],
    ]);
    expect(input.totalRows).toBe(17);
  });

  it("shows story 1 on the screen", () => {
    expect(screenText(compileStory({ entry: ENTRY, story: 1 }), 0, NOW)).toMatchInlineSnapshot(`
      "P111 Page 100        Wed 11 Nov 14:05:09
      WORLD NEWS                              
       In stock car racing, Kyle Larson wins  
       the NASCAR Cup Series.                 
                                              
       Background: 2026 NASCAR Cup Series     
       The 2026 NASCAR Cup Series was the     
       78th season for NASCAR professional    
       stock car racing in the United States  
       and the 55th season for the modern-era 
       Cup Series. The preseason featured the 
       Cook Out Clash exhibition race on      
       February 4 at Bowman Gray Stadium,     
       followed by the season-opening 68th    
       running of the Daytona 500 on February 
       15 at Daytona International Speedway.  
       The season ended at Homestead-Miami    
       Speedway on November 8.                
                                              
                                              
                                              
                                              
      Wikipedia, CC BY-SA 4.0        07:16 UTC
       Index     News      Popular   Weather  "
    `);
  });

  it("gives the text alternative: paragraph, heading, paragraph, link", () => {
    const alt = pageOf(compileStory({ entry: ENTRY, story: 1 })).subpages[0].alt;
    expect(alt.map((b) => b.kind)).toEqual(["paragraph", "heading", "paragraph", "link"]);
    expect(alt[1]).toMatchObject({ level: 3, text: "Background: 2026 NASCAR Cup Series" });
    expect(alt[3]).toEqual({
      kind: "link",
      text: "Read on Wikipedia: 2026 NASCAR Cup Series",
      target: { url: "https://en.wikipedia.org/wiki/2026_NASCAR_Cup_Series" },
    });
  });

  it("shows the no-story page, with outcome no-data, for a story that does not exist", () => {
    for (const story of [6, 7, 8]) {
      const result = compileStory({ entry: ENTRY, story });
      expect(result.ok && result.outcome, `story ${String(story)}`).toBe("no-data");
      expect(plainOf(markupOf(result))).toContain("No story on this page today.");
      expect(pageProblems(result)).toEqual([]);
      expect(pageOf(result).dataAt).toBeNull();
    }
  });

  it("leaves out the background heading when it is wider than 38 cells but keeps the text", () => {
    const value = ENTRY.value;
    const long = "T".repeat(10) + " " + "u".repeat(30);
    const entry = {
      ...ENTRY,
      value: {
        ...value,
        news: [
          {
            text: "A short lead sentence.",
            articles: [{ title: long, extract: "Background text of the article.", url: null }],
          },
        ],
      },
    };
    const markup = plainOf(markupOf(compileStory({ entry, story: 1 })));
    expect(markup).not.toContain("Background:");
    expect(markup).toContain("Background text of the article.");
    const alt = pageOf(compileStory({ entry, story: 1 })).subpages[0].alt;
    expect(alt.map((b) => b.kind)).toEqual(["paragraph", "heading", "paragraph"]);
  });

  it("shows only the lead when no article folds, and gives no link without a URL", () => {
    const entry = {
      ...ENTRY,
      value: {
        ...ENTRY.value,
        news: [
          {
            text: "Only a lead here.",
            articles: [{ title: "Bad \u2603", extract: "x", url: "https://example.org/a" }],
          },
        ],
      },
    };
    const result = compileStory({ entry, story: 1 });
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result).subpages[0].alt).toEqual([
      { kind: "paragraph", text: "Only a lead here." },
    ]);
    expect(editorialInput({ entry, story: 1 }).slots).toHaveLength(1);
  });

  it("is the same as assemble of the rules draft", () => {
    const data = { entry: ENTRY, story: 2 };
    expect(compileStory(data)).toEqual(assemble(data, rulesDraft(editorialInput(data))));
  });

  it("rejects a lead row over 38 cells at page row 2", () => {
    const data = { entry: ENTRY, story: 1 };
    const draft = rulesDraft(editorialInput(data)).map((rows) => [...rows]);
    draft[0] = ["z".repeat(39)];
    const result = assemble(data, draft);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.problems[0]).toMatchObject({
        code: "row-width",
        row: 2,
        message: "row 2 is 39 cells, limit 38",
      });
  });
});
