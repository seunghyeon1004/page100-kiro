/** The seven data sources, in the order of the sources.md table (requirement 11.1). */
export const SOURCE_IDS = [
  "wikimedia-feed",
  "wikimedia-onthisday",
  "open-meteo",
  "frankfurter",
  "hacker-news",
  "usgs",
  "launch-library",
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];
