import { describe, expect, it } from "vitest";
import { compile601 } from "../../src/compilers/p601-moon.js";
import { NOW, markupOf, pageOf, pageProblems, plainOf, screenText } from "./boot-snapshot.js";

describe("page 601 (requirement 15.2)", () => {
  const result = compile601(NOW);

  it("is sound, computed, and dated now", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({ number: 601, dataAt: NOW, editor: "rules" });
    expect(result.ok && result.outcome).toBe("compiled");
  });

  it("shows the screen for 2026-11-11T14:05:09Z", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P601 Page 100        Wed 11 Nov 14:05:09
      THE MOON TONIGHT                        
       Waxing crescent                        
                                              
            🬀🬞   5% illuminated               
              🬃                               
              ▐  Next full moon               
              ▐  Tue 24 Nov 14:54 UTC         
              🬃  Next new moon                
            🬏🬁   Wed 09 Dec 00:53 UTC         
                                              
                                              
       Times are computed here and may differ 
       from published tables by a few minutes.
                                              
                                              
                                              
                                              
                                              
                                              
                                              
                                              
      Computed by Page 100           14:05 UTC
       Index     Quakes    Launches  Article  "
    `);
  });

  // The tables say 14:53 and 00:52: the page ignores the difference between dynamical and universal
  // time (about 69 seconds), as the design says, and prints "may differ ... by a few minutes".
  it("names the phase, the lit percentage and the next full and new moon in UTC", () => {
    const text = plainOf(markupOf(result));
    expect(text).toContain("Waxing crescent");
    expect(text).toContain("Next full moon");
    expect(text).toContain("Tue 24 Nov 14:54 UTC");
    expect(text).toContain("Wed 09 Dec 00:53 UTC");
    const alt = pageOf(result).subpages[0].alt;
    expect(alt[0]).toEqual({ kind: "heading", level: 2, text: "Waxing crescent" });
    expect(alt.map((b) => b.kind)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
  });

  it("gives the no-data page outside 1970 to 2100", () => {
    for (const t of [
      new Date("1969-12-31T00:00:00Z"),
      new Date("2101-01-01T00:00:00Z"),
      new Date(Number.NaN),
    ]) {
      const out = compile601(t);
      expect(out.ok && out.outcome).toBe("no-data");
    }
  });

  it("is sound at a full moon and at a new moon", () => {
    for (const t of ["2026-11-24T14:53:00Z", "2026-12-09T00:52:00Z", "2026-11-17T11:48:00Z"]) {
      const out = compile601(new Date(t));
      expect(pageProblems(out, new Date(t)), t).toEqual([]);
    }
  });
});
