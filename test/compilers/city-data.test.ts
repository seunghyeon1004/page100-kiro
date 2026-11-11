import { describe, expect, it } from "vitest";
import {
  CITY_LIST,
  OUTLOOK_IDS,
  REGION_LIST,
  SERIES_CODES,
  cityName,
} from "../../src/compilers/city-data.js";
import { CITIES, OUTLOOK_CITY_IDS, REGIONS } from "../../src/sources/cities.js";
import { SERIES_SYMBOLS } from "../../src/sources/source-requests.js";

// The lists in src/compilers are written out there because compilers may import src/sources for
// types only (rule-compilers 1.2). These tests keep them equal to the sources' own lists.

describe("compiler lists equal the source lists", () => {
  it("has the same cities in the same order, with the same names and regions", () => {
    expect(CITY_LIST).toEqual(CITIES.map((c) => ({ id: c.id, name: c.name, region: c.region })));
  });

  it("has the same regions, names and city ids", () => {
    expect(REGION_LIST).toEqual(
      REGIONS.map((r) => ({ id: r.id, name: r.name, cityIds: r.cityIds })),
    );
    expect(REGION_LIST.every((r) => r.cityIds.length === 6)).toBe(true);
  });

  it("has the same outlook cities and series currencies", () => {
    expect(OUTLOOK_IDS).toEqual(OUTLOOK_CITY_IDS);
    expect(SERIES_CODES).toEqual([...SERIES_SYMBOLS]);
  });

  it("falls back to the id for an unknown city", () => {
    expect(cityName("london")).toBe("London");
    expect(cityName("atlantis")).toBe("atlantis");
  });
});
