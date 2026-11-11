import type { CityId, RegionId } from "../sources/cities.js";

// The cities, regions and currencies that the weather and rates pages list. `src/compilers` may
// import `src/sources` for types only (rule-compilers requirement 1.2), so these lists are written
// here with their types taken from `src/sources`; `test/compilers/city-data.test.ts` checks them
// against `CITIES`, `REGIONS`, `OUTLOOK_CITY_IDS` and `SERIES_SYMBOLS`, so a change there that is
// not made here fails a test.

export interface CityInfo {
  readonly id: CityId;
  readonly name: string;
  readonly region: RegionId;
}

export const CITY_LIST: readonly CityInfo[] = Object.freeze([
  { id: "london", name: "London", region: "europe" },
  { id: "paris", name: "Paris", region: "europe" },
  { id: "berlin", name: "Berlin", region: "europe" },
  { id: "madrid", name: "Madrid", region: "europe" },
  { id: "rome", name: "Rome", region: "europe" },
  { id: "stockholm", name: "Stockholm", region: "europe" },
  { id: "new-york", name: "New York", region: "americas" },
  { id: "los-angeles", name: "Los Angeles", region: "americas" },
  { id: "toronto", name: "Toronto", region: "americas" },
  { id: "mexico-city", name: "Mexico City", region: "americas" },
  { id: "sao-paulo", name: "Sao Paulo", region: "americas" },
  { id: "buenos-aires", name: "Buenos Aires", region: "americas" },
  { id: "tokyo", name: "Tokyo", region: "asia-pacific" },
  { id: "seoul", name: "Seoul", region: "asia-pacific" },
  { id: "beijing", name: "Beijing", region: "asia-pacific" },
  { id: "singapore", name: "Singapore", region: "asia-pacific" },
  { id: "mumbai", name: "Mumbai", region: "asia-pacific" },
  { id: "sydney", name: "Sydney", region: "asia-pacific" },
  { id: "cairo", name: "Cairo", region: "africa-middle-east" },
  { id: "lagos", name: "Lagos", region: "africa-middle-east" },
  { id: "nairobi", name: "Nairobi", region: "africa-middle-east" },
  { id: "johannesburg", name: "Johannesburg", region: "africa-middle-east" },
  { id: "dubai", name: "Dubai", region: "africa-middle-east" },
  { id: "istanbul", name: "Istanbul", region: "africa-middle-east" },
]);

export interface RegionInfo {
  readonly id: RegionId;
  readonly name: string;
  readonly cityIds: readonly CityId[];
}

const REGION_NAMES: readonly (readonly [RegionId, string])[] = [
  ["europe", "Europe"],
  ["americas", "Americas"],
  ["asia-pacific", "Asia-Pacific"],
  ["africa-middle-east", "Africa and Middle East"],
];

/** The four regions, six cities each, in `CITY_LIST` order. */
export const REGION_LIST: readonly RegionInfo[] = Object.freeze(
  REGION_NAMES.map(([id, name]) =>
    Object.freeze({ id, name, cityIds: CITY_LIST.filter((c) => c.region === id).map((c) => c.id) }),
  ),
);

/** The cities with a subpage on page 201. */
export const OUTLOOK_IDS: readonly CityId[] = Object.freeze([
  "london",
  "new-york",
  "tokyo",
  "seoul",
  "sydney",
  "cairo",
] as const);

/** The six currencies with a 30-day series, in page order. */
export const SERIES_CODES: readonly string[] = Object.freeze([
  "EUR",
  "GBP",
  "JPY",
  "KRW",
  "CNY",
  "INR",
]);

/** The display name of a city, or its id when it has none. */
export function cityName(id: string): string {
  return CITY_LIST.find((c) => c.id === id)?.name ?? id;
}
