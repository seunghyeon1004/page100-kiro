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
         1050 Henry IV, Holy Roman Emperor    
              (died 1106)                     
         1925 June Whitfield, English actress 
              (died 2018)                     
         1964 Philip McKeon, American actor   
              (died 2019)                     
         2005 Ben Gannon-Doak, Scottish       
              footballer                      
                                              
       Died on 11 Nov                         
          405 Arsacius of Tarsus, Tarsian     
              archbishop (born 324)           
         1940 Muhittin Akyüz, Turkish general 
              and diplomat (born 1870)        
         2000 Sandra Schmitt, German skier    
              (born 1981)                     
         2024 Frank Auerbach, German-British  
              painter (born 1931)             
                                              
      Wikipedia, CC BY-SA 4.0        07:16 UTC
       Index     Events    Quiz      Quakes   "
    `);
  });

  it("chooses across the kept list, oldest first: positions round(i (n - 1) / 3)", () => {
    const years = [2001, 1650, 1990, 1200, 1955, 1900, 1812, 1775, 1999, 1500];
    const list = years.map((year, i) => ({ year, text: `Person ${String(i)}` }));
    const entry = { ...ENTRY, value: { ...ENTRY.value, births: list, deaths: list.slice(0, 3) } };
    const slots = editorialInput(entry).slots;
    const textsOf = (prefix: string) =>
      slots.filter((s) => s.id.startsWith(prefix)).map((s) => s.text);
    // Sorted by year, n = 10: 1200 (3), 1500 (9), 1650 (1), 1775 (7), 1812 (6), 1900 (5),
    // 1955 (4), 1990 (2), 1999 (8), 2001 (0). Positions 0, 3, 6, 9 give 1200, 1775, 1955, 2001.
    expect(textsOf("born")).toEqual(["Person 3", "Person 7", "Person 4", "Person 0"]);
    // Three deaths (2001, 1650, 1990): all of them, oldest first.
    expect(textsOf("died")).toEqual(["Person 1", "Person 2", "Person 0"]);
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
