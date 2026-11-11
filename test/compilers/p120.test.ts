import { describe, expect, it } from "vitest";
import { compile120 } from "../../src/compilers/p120-most-read.js";
import {
  NOW,
  SNAPSHOT,
  cloneSnapshot,
  pageOf,
  pageProblems,
  screenText,
  tableRows,
} from "./boot-snapshot.js";

const ENTRY = SNAPSHOT.sources["wikimedia-feed"];

function withMostRead(
  mostRead: { rank: number; title: string; views: number; extract: string | null }[] | null,
) {
  return { ...ENTRY, value: { ...ENTRY.value, mostRead } };
}

describe("page 120 (requirement 10.3)", () => {
  const result = compile120(ENTRY);

  it("is sound and takes the feed's time", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({
      number: 120,
      dataAt: new Date(ENTRY.fetchedAt),
      editor: "rules",
    });
  });

  it("shows the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P120 Page 100        Wed 11 Nov 14:05:09
      MOST READ ON WIKIPEDIA                  
          Article                        Views
        1 Ramayana: Part 1             840,888
        2 Russell Brand                545,717
        3 Jensen Huang                 542,553
        4 David Walliams               512,804
        5 Thomas Massie                166,628
        6 SS Edmund Fitzgerald         163,598
        7 Carson Wentz                 158,702
        8 Scene (2026 film)            143,180
        9 Lara Stone                   139,117
       10 Deaths in 2026               138,565
       11 Kirk Cousins                 136,900
       12 Pete Hegseth                 127,687
       13 Nvidia                       123,851
       14 List of highest-grossing     122,614
          Indian films                        
       15 Abdul El-Sayed               119,560
       16 Godzilla Minus Zero          107,366
       17 Jemima Goldsmith              96,742
                                              
      Wikipedia, CC BY-SA 4.0        07:16 UTC
       Index     News      Article   Weather  "
    `);
  });

  it("gives a table of Rank, Article, Views", () => {
    const alt = pageOf(result).subpages[0].alt;
    expect(alt).toHaveLength(1);
    expect(alt[0]).toMatchObject({ kind: "table", headers: ["Rank", "Article", "Views"] });
    expect(tableRows(result)[0]).toEqual(["1", "Ramayana: Part 1", "840,888"]);
  });

  it("gives the no-data page for no list and for an empty list", () => {
    for (const list of [null, []]) {
      const out = compile120(withMostRead(list));
      expect(out.ok && out.outcome).toBe("no-data");
      expect(pageProblems(out)).toEqual([]);
    }
  });

  it("drops an item whose title does not fold or has a word wider than the column", () => {
    const out = compile120(
      withMostRead([
        { rank: 1, title: "Bad \u2603", views: 5, extract: null },
        { rank: 2, title: "w".repeat(26), views: 5, extract: null },
        { rank: 3, title: "Kept", views: 1_000, extract: null },
      ]),
    );
    // The position in our list, not the feed rank 3.
    expect(tableRows(out)).toEqual([["1", "Kept", "1,000"]]);
  });

  it("ends the list at the first item that does not fit and never cuts through an item", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      rank: i + 1,
      title: "Two words here and some more words",
      views: 100,
      extract: null,
    }));
    const out = compile120(withMostRead(many));
    expect(pageProblems(out)).toEqual([]);
    // Each title takes 2 rows, so 9 items fill r1 to r18.
    expect(tableRows(out)).toHaveLength(9);
  });

  it("shows the position in our list, 1, 2, 3 with no gaps, and never the feed rank", () => {
    const out = compile120(
      withMostRead([
        { rank: 2, title: "Second", views: 9, extract: null },
        { rank: 5, title: "Bad \u2603", views: 9, extract: null },
        { rank: 6, title: "Sixth", views: 9, extract: null },
        { rank: 7, title: "Seventh", views: 9, extract: null },
        { rank: 9, title: "Ninth", views: 9, extract: null },
      ]),
    );
    expect(tableRows(out).map((r) => r[0])).toEqual(["1", "2", "3", "4"]);
    const text = screenText(out, 0, NOW);
    expect(text).not.toMatch(/ [5679] (Sixth|Seventh|Ninth|Second)/);
  });

  it("shows n/a for views outside the range, and the position whatever the feed rank", () => {
    const out = compile120(
      withMostRead([{ rank: 5000, title: "Big", views: 1e12, extract: null }]),
    );
    expect(tableRows(out)[0]).toEqual(["1", "Big", "n/a"]);
    expect(pageProblems(out)).toEqual([]);
    expect(cloneSnapshot().version).toBe(1);
  });
});
