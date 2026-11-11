import { describe, expect, it } from "vitest";
import { compile802 } from "../../src/compilers/p802-service-status.js";
import type { ServiceStatus } from "../../src/compilers/service-status.js";
import { REGISTRY } from "../../src/pages/registry.js";
import { NOW, markupOf, plainOf, pageOf, pageProblems, screenText } from "./boot-snapshot.js";

const STATUS: ServiceStatus = {
  aiEditor: true,
  modelCalls: { used: 12, cap: 300 },
  drafts: { accepted: 9, rejected: 3 },
  pages: REGISTRY.map((def, i) => ({
    number: def.number,
    compiledAt: new Date(Date.UTC(2026, 10, 11, 13, i)),
    editor: def.editor,
  })),
};

describe("page 802 (requirement 16.2)", () => {
  const result = compile802(STATUS, NOW);

  it("is sound, has dataAt now and the rules editor", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({ number: 802, dataAt: NOW, editor: "rules" });
  });

  it("shows the screen", () => {
    expect(screenText(result)).toMatchInlineSnapshot(`
      "P802 Page 100        Wed 11 Nov 14:05:09
      SERVICE STATUS                          
       AI editor: on                          
       Model calls today: 12 of 300           
       Drafts today, accepted: 9              
       Drafts today, rejected: 3              
       Page UTC   Editor   Page UTC   Editor  
       100  13:00 Rules    400  13:15 Rules   
       110  13:01 AI       401  13:16 Rules   
       111  13:02 AI       402  13:17 Rules   
       112  13:03 AI       500  13:18 AI      
       113  13:04 AI       501  13:19 AI      
       114  13:05 AI       550  13:20 Rules   
       115  13:06 AI       600  13:21 Rules   
       116  13:07 AI       601  13:22 Rules   
       117  13:08 AI       610  13:23 Rules   
       118  13:09 AI       666  13:24 Static  
       120  13:10 Rules    700  13:25 AI      
       200  13:11 Rules    800  13:26 Static  
       201  13:12 Rules    801  13:27 Static  
       300  13:13 Rules    802  13:28 Rules   
       301  13:14 Rules    899  13:29 Static  
      Computed by Page 100           14:05 UTC
       Index     Help      About     Test     "
    `);
  });

  it("lists all 30 registry pages in the alternative table", () => {
    const table = pageOf(result).subpages[0].alt.find((b) => b.kind === "table");
    expect(table?.kind === "table" && table.rows.length).toBe(REGISTRY.length);
    expect(table?.kind === "table" && table.rows[0]).toEqual(["100", "13:00", "Rules"]);
  });

  it("says off, n/a without an entry, and the last entry for a number wins", () => {
    const status: ServiceStatus = {
      ...STATUS,
      aiEditor: false,
      pages: [
        { number: 100, compiledAt: new Date(Date.UTC(2026, 10, 11, 1, 1)), editor: "rules" },
        { number: 100, compiledAt: new Date(Date.UTC(2026, 10, 11, 2, 2)), editor: "ai" },
        { number: 110, compiledAt: null, editor: "ai" },
      ],
    };
    const markup = plainOf(markupOf(compile802(status, NOW)));
    expect(markup.split("\n")[0]).toBe(" AI editor: off");
    expect(markup).toContain("100  02:02 AI");
    expect(markup).toContain("110  n/a   AI");
    expect(markup).toContain("111  n/a   n/a");
  });

  it("shows n/a for a counter that is out of range and widest values fit", () => {
    const widest: ServiceStatus = {
      ...STATUS,
      modelCalls: { used: 99_999, cap: 99_999 },
      drafts: { accepted: 99_999, rejected: 99_999 },
      pages: REGISTRY.map((def) => ({ number: def.number, compiledAt: NOW, editor: "static" })),
    };
    expect(pageProblems(compile802(widest, NOW))).toEqual([]);
    const over = markupOf(
      compile802({ ...STATUS, drafts: { accepted: 100_000, rejected: -1 } }, NOW),
    );
    expect(over).toContain("accepted: n/a");
    expect(over).toContain("rejected: n/a");
  });
});
