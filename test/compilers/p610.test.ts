import { describe, expect, it } from "vitest";
import { compile610 } from "../../src/compilers/p610-launches.js";
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

const ENTRY = SNAPSHOT.sources["launch-library"];

const launch = (i: number, rocket: string | null, mission: string, status: string | null) => ({
  id: `l${String(i)}`,
  rocket,
  mission,
  net: "2026-11-12T02:35:00.000Z",
  status,
});

function withLaunches(launches: ReturnType<typeof launch>[]) {
  return { ...ENTRY, value: { launches } };
}

describe("page 610 (requirement 15.3)", () => {
  const result = compile610(ENTRY);

  it("is sound and takes the fetch time", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({
      number: 610,
      dataAt: new Date(ENTRY.fetchedAt),
      editor: "rules",
    });
  });

  it("shows the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P610 Page 100        Wed 11 Nov 14:05:09
      UPCOMING ROCKET LAUNCHES                
       Wed 11 Nov 11:40 UTC Go                
       Unknown Payload                        
       Long March 2D                          
                                              
       Thu 12 Nov 02:35 UTC Go                
       USSF-627                               
       Falcon 9 Block 5                       
                                              
       Thu 12 Nov 19:50 UTC Go                
       Unknown Payload                        
       Kuaizhou 11                            
                                              
       Fri 13 Nov 05:00 UTC Go                
       Demo Flight                            
       Mir                                    
                                              
       Fri 13 Nov 17:54 UTC Go                
       Amazon Leo (LV-01)                     
       Vulcan VC6L                            
                                              
      Launch Library 2               07:16 UTC
       Index     Quakes    Moon      Article  "
    `);
  });

  it("gives a table with date, time UTC, status, mission and rocket", () => {
    const rows = tableRows(result);
    expect(rows[0]).toEqual(["Wed 11 Nov", "11:40 UTC", "Go", "Unknown Payload", "Long March 2D"]);
    expect(rows[1]?.slice(0, 4)).toEqual(["Thu 12 Nov", "02:35 UTC", "Go", "USSF-627"]);
  });

  it("leaves out a missing status or rocket, and shows n/a for it in the table", () => {
    const out = compile610(withLaunches([launch(1, null, "Mission A", null)]));
    expect(plainOf(markupOf(out))).toBe(" Thu 12 Nov 02:35 UTC\n Mission A\n");
    expect(tableRows(out)).toEqual([["Thu 12 Nov", "02:35 UTC", "n/a", "Mission A", "n/a"]]);
  });

  it("drops a launch whose mission does not fold or does not wrap into 2 rows of 38", () => {
    const out = compile610(
      withLaunches([
        launch(1, "R", "Bad \u2603", "Go"),
        launch(2, "R", "x".repeat(39), "Go"),
        launch(3, "R", "Kept", "Go"),
      ]),
    );
    expect(tableRows(out)).toHaveLength(1);
    expect(tableRows(out)[0]?.[3]).toBe("Kept");
  });

  it("ends the list at the first launch that does not fit, with a blank row between launches", () => {
    const many = Array.from({ length: 10 }, (_, i) => launch(i, "Rocket", "Mission", "Go"));
    const out = compile610(withLaunches(many));
    expect(pageProblems(out)).toEqual([]);
    // Three rows each and one blank row between: 5 launches take 19 rows, a sixth would need 23.
    expect(tableRows(out)).toHaveLength(5);
    const rows = plainOf(markupOf(out)).split("\n");
    expect(rows[3]).toBe("");
    expect(rows[4]).toContain("Thu 12 Nov");
  });

  it("gives the no-data page for no launches", () => {
    const out = compile610(withLaunches([]));
    expect(out.ok && out.outcome).toBe("no-data");
    expect(pageProblems(out)).toEqual([]);
  });
});
