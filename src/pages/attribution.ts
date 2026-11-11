import type { SourceId } from "../sources/source-id.js";

/**
 * Row 22 text for each source, exactly as in the last column of the sources.md table, plus the
 * computed pages (requirement 7.4). Each is at most 30 characters.
 */
export const ATTRIBUTION: Readonly<Record<SourceId | "computed", string>> = Object.freeze({
  "wikimedia-feed": "Wikipedia, CC BY-SA 4.0",
  "wikimedia-onthisday": "Wikipedia, CC BY-SA 4.0",
  "open-meteo": "Weather: Open-Meteo, CC BY 4.0",
  frankfurter: "Rates: ECB via Frankfurter",
  "hacker-news": "Hacker News API",
  usgs: "USGS, public domain",
  "launch-library": "Launch Library 2",
  computed: "Computed by Page 100",
});
