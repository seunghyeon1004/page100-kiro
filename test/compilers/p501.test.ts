import { describe, expect, it } from "vitest";
import { rulesDraft } from "../../src/compilers/editorial-input.js";
import { assemble, compile501, editorialInput } from "../../src/compilers/p501-births-deaths.js";
import {
  NOW,
  SNAPSHOT,
  markupOf,
  pageOf,
  pageProblems,
  plainOf,
  screenText,
} from "./boot-snapshot.js";

const ENTRY = SNAPSHOT.sources["wikimedia-onthisday"];

describe("page 501 (requirement 14.2)", () => {
  const result = compile501(ENTRY);

  it("is sound and takes the fetch time", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({ number: 501, dataAt: new Date(ENTRY.fetchedAt) });
  });

  it("has four born and four died slots of 2 x 32, 16 rows in all", () => {
    const input = editorialInput(ENTRY);
    expect(input.slots.map((s) => s.id)).toEqual([
      "born-1",
      "born-2",
      "born-3",
      "born-4",
      "died-1",
      "died-2",
      "died-3",
      "died-4",
    ]);
    expect(input.slots.every((s) => s.maxRows === 2 && s.width === 32 && s.mode === "body")).toBe(
      true,
    );
    expect(input.totalRows).toBe(16);
  });

  it("shows the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P501 Page 100        Wed 11 Nov 14:05:09
      ON THIS DAY: BIRTHS AND DEATHS          
       Born on 11 Nov                         
         1984 Stephen Hunt, English footballer
         1988 David Depetris, Argentinian-    
              Slovak footballer               
         1992 Sofía Luini, Argentine tennis   
              player                          
         2005 Ben Gannon-Doak, Scottish       
              footballer                      
                                              
                                              
       Died on 11 Nov                         
         1999 Mary Kay Bergman, American voice
              actress (born 1961)             
         2008 Herb Score, American baseball   
              player and sportscaster (born...
         2013 Atilla Karaosmanoglu, Turkish   
              economist and politician...     
         2024 John Robinson, American football
              player and coach (born 1935)    
                                              
      Wikipedia, CC BY-SA 4.0        07:16 UTC
       Index     Events    Quiz      Quakes   "
    `);
  });

  it("gives two headings and two lists", () => {
    const kinds = pageOf(result).subpages[0].alt.map((b) => b.kind);
    expect(kinds).toEqual(["heading", "list", "heading", "list"]);
  });

  it("shows only the section that has entries", () => {
    const entry = { ...ENTRY, value: { ...ENTRY.value, deaths: [] } };
    const out = compile501(entry);
    expect(pageProblems(out)).toEqual([]);
    const text = plainOf(markupOf(out));
    expect(text).toContain("Born on 11 Nov");
    expect(text).not.toContain("Died on");
    expect(pageOf(out).subpages[0].alt.map((b) => b.kind)).toEqual(["heading", "list"]);
  });

  it("gives the no-data page when neither list has an entry", () => {
    const out = compile501({ ...ENTRY, value: { ...ENTRY.value, births: [], deaths: [] } });
    expect(out.ok && out.outcome).toBe("no-data");
    expect(pageProblems(out)).toEqual([]);
  });

  it("is assemble of the rules draft, and finds the page row of a death", () => {
    expect(compile501(ENTRY)).toEqual(assemble(ENTRY, rulesDraft(editorialInput(ENTRY))));
    const draft = rulesDraft(editorialInput(ENTRY)).map((rows) => [...rows]);
    draft[4] = ["w".repeat(33)];
    const out = assemble(ENTRY, draft);
    expect(out.ok).toBe(false);
    if (!out.ok)
      expect(out.problems[0]).toMatchObject({
        code: "row-width",
        row: 13,
        message: "row 13 is 33 cells, limit 32",
      });
  });
});
