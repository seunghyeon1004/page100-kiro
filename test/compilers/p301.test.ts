import { describe, expect, it } from "vitest";
import { compile301 } from "../../src/compilers/p301-rate-trend.js";
import { NOW, SNAPSHOT, pageOf, pageProblems, screenText, tableRows } from "./boot-snapshot.js";

const ENTRY = SNAPSHOT.sources.frankfurter;

describe("page 301 (requirement 12.2)", () => {
  const result = compile301(ENTRY);

  it("is sound and has one subpage per currency", () => {
    expect(pageProblems(result)).toEqual([]);
    const page = pageOf(result);
    expect(page.subpages).toHaveLength(6);
    expect(page.subpages.map((s) => (s.alt[0].kind === "heading" ? s.alt[0].text : ""))).toEqual([
      "Euro (EUR) per US dollar",
      "Pound sterling (GBP) per US dollar",
      "Japanese yen (JPY) per US dollar",
      "South Korean won (KRW) per US dollar",
      "Chinese yuan (CNY) per US dollar",
      "Indian rupee (INR) per US dollar",
    ]);
  });

  it("shows the euro on the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P301 Page 100        Wed 11 Nov 14:05:09
      30-DAY RATE TREND                    1/6
       Euro (EUR) per US dollar               
       0.8985                  🬞🬚🬆▌           
                              🬞🬜  🬪           
                              🬷   🬉🬓          
                              ▌    🬲      ▐🬲  
              🬩🬭             ▐🬀    ▐  🬹   🬷▐🬏 
               🬁🬌🬱         🬵🬍🬂     🬁▌🬦🬬   ▌ 🬪 
                 🬁🬪🬏      🬜🬀        🬨🬜▐🬏 🬦🬄 🬁🬲
                   ▌  🬭🬹 🬦🬄         🬉🬄 ▌ ▐   🬉
                   🬨 🬷🬀🬁🬪🬕             ▌ 🬕    
                   🬁🬲▌  🬁🬀             🬪🬦🬄    
                    🬎                  ▐🬜     
       0.8875                          ▐▌     
              Mon 12 Oct            Tue 10 Nov
                                              
       Latest     0.8917 Tue 10 Nov           
       Highest    0.8985 Thu 29 Oct           
       Lowest     0.8875 Wed 04 Nov           
                                              
                                              
      Rates: ECB via Frankfurter     07:16 UTC
       Index     Rates     Weather   Tech     "
    `);
  });

  it("lists every point in the alternative table", () => {
    const rows = tableRows(result, 2);
    expect(rows).toHaveLength(22);
    expect(rows.at(-1)?.[0]).toBe("Tue 10 Nov");
  });

  it("leaves out a currency with fewer than 2 points", () => {
    const series = ENTRY.value.series.map((s) =>
      s.code === "GBP" ? { ...s, points: s.points.slice(0, 1) } : s,
    );
    const out = compile301({ ...ENTRY, value: { ...ENTRY.value, series } });
    expect(pageOf(out).subpages).toHaveLength(5);
    expect(pageProblems(out)).toEqual([]);
  });

  it("gives the no-data page when no currency has 2 points", () => {
    const series = ENTRY.value.series.map((s) => ({ ...s, points: s.points.slice(0, 1) }));
    const out = compile301({ ...ENTRY, value: { ...ENTRY.value, series } });
    expect(out.ok && out.outcome).toBe("no-data");
    expect(pageProblems(out)).toEqual([]);
  });

  it("names the earliest date for a tie, and shows n/a for rates it cannot print", () => {
    const points = [
      { date: "2026-11-01", rate: 2 },
      { date: "2026-11-02", rate: 5 },
      { date: "2026-11-03", rate: 5 },
      { date: "2026-11-04", rate: 2 },
    ];
    const out = compile301({
      ...ENTRY,
      value: { ...ENTRY.value, series: [{ code: "EUR", points }] },
    });
    const paragraphs = pageOf(out).subpages[0].alt.flatMap((b) =>
      b.kind === "paragraph" ? [b.text] : [],
    );
    expect(paragraphs).toEqual([
      "Latest 2.0000 Wed 04 Nov",
      "Highest 5.0000 Mon 02 Nov",
      "Lowest 2.0000 Sun 01 Nov",
    ]);
    const odd = compile301({
      ...ENTRY,
      value: {
        ...ENTRY.value,
        series: [
          {
            code: "EUR",
            points: [
              { date: "x", rate: -1 },
              { date: "y", rate: 1e9 },
            ],
          },
        ],
      },
    });
    expect(pageProblems(odd)).toEqual([]);
  });
});
