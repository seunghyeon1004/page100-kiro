/** The 24 cities of pages 200 and 201, in the order of design.md, "Cities". Open-Meteo results are matched by position. */
export const CITIES = Object.freeze([
  // Europe
  { id: "london", name: "London", region: "europe", latitude: 51.51, longitude: -0.13 },
  { id: "paris", name: "Paris", region: "europe", latitude: 48.86, longitude: 2.35 },
  { id: "berlin", name: "Berlin", region: "europe", latitude: 52.52, longitude: 13.41 },
  { id: "madrid", name: "Madrid", region: "europe", latitude: 40.42, longitude: -3.7 },
  { id: "rome", name: "Rome", region: "europe", latitude: 41.89, longitude: 12.48 },
  { id: "stockholm", name: "Stockholm", region: "europe", latitude: 59.33, longitude: 18.07 },
  // Americas
  { id: "new-york", name: "New York", region: "americas", latitude: 40.71, longitude: -74.01 },
  {
    id: "los-angeles",
    name: "Los Angeles",
    region: "americas",
    latitude: 34.05,
    longitude: -118.24,
  },
  { id: "toronto", name: "Toronto", region: "americas", latitude: 43.65, longitude: -79.38 },
  {
    id: "mexico-city",
    name: "Mexico City",
    region: "americas",
    latitude: 19.43,
    longitude: -99.13,
  },
  { id: "sao-paulo", name: "Sao Paulo", region: "americas", latitude: -23.55, longitude: -46.63 },
  {
    id: "buenos-aires",
    name: "Buenos Aires",
    region: "americas",
    latitude: -34.6,
    longitude: -58.38,
  },
  // Asia-Pacific
  { id: "tokyo", name: "Tokyo", region: "asia-pacific", latitude: 35.68, longitude: 139.69 },
  { id: "seoul", name: "Seoul", region: "asia-pacific", latitude: 37.57, longitude: 126.98 },
  { id: "beijing", name: "Beijing", region: "asia-pacific", latitude: 39.9, longitude: 116.41 },
  { id: "singapore", name: "Singapore", region: "asia-pacific", latitude: 1.35, longitude: 103.82 },
  { id: "mumbai", name: "Mumbai", region: "asia-pacific", latitude: 19.08, longitude: 72.88 },
  { id: "sydney", name: "Sydney", region: "asia-pacific", latitude: -33.87, longitude: 151.21 },
  // Africa and Middle East
  { id: "cairo", name: "Cairo", region: "africa-middle-east", latitude: 30.04, longitude: 31.24 },
  { id: "lagos", name: "Lagos", region: "africa-middle-east", latitude: 6.52, longitude: 3.38 },
  {
    id: "nairobi",
    name: "Nairobi",
    region: "africa-middle-east",
    latitude: -1.29,
    longitude: 36.82,
  },
  {
    id: "johannesburg",
    name: "Johannesburg",
    region: "africa-middle-east",
    latitude: -26.2,
    longitude: 28.05,
  },
  { id: "dubai", name: "Dubai", region: "africa-middle-east", latitude: 25.2, longitude: 55.27 },
  {
    id: "istanbul",
    name: "Istanbul",
    region: "africa-middle-east",
    latitude: 41.01,
    longitude: 28.98,
  },
] as const);

export type City = (typeof CITIES)[number];
export type CityId = City["id"];
export type RegionId = City["region"];

export interface Region {
  readonly id: RegionId;
  readonly name: string;
  readonly cityIds: readonly CityId[];
}

const REGION_NAMES: Readonly<Record<RegionId, string>> = {
  europe: "Europe",
  americas: "Americas",
  "asia-pacific": "Asia-Pacific",
  "africa-middle-east": "Africa and Middle East",
};

/** The four regions, six cities each, in `CITIES` order. */
export const REGIONS: readonly Region[] = Object.freeze(
  (Object.keys(REGION_NAMES) as RegionId[]).map((id) =>
    Object.freeze({
      id,
      name: REGION_NAMES[id],
      cityIds: Object.freeze(CITIES.filter((c) => c.region === id).map((c) => c.id)),
    }),
  ),
);

/** The cities with a five-day outlook subpage on page 201. */
export const OUTLOOK_CITY_IDS: readonly CityId[] = Object.freeze([
  "london",
  "new-york",
  "tokyo",
  "seoul",
  "sydney",
  "cairo",
] as const);
