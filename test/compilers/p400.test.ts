import { describe, expect, it } from "vitest";
import { compileHn } from "../../src/compilers/p400-developer-news.js";
import {
  NOW,
  SNAPSHOT,
  pageOf,
  pageProblems,
  plainOf,
  markupOf,
  screenText,
} from "./boot-snapshot.js";

const ENTRY = SNAPSHOT.sources["hacker-news"];

const story = (id: number, title: string, score: number | null, comments: number | null) => ({
  id,
  title,
  by: "someone",
  score,
  comments,
  time: "2026-11-11T04:28:57.000Z",
  url: null,
});

describe("pages 400, 401 and 402 (requirement 13.1)", () => {
  it("is sound for each list and takes the fetch time", () => {
    for (const [list, number] of [
      ["top", 400],
      ["show", 401],
      ["ask", 402],
    ] as const) {
      const out = compileHn({ entry: ENTRY, list });
      expect(pageProblems(out), list).toEqual([]);
      expect(pageOf(out)).toMatchObject({
        number,
        dataAt: new Date(ENTRY.fetchedAt),
        editor: "rules",
      });
    }
  });

  it("shows the top list on the screen", () => {
    expect(screenText(compileHn({ entry: ENTRY, list: "top" }), 0, NOW)).toMatchInlineSnapshot(`
      "P400 Page 100        Wed 11 Nov 14:05:09
      DEVELOPER NEWS: TOP                     
       1 Protecting SSH Keys with macOS       
         Secure Enclave                       
         99 points, 37 comments               
       2 Greg Kurtzer's Ginux is now a        
         userspace kernel                     
         40 points, 10 comments               
       3 Scion is back and is going to sell a 
         kei truck in America                 
         438 points, 297 comments             
       4 .name Grandfathered                  
         775 points, 171 comments             
       5 Smart home devices should work       
         without the internet                 
         856 points, 306 comments             
       6 To deter bioterrorism, U.S. imposes  
         new rules on ordering synthetic DNA  
         67 points, 36 comments               
       7 A great old-timey game-programming   
         hack (2013)                          
         112 points, 16 comments              
      Hacker News API                07:16 UTC
       Index     Show      Ask       This day "
    `);
  });

  it("gives a list item per shown story", () => {
    const alt = pageOf(compileHn({ entry: ENTRY, list: "top" })).subpages[0].alt;
    expect(alt).toHaveLength(1);
    const block = alt[0];
    expect(block.kind === "list" && block.items[0]).toBe(
      "1 Protecting SSH Keys with macOS Secure Enclave, 99 points, 37 comments",
    );
  });

  it("writes 1 point, 1 comment and n/a points", () => {
    const entry = {
      ...ENTRY,
      value: {
        ...ENTRY.value,
        top: [story(1, "One", 1, 1), story(2, "Two", null, null), story(3, "Three", 2, 0)],
      },
    };
    const text = plainOf(markupOf(compileHn({ entry, list: "top" })));
    expect(text).toContain("1 point, 1 comment");
    expect(text).toContain("n/a points, n/a comments");
    expect(text).toContain("2 points, 0 comments");
  });

  it("numbers by position in the list, so a dropped story leaves a gap", () => {
    const entry = {
      ...ENTRY,
      value: { ...ENTRY.value, top: [story(1, "Bad \u2603", 1, 1), story(2, "Kept title", 5, 6)] },
    };
    expect(plainOf(markupOf(compileHn({ entry, list: "top" })))).toBe(
      " 2 Kept title\n   5 points, 6 comments\n",
    );
  });

  it("drops a title that does not fit 2 rows of 36 and ends the list at the first item that does not fit", () => {
    const long = "word ".repeat(20).trim();
    const items = [
      story(1, long, 1, 1),
      ...Array.from({ length: 12 }, (_, i) => story(i + 2, `Title number ${String(i)}`, 1, 1)),
    ];
    const out = compileHn({
      entry: { ...ENTRY, value: { ...ENTRY.value, top: items } },
      list: "top",
    });
    expect(pageProblems(out)).toEqual([]);
    const block = pageOf(out).subpages[0].alt[0];
    // 2 rows per item, so 10 items fill the 20 rows.
    expect(block.kind === "list" && block.items.length).toBe(10);
    expect(block.kind === "list" && block.items[0]).toBe("2 Title number 0, 1 point, 1 comment");
  });

  it("gives the no-data page for an empty list", () => {
    const out = compileHn({ entry: { ...ENTRY, value: { ...ENTRY.value, ask: [] } }, list: "ask" });
    expect(out.ok && out.outcome).toBe("no-data");
    expect(pageOf(out).number).toBe(402);
    expect(pageProblems(out)).toEqual([]);
  });
});
