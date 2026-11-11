import { describe, expect, it } from "vitest";
import { changeOnTheDay, compile300 } from "../../src/compilers/p300-rates.js";
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

const ENTRY = SNAPSHOT.sources.frankfurter;

describe("page 300 (requirement 12.1, owner answer 3)", () => {
  const result = compile300(ENTRY);

  it("is sound and takes the fetch time", () => {
    expect(pageProblems(result)).toEqual([]);
    expect(pageOf(result)).toMatchObject({
      number: 300,
      dataAt: new Date(ENTRY.fetchedAt),
      editor: "rules",
    });
  });

  it("shows the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P300 Page 100        Wed 11 Nov 14:05:09
      EXCHANGE RATES                          
       Rates per US dollar, 10 Nov 2026       
                                              
       Currency           Code   Rate   Change
       Euro               EUR  0.8917   -0.19%
       Pound sterling     GBP  0.7450   -0.05%
       Japanese yen       JPY  158.18   +0.15%
       South Korean won   KRW   1,339   -0.58%
       Chinese yuan       CNY  6.6703   -0.04%
       Indian rupee       INR   93.93    0.00%
                                              
       Other rates                            
       AUD  1.4485         MXN   18.55        
       CAD  1.4136         BRL  5.5517        
       CHF  0.8207         SGD  1.2783        
       SEK  9.8011         HKD  7.8449        
       NOK  9.4663         ZAR   16.40        
                                              
       Change is against the previous ECB     
       reference date in the series.          
                                              
      Rates: ECB via Frankfurter     07:16 UTC
       Index     Trend     Weather   Tech     "
    `);
  });

  it("lists the six series currencies in order, and the ten other rates", () => {
    expect(tableRows(result, 0, 0).map((r) => r[1])).toEqual([
      "EUR",
      "GBP",
      "JPY",
      "KRW",
      "CNY",
      "INR",
    ]);
    expect(tableRows(result, 0, 0)[0]).toEqual(["Euro", "EUR", "0.8917", "-0.19%"]);
    expect(tableRows(result, 0, 1).map((r) => r[1])).toEqual([
      "AUD",
      "CAD",
      "CHF",
      "SEK",
      "NOK",
      "MXN",
      "BRL",
      "SGD",
      "HKD",
      "ZAR",
    ]);
    expect(tableRows(result, 0, 1)[0]).toEqual(["Australian dollar", "AUD", "1.4485"]);
    expect(tableRows(result, 0, 1)[9]).toEqual(["South African rand", "ZAR", "16.40"]);
  });

  it("colours the change green for +, red for - and white for none", () => {
    const rows = markupOf(result).split("\n");
    expect(rows[3]).toContain("{r}-0.19%");
    expect(rows.some((r) => r.includes("{g}+"))).toBe(true);
  });
});

describe("changeOnTheDay (requirement 12.1)", () => {
  const rates = ENTRY.value;

  it("is latest over the last point dated before Rates.date, minus one, in percent", () => {
    const eur = rates.rates.find((r) => r.code === "EUR")?.rate ?? Number.NaN;
    const series = rates.series.find((s) => s.code === "EUR")?.points ?? [];
    const previous = series.filter((p) => p.date < rates.date).at(-1)?.rate ?? Number.NaN;
    expect(changeOnTheDay(rates, "EUR")).toBeCloseTo((eur / previous - 1) * 100, 12);
  });

  it("ignores points on or after Rates.date and gives null with none before it", () => {
    const only = {
      ...rates,
      date: "2026-11-10",
      series: [{ code: "EUR", points: [{ date: "2026-11-10", rate: 0.9 }] }],
    };
    expect(changeOnTheDay(only, "EUR")).toBeNull();
    const two = {
      ...rates,
      date: "2026-11-10",
      rates: [{ code: "EUR", rate: 1.1 }],
      series: [
        {
          code: "EUR",
          points: [
            { date: "2026-11-08", rate: 2 },
            { date: "2026-11-09", rate: 1 },
            { date: "2026-11-10", rate: 5 },
            { date: "2026-11-11", rate: 7 },
          ],
        },
      ],
    };
    expect(changeOnTheDay(two, "EUR")).toBeCloseTo(10, 10);
    expect(changeOnTheDay(two, "GBP")).toBeNull();
    expect(
      changeOnTheDay(
        { ...two, series: [{ code: "EUR", points: [{ date: "2026-11-09", rate: 0 }] }] },
        "EUR",
      ),
    ).toBeNull();
  });
});

describe("page 300: edge cases", () => {
  it("shows n/a for a currency without a rate and leaves out a missing other code", () => {
    const rates = {
      ...ENTRY.value,
      rates: ENTRY.value.rates.filter((r) => r.code !== "JPY" && r.code !== "AUD"),
    };
    const out = compile300({ ...ENTRY, value: rates });
    expect(pageProblems(out)).toEqual([]);
    expect(tableRows(out, 0, 0)[2]).toEqual(["Japanese yen", "JPY", "n/a", "n/a"]);
    expect(tableRows(out, 0, 1)[0]?.[1]).toBe("CAD");
    expect(plainOf(markupOf(out))).toContain("Other rates");
  });

  it("gives a zero change as 0.00% in white", () => {
    const rates = {
      ...ENTRY.value,
      date: "2026-11-10",
      rates: ENTRY.value.rates.map((r) => (r.code === "EUR" ? { ...r, rate: 0.5 } : r)),
      series: ENTRY.value.series.map((s) =>
        s.code === "EUR" ? { ...s, points: [{ date: "2026-11-09", rate: 0.5 }] } : s,
      ),
    };
    const out = compile300({ ...ENTRY, value: rates });
    expect(tableRows(out, 0, 0)[0]).toEqual(["Euro", "EUR", "0.5000", "0.00%"]);
  });

  it("gives the no-data page when no listed currency has a rate", () => {
    const out = compile300({
      ...ENTRY,
      value: { ...ENTRY.value, rates: [{ code: "CZK", rate: 20 }] },
    });
    expect(out.ok && out.outcome).toBe("no-data");
    expect(pageProblems(out)).toEqual([]);
  });
});
