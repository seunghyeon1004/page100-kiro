import { describe, expect, it } from "vitest";
import { CITIES, OUTLOOK_CITY_IDS, REGIONS } from "../../src/sources/cities.js";
import {
  SERIES_SYMBOLS,
  hnItemUrl,
  selectItemIds,
  sourceRequests,
} from "../../src/sources/source-requests.js";
import { SOURCE_IDS } from "../../src/sources/source-id.js";

const NOW = new Date("2026-11-11T14:05:09.999Z");

// Written out by hand from design.md, "Cities", so that a typo in either place shows up.
const LATITUDES =
  "51.51,48.86,52.52,40.42,41.89,59.33," +
  "40.71,34.05,43.65,19.43,-23.55,-34.60," +
  "35.68,37.57,39.90,1.35,19.08,-33.87," +
  "30.04,6.52,-1.29,-26.20,25.20,41.01";
const LONGITUDES =
  "-0.13,2.35,13.41,-3.70,12.48,18.07," +
  "-74.01,-118.24,-79.38,-99.13,-46.63,-58.38," +
  "139.69,126.98,116.41,103.82,72.88,151.21," +
  "31.24,3.38,36.82,28.05,55.27,28.98";

describe("sourceRequests (requirement 11.2)", () => {
  it("lists the two featured days for 2026-11-11", () => {
    expect(sourceRequests("wikimedia-feed", NOW)).toEqual([
      {
        name: "featured-today",
        url: "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/11",
        query: {},
      },
      {
        name: "featured-yesterday",
        url: "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/10",
        query: {},
      },
    ]);
  });

  it("lists the on this day request for 11/11", () => {
    expect(sourceRequests("wikimedia-onthisday", NOW)).toEqual([
      {
        name: "onthisday",
        url: "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/11/11",
        query: {},
      },
    ]);
  });

  it("lists one Open-Meteo request with 24 coordinates in CITIES order", () => {
    const expectedUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDES}&longitude=${LONGITUDES}` +
      "&current=temperature_2m,weather_code,wind_speed_10m" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=auto&forecast_days=5";
    expect(sourceRequests("open-meteo", NOW)).toEqual([
      {
        name: "forecast",
        url: expectedUrl,
        query: {
          latitude: LATITUDES,
          longitude: LONGITUDES,
          current: "temperature_2m,weather_code,wind_speed_10m",
          daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
          timezone: "auto",
          forecast_days: "5",
        },
      },
    ]);
  });

  it("lists the Frankfurter latest and 30-day series requests", () => {
    expect(sourceRequests("frankfurter", NOW)).toEqual([
      {
        name: "latest",
        url: "https://api.frankfurter.dev/v1/latest?base=USD",
        query: { base: "USD" },
      },
      {
        name: "series",
        url: "https://api.frankfurter.dev/v1/2026-10-12..?base=USD&symbols=EUR,GBP,JPY,KRW,CNY,INR",
        query: { base: "USD", symbols: "EUR,GBP,JPY,KRW,CNY,INR" },
      },
    ]);
    expect(SERIES_SYMBOLS).toEqual(["EUR", "GBP", "JPY", "KRW", "CNY", "INR"]);
  });

  it("lists the three Hacker News id lists", () => {
    expect(sourceRequests("hacker-news", NOW)).toEqual([
      {
        name: "topstories",
        url: "https://hacker-news.firebaseio.com/v0/topstories.json",
        query: {},
      },
      {
        name: "showstories",
        url: "https://hacker-news.firebaseio.com/v0/showstories.json",
        query: {},
      },
      {
        name: "askstories",
        url: "https://hacker-news.firebaseio.com/v0/askstories.json",
        query: {},
      },
    ]);
  });

  it("lists the USGS and Launch Library requests", () => {
    expect(sourceRequests("usgs", NOW)).toEqual([
      {
        name: "quakes",
        url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
        query: {},
      },
    ]);
    expect(sourceRequests("launch-library", NOW)).toEqual([
      {
        name: "launches",
        url: "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=8&mode=list",
        query: { limit: "8", mode: "list" },
      },
    ]);
  });

  it("uses 2025-12-31 as yesterday when D is 2026-01-01", () => {
    const jan1 = new Date("2026-01-01T00:00:00.000Z");
    expect(sourceRequests("wikimedia-feed", jan1).map((r) => r.url)).toEqual([
      "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/01/01",
      "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2025/12/31",
    ]);
  });

  it("starts the series on 2028-02-29 when D is 2028-03-30 (leap year)", () => {
    const leap = new Date("2028-03-30T23:59:59.999Z");
    const series = sourceRequests("frankfurter", leap)[1];
    expect(series?.url).toBe(
      "https://api.frankfurter.dev/v1/2028-02-29..?base=USD&symbols=EUR,GBP,JPY,KRW,CNY,INR",
    );
  });

  it("uses the UTC date, not a local one, near midnight", () => {
    const late = new Date("2026-11-11T23:59:59.999Z");
    expect(sourceRequests("wikimedia-onthisday", late)[0]?.url.endsWith("/11/11")).toBe(true);
    const early = new Date("2026-11-12T00:00:00.000Z");
    expect(sourceRequests("wikimedia-onthisday", early)[0]?.url.endsWith("/11/12")).toBe(true);
  });

  it("gives at least one request for every source", () => {
    for (const source of SOURCE_IDS) {
      expect(sourceRequests(source, NOW).length, source).toBeGreaterThan(0);
    }
  });
});

describe("hnItemUrl and selectItemIds (requirements 11.2 and 13.4)", () => {
  it("builds the item URL", () => {
    expect(hnItemUrl(8863)).toBe("https://hacker-news.firebaseio.com/v0/item/8863.json");
  });

  it("takes the first 12 of each list, each id once, in order top, show, ask", () => {
    const range = (from: number, n: number): number[] =>
      Array.from({ length: n }, (_, i) => from + i);
    const top = range(1, 20);
    const show = [3, 4, ...range(100, 20)];
    const ask = [100, 5, ...range(200, 20)];
    const chosen = selectItemIds({ top, show, ask });
    expect(chosen).toEqual([
      ...range(1, 12),
      ...[100, 101, 102, 103, 104, 105, 106, 107, 108, 109],
      200,
      201,
      202,
      203,
      204,
      205,
      206,
      207,
      208,
      209,
    ]);
    expect(new Set(chosen).size).toBe(chosen.length);
  });

  it("handles empty lists", () => {
    expect(selectItemIds({ top: [], show: [], ask: [] })).toEqual([]);
  });
});

describe("cities (requirement 11.3)", () => {
  it("has 24 cities with unique ids, in four regions of six", () => {
    expect(CITIES).toHaveLength(24);
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(24);
    expect(REGIONS).toHaveLength(4);
    for (const region of REGIONS) expect(region.cityIds, region.name).toHaveLength(6);
    expect(REGIONS.map((r) => r.name)).toEqual([
      "Europe",
      "Americas",
      "Asia-Pacific",
      "Africa and Middle East",
    ]);
  });

  it("lists the cities region by region in the design order", () => {
    expect(CITIES.map((c) => c.id)).toEqual([
      "london",
      "paris",
      "berlin",
      "madrid",
      "rome",
      "stockholm",
      "new-york",
      "los-angeles",
      "toronto",
      "mexico-city",
      "sao-paulo",
      "buenos-aires",
      "tokyo",
      "seoul",
      "beijing",
      "singapore",
      "mumbai",
      "sydney",
      "cairo",
      "lagos",
      "nairobi",
      "johannesburg",
      "dubai",
      "istanbul",
    ]);
    expect(REGIONS.flatMap((r) => r.cityIds)).toEqual(CITIES.map((c) => c.id));
  });

  it("has the six outlook cities", () => {
    expect(OUTLOOK_CITY_IDS).toEqual(["london", "new-york", "tokyo", "seoul", "sydney", "cairo"]);
    for (const id of OUTLOOK_CITY_IDS) expect(CITIES.some((c) => c.id === id)).toBe(true);
  });

  it("is frozen", () => {
    expect(Object.isFrozen(CITIES)).toBe(true);
    expect(Object.isFrozen(REGIONS)).toBe(true);
    expect(Object.isFrozen(OUTLOOK_CITY_IDS)).toBe(true);
  });
});
