import { describe, expect, it } from "vitest";
import { rulesDraft } from "../../src/compilers/editorial-input.js";
import { assemble, compile500, editorialInput } from "../../src/compilers/p500-on-this-day.js";
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

function withEvents(events: { year: number; text: string }[], month = 11, day = 11) {
  return { ...ENTRY, value: { ...ENTRY.value, month, day, events } };
}

describe("page 500 (requirement 14.2)", () => {
  const result = compile500(ENTRY);

  it("is sound and takes the fetch time", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({
      number: 500,
      dataAt: new Date(ENTRY.fetchedAt),
      editor: "rules",
    });
  });

  it("has six body slots of 3 x 32, 18 rows in all", () => {
    const input = editorialInput(ENTRY);
    expect(input.slots.map((s) => [s.id, s.mode, s.maxRows, s.width])).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => [`event-${String(n)}`, "body", 3, 32]),
    );
    expect(input.totalRows).toBe(18);
  });

  it("shows the screen, events spread over the years in ascending order", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P500 Page 100        Wed 11 Nov 14:05:09
      ON THIS DAY                             
       Events on 11 Nov                       
                                              
          109 Roman emperor Trajan celebrates 
              his newly constructed naumachia 
              with a display of ships and...  
         1750 The F.H.C. Society, also known  
              as the Flat Hat Club, is formed 
              at Raleigh Tavern...            
         1918 Józef Pilsudski assumes supreme 
              military power in Poland -      
              symbolic first day of Polish... 
         1961 Thirteen Italian Air Force      
              servicemen, deployed to the     
              Congo as a part of the UN...    
         1999 The House of Lords Act is given 
              Royal Assent, restricting       
              membership of the British...    
         2024 A vehicle-ramming attack in     
              Zhuhai, China, kills 38 people  
              and injures 48.                 
      Wikipedia, CC BY-SA 4.0        07:16 UTC
       Index     Births    Quiz      Quakes   "
    `);
  });

  it("names the data's day, not the day of now", () => {
    expect(
      plainOf(
        markupOf(compile500(withEvents([{ year: 1900, text: "Something happened." }], 2, 29))),
      ),
    ).toContain("Events on 29 Feb");
    expect(
      plainOf(
        markupOf(compile500(withEvents([{ year: 1900, text: "Something happened." }], 3, 4))),
      ),
    ).toContain("Events on 04 Mar");
  });

  it("writes BC years with BC and sorts them before later years", () => {
    const out = compile500(
      withEvents([
        { year: 1066, text: "Later event." },
        { year: -44, text: "Earlier event." },
      ]),
    );
    const text = plainOf(markupOf(out));
    expect(text.indexOf("44 BC")).toBeLessThan(text.indexOf("1066"));
    const list = pageOf(out).subpages[0].alt.find((b) => b.kind === "list");
    expect(list?.kind === "list" && list.items).toEqual([
      "44 BC: Earlier event.",
      "1066: Later event.",
    ]);
  });

  it("gives the no-data page for no events, or events that do not fold", () => {
    for (const events of [[], [{ year: 1900, text: "Bad \u2603" }]]) {
      const out = compile500(withEvents(events));
      expect(out.ok && out.outcome).toBe("no-data");
      expect(pageProblems(out)).toEqual([]);
    }
  });

  it("is assemble of the rules draft, and rejects a row over 32 cells at its page row", () => {
    const draft = rulesDraft(editorialInput(ENTRY)).map((rows) => [...rows]);
    expect(compile500(ENTRY)).toEqual(assemble(ENTRY, rulesDraft(editorialInput(ENTRY))));
    const firstLength = draft[0]?.length ?? 0;
    draft[1] = ["z".repeat(33)];
    const out = assemble(ENTRY, draft);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.problems[0]).toMatchObject({
        code: "row-width",
        row: 4 + firstLength,
        message: `row ${String(4 + firstLength)} is 33 cells, limit 32`,
      });
    }
  });
});
