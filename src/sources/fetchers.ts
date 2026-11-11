import type { HttpClient } from "./http.js";
import { fetchFrankfurter } from "./frankfurter.js";
import type { Rates } from "./frankfurter.js";
import { fetchHackerNews } from "./hacker-news.js";
import type { HackerNews } from "./hacker-news.js";
import { fetchLaunchLibrary } from "./launch-library.js";
import type { Launches } from "./launch-library.js";
import { fetchOpenMeteo } from "./open-meteo.js";
import type { Weather } from "./open-meteo.js";
import type { FetchOutcome } from "./outcome.js";
import type { SourceId } from "./source-id.js";
import { fetchUsgs } from "./usgs.js";
import type { Quakes } from "./usgs.js";
import { fetchWikimediaFeed } from "./wikimedia-feed.js";
import type { FeaturedFeed } from "./wikimedia-feed.js";
import { fetchWikimediaOnThisDay } from "./wikimedia-onthisday.js";
import type { OnThisDay } from "./wikimedia-onthisday.js";

/** The normalised value each source gives (design.md, "Normalised types"). */
export interface SourceValues {
  readonly "wikimedia-feed": FeaturedFeed;
  readonly "wikimedia-onthisday": OnThisDay;
  readonly "open-meteo": Weather;
  readonly frankfurter: Rates;
  readonly "hacker-news": HackerNews;
  readonly usgs: Quakes;
  readonly "launch-library": Launches;
}

export type SourceValue<S extends SourceId> = SourceValues[S];

export type SourceFetcher<T> = (http: HttpClient, now: Date) => Promise<FetchOutcome<T>>;

/** One `fetchX` per source id. */
export const FETCHERS: { readonly [S in SourceId]: SourceFetcher<SourceValue<S>> } = Object.freeze({
  "wikimedia-feed": fetchWikimediaFeed,
  "wikimedia-onthisday": fetchWikimediaOnThisDay,
  "open-meteo": fetchOpenMeteo,
  frankfurter: fetchFrankfurter,
  "hacker-news": fetchHackerNews,
  usgs: fetchUsgs,
  "launch-library": fetchLaunchLibrary,
});
