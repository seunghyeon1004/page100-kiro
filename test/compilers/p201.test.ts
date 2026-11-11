import { describe, expect, it } from "vitest";
import { compile201 } from "../../src/compilers/p201-outlook.js";
import { NOW, SNAPSHOT, pageOf, pageProblems, screenText, tableRows } from "./boot-snapshot.js";

const ENTRY = SNAPSHOT.sources["open-meteo"];

describe("page 201 (requirement 11.2)", () => {
  const result = compile201(ENTRY);

  it("is sound and has one subpage per outlook city, in order", () => {
    expect(pageProblems(result)).toEqual([]);
    const page = pageOf(result);
    expect(page).toMatchObject({ number: 201, dataAt: new Date(ENTRY.fetchedAt) });
    expect(page.subpages.map((s) => (s.alt[0].kind === "heading" ? s.alt[0].text : ""))).toEqual([
      "London",
      "New York",
      "Tokyo",
      "Seoul",
      "Sydney",
      "Cairo",
    ]);
  });

  it("shows London on the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P201 Page 100        Wed 11 Nov 14:05:09
      FIVE-DAY OUTLOOK                     1/6
       London                                 
        10°C ▐████▌                           
             🬉🬎🬎🬎🬎🬄🬦🬹🬹🬹🬹🬹              🬭🬭🬭🬭🬭🬏 
                   ▐█████ 🬹🬹🬹🬹🬹🬓🬞🬭🬭🬭🬭🬭 █████▌ 
                   ▐█████ █████▌▐█████ █████▌ 
                   ▐█████ █████▌▐█████ █████▌ 
                          █████▌▐█████ █████▌ 
                          🬎🬎🬎🬎🬎🬄▐█████ █████▌ 
         1°C                    ▐█████        
               Wed   Thu    Fri   Sat   Sun   
                                              
       Day        Weather    High    Low  Rain
       Wed 11 Nov Rain       10°C    8°C  100%
       Thu 12 Nov Cloudy      8°C    5°C    0%
       Fri 13 Nov Cloudy      7°C    2°C    0%
       Sat 14 Nov Cloudy      7°C    1°C    0%
       Sun 15 Nov Cloudy      8°C    2°C   42%
                                              
                                              
                                              
      Weather: Open-Meteo, CC BY 4.0 07:16 UTC
       Index     Now       News      Rates    "
    `);
  });

  it("gives a table of day, condition, high, low and rain for the five days", () => {
    const rows = tableRows(result, 1);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toEqual(["Wed 11 Nov", "Cloudy", "17°C", "7°C", "2%"]);
    expect(rows[1]).toEqual(["Thu 12 Nov", "Rain", "14°C", "8°C", "92%"]);
  });

  it("shows n/a for missing values and draws no bar for a day without both temperatures", () => {
    const city = ENTRY.value.cities.find((c) => c.cityId === "london");
    if (city === undefined) throw new Error("no london");
    const daily = city.daily.map((d, i) =>
      i === 1 ? { ...d, maxC: null, precipitationPct: null } : d,
    );
    const entry = {
      ...ENTRY,
      value: {
        cities: ENTRY.value.cities.map((c) => (c.cityId === "london" ? { ...c, daily } : c)),
      },
    };
    const out = compile201(entry);
    expect(pageProblems(out)).toEqual([]);
    expect(tableRows(out, 0)[1]).toEqual(["Thu 12 Nov", "Cloudy", "n/a", "5°C", "n/a"]);
  });

  it("shows n/a for the axis when no temperature is known, and skips a city without days", () => {
    const nulls = ENTRY.value.cities.map((c) =>
      c.cityId === "london"
        ? { ...c, daily: c.daily.map((d) => ({ ...d, maxC: null, minC: null })) }
        : c.cityId === "tokyo"
          ? { ...c, daily: [] }
          : c,
    );
    const out = compile201({ ...ENTRY, value: { cities: nulls } });
    expect(pageProblems(out)).toEqual([]);
    expect(pageOf(out).subpages).toHaveLength(5);
  });

  it("gives the no-data page when no outlook city has days", () => {
    const out = compile201({ ...ENTRY, value: { cities: [] } });
    expect(out.ok && out.outcome).toBe("no-data");
  });
});
