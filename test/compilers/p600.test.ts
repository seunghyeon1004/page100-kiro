import { describe, expect, it } from "vitest";
import { compile600 } from "../../src/compilers/p600-earthquakes.js";
import {
  NOW,
  SNAPSHOT,
  markupOf,
  pageOf,
  pageProblems,
  plainOf,
  screenText,
  tableRows,
} from "./boot-snapshot.js";

const ENTRY = SNAPSHOT.sources.usgs;

const quake = (
  i: number,
  place: string | null,
  magnitude: number | null = 5.1,
  depthKm: number | null = 10,
) => ({
  id: `q${String(i)}`,
  magnitude,
  place,
  time: "2026-11-11T06:21:45.383Z",
  depthKm,
  latitude: 1,
  longitude: 2,
});

function withQuakes(quakes: ReturnType<typeof quake>[]) {
  return { ...ENTRY, value: { ...ENTRY.value, quakes } };
}

describe("page 600 (requirement 15.1)", () => {
  const result = compile600(ENTRY);

  it("is sound and takes the fetch time", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({
      number: 600,
      dataAt: new Date(ENTRY.fetchedAt),
      editor: "rules",
    });
  });

  it("shows the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P600 Page 100        Wed 11 Nov 14:05:09
      EARTHQUAKES M4.5+, LAST 24 HOURS        
       UTC   Mag      Depth Place             
       06:21 M5.1     10 km Balleny Islands   
                            region            
       05:26 M5.0     30 km 152 km SE of      
                            Kuril'sk, Russia  
       03:56 M4.6     10 km 130 km ENE of     
                            Hasaki, Japan     
       01:45 M4.7     10 km 130 km W of       
                            Tofino, Canada    
       19:54 M4.9     12 km 207 km NW of Port-
                            Olry, Vanuatu     
       17:36 M5.2    124 km 21 km WNW of      
                            Popondetta...     
       17:36 M5.2     10 km Mid-Indian Ridge  
       15:52 M4.8     48 km 20 km SSW of Lata,
                            Solomon Islands   
       15:51 M5.2     10 km 140 km ESE of     
                            Labuha, Indonesia 
                                              
       Showing 9 of 14.                       
      USGS, public domain            07:16 UTC
       Index     Moon      Launches  Article  "
    `);
  });

  it("gives a table of the shown quakes in source order", () => {
    const rows = tableRows(result);
    // Fourteen quakes are listed; nine whole items fit rows 1 to 18.
    expect(rows).toHaveLength(9);
    expect(rows[0]).toEqual(["06:21", "M5.1", "10 km", "Balleny Islands region"]);
    expect(rows[1]).toEqual(["05:26", "M5.0", "30 km", "152 km SE of Kuril'sk, Russia"]);
  });

  it("says that no earthquakes are listed for an empty list, as a compiled page", () => {
    const out = compile600(withQuakes([]));
    expect(out.ok && out.outcome).toBe("compiled");
    expect(plainOf(markupOf(out))).toBe("\n No earthquakes are listed for this\n period.\n");
    expect(pageProblems(out)).toEqual([]);
    expect(pageOf(out).subpages[0].alt).toEqual([
      { kind: "paragraph", text: "No earthquakes are listed for this period." },
    ]);
  });

  it("shows n/a for a missing place, magnitude and depth", () => {
    const out = compile600(withQuakes([quake(1, null, null, null)]));
    expect(tableRows(out)).toEqual([["06:21", "n/a", "n/a", "n/a"]]);
    expect(pageProblems(out)).toEqual([]);
  });

  it("drops a quake whose place does not fold or has a word wider than 18 cells", () => {
    const out = compile600(
      withQuakes([quake(1, "Bad \u2603"), quake(2, "w".repeat(19)), quake(3, "Kept place")]),
    );
    expect(tableRows(out)).toEqual([["06:21", "M5.1", "10 km", "Kept place"]]);
  });

  it("ends the list at the first item that does not fit and says how many are shown", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      quake(i, "A place with a long name for two rows"),
    );
    const out = compile600(withQuakes(many));
    expect(pageProblems(out)).toEqual([]);
    expect(tableRows(out)).toHaveLength(9);
    const text = plainOf(markupOf(out));
    expect(text.split("\n")[19]).toBe(" Showing 9 of 12.");
  });

  it("gives the no-data page when no quake survives folding and fitting", () => {
    const out = compile600(withQuakes([quake(1, "Bad \u2603")]));
    expect(out.ok && out.outcome).toBe("no-data");
    expect(pageProblems(out)).toEqual([]);
  });
});
