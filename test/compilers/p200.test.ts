import { describe, expect, it } from "vitest";
import { compile200 } from "../../src/compilers/p200-weather-now.js";
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

const ENTRY = SNAPSHOT.sources["open-meteo"];

describe("page 200 (requirement 11.1)", () => {
  const result = compile200(ENTRY);

  it("is sound and has four subpages in region order", () => {
    expect(pageProblems(result)).toEqual([]);
    const page = pageOf(result);
    expect(page).toMatchObject({ number: 200, dataAt: new Date(ENTRY.fetchedAt), editor: "rules" });
    expect(page.subpages).toHaveLength(4);
    const regions = page.subpages.map((s) => s.alt[0]);
    expect(regions.map((b) => (b.kind === "heading" ? b.text : ""))).toEqual([
      "Europe",
      "Americas",
      "Asia-Pacific",
      "Africa and Middle East",
    ]);
  });

  it("shows Europe on the screen", () => {
    expect(screenText(result, 0, NOW)).toMatchInlineSnapshot(`
      "P200 Page 100        Wed 11 Nov 14:05:09
      WORLD WEATHER NOW                    1/4
       Europe                                 
           City                Temp      Wind 
       🬍🬎🬌 London               8°C   13 km/h 
       🬗🬗🬗 Rain                               
                                              
       🬞🬹🬏 Paris               12°C    6 km/h 
       🬎🬎🬎 Cloudy                             
                                              
       🬞🬹🬏 Berlin               2°C   12 km/h 
       🬎🬎🬎 Cloudy                             
                                              
       🬍🬎🬌 Madrid              14°C    5 km/h 
       🬗🬗🬗 Rain                               
                                              
       🬞🬹🬏 Rome                17°C    4 km/h 
       🬎🬎🬎 Cloudy                             
                                              
       🬞🬹🬏 Stockholm            6°C    9 km/h 
       🬎🬎🬎 Cloudy                             
                                              
      Weather: Open-Meteo, CC BY 4.0 07:16 UTC
       Index     Outlook   News      Rates    "
    `);
  });

  it("shows Asia-Pacific on the screen", () => {
    expect(screenText(result, 2, NOW)).toMatchInlineSnapshot(`
      "P200 Page 100        Wed 11 Nov 14:05:09
      WORLD WEATHER NOW                    3/4
       Asia-Pacific                           
           City                Temp      Wind 
       🬵█🬱 Tokyo               15°C    1 km/h 
       🬊█🬆 Clear                              
                                              
       🬵█🬱 Seoul               13°C    5 km/h 
       🬊█🬆 Clear                              
                                              
       🬵█🬱 Beijing             11°C    4 km/h 
       🬊█🬆 Clear                              
                                              
       🬍🬎🬌 Singapore           26°C    3 km/h 
       🬗🬗🬗 Rain                               
                                              
       🬵█🬱 Mumbai              35°C    3 km/h 
       🬊█🬆 Clear                              
                                              
       🬵█🬱 Sydney              25°C   11 km/h 
       🬊█🬆 Clear                              
                                              
      Weather: Open-Meteo, CC BY 4.0 07:16 UTC
       Index     Outlook   News      Rates    "
    `);
  });

  it("gives an alternative table with the same values, six cities in CITIES order", () => {
    const rows = tableRows(result, 1);
    expect(rows.map((r) => r[0])).toEqual([
      "New York",
      "Los Angeles",
      "Toronto",
      "Mexico City",
      "Sao Paulo",
      "Buenos Aires",
    ]);
    expect(rows[0]).toEqual(["New York", "Clear", "10°C", "10 km/h"]);
    const europe = plainOf(markupOf(result, 0));
    expect(europe).toContain("London");
    expect(europe).toContain("8°C");
  });

  it("shows n/a, and no symbol, for missing values and an unknown weather code", () => {
    const first = ENTRY.value.cities[0];
    if (first === undefined) throw new Error("fixture has no city");
    const entry = {
      ...ENTRY,
      value: {
        cities: [
          { ...first, temperatureC: null, windKmh: null, weatherCode: 1234 },
          ...ENTRY.value.cities.slice(1),
        ],
      },
    };
    const out = compile200(entry);
    expect(pageProblems(out)).toEqual([]);
    expect(tableRows(out, 0)[0]).toEqual(["London", "n/a", "n/a", "n/a"]);
    expect(plainOf(markupOf(out, 0)).split("\n")[2]).toBe(
      "     London               n/a       n/a",
    );
  });

  it("leaves out a region without data, and gives the no-data page when none has any", () => {
    const some = compile200({ ...ENTRY, value: { cities: ENTRY.value.cities.slice(0, 6) } });
    expect(pageOf(some).subpages).toHaveLength(1);
    const none = compile200({ ...ENTRY, value: { cities: [] } });
    expect(none.ok && none.outcome).toBe("no-data");
    expect(pageProblems(none)).toEqual([]);
  });
});
