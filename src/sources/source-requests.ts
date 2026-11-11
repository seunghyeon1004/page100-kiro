import { CITIES } from "./cities.js";
import type { SourceId } from "./source-id.js";

/** One request a source needs: the fixture name, the URL and the URL's query parameters. */
export interface SourceRequest {
  readonly name: string;
  readonly url: string;
  readonly query: Readonly<Record<string, string>>;
}

/** The currencies page 301 shows, in this order (requirement 13.3). */
export const SERIES_SYMBOLS = ["EUR", "GBP", "JPY", "KRW", "CNY", "INR"] as const;

/** How many ids of each Hacker News list are used (requirement 13.4). */
export const HN_IDS_PER_LIST = 12;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** The UTC date `days` days before `now`, as `[year, month, day]`. `now` must be a valid Date. */
function utcDateMinus(now: Date, days: number): readonly [string, string, string] {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));
  return [
    String(d.getUTCFullYear()).padStart(4, "0"),
    pad2(d.getUTCMonth() + 1),
    pad2(d.getUTCDate()),
  ];
}

function request(name: string, url: string): SourceRequest {
  const query: Record<string, string> = {};
  for (const [key, value] of new URL(url).searchParams) query[key] = value;
  return { name, url, query };
}

/**
 * The requests of `source` for the UTC date of `now` (design.md, "Requests"). For Hacker News these
 * are the three id lists only; the item requests follow from `hnItemUrl` and `selectItemIds`.
 */
export function sourceRequests(source: SourceId, now: Date): readonly SourceRequest[] {
  const [y, m, d] = utcDateMinus(now, 0);
  switch (source) {
    case "wikimedia-feed": {
      const [py, pm, pd] = utcDateMinus(now, 1);
      const base = "https://api.wikimedia.org/feed/v1/wikipedia/en/featured";
      return [
        request("featured-today", `${base}/${y}/${m}/${d}`),
        request("featured-yesterday", `${base}/${py}/${pm}/${pd}`),
      ];
    }
    case "wikimedia-onthisday":
      return [
        request(
          "onthisday",
          `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${m}/${d}`,
        ),
      ];
    case "open-meteo": {
      const latitudes = CITIES.map((c) => c.latitude.toFixed(2)).join(",");
      const longitudes = CITIES.map((c) => c.longitude.toFixed(2)).join(",");
      return [
        request(
          "forecast",
          `https://api.open-meteo.com/v1/forecast?latitude=${latitudes}&longitude=${longitudes}` +
            "&current=temperature_2m,weather_code,wind_speed_10m" +
            "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
            "&timezone=auto&forecast_days=5",
        ),
      ];
    }
    case "frankfurter": {
      const [sy, sm, sd] = utcDateMinus(now, 30);
      return [
        request("latest", "https://api.frankfurter.dev/v1/latest?base=USD"),
        request(
          "series",
          `https://api.frankfurter.dev/v1/${sy}-${sm}-${sd}..?base=USD&symbols=${SERIES_SYMBOLS.join(",")}`,
        ),
      ];
    }
    case "hacker-news":
      return ["topstories", "showstories", "askstories"].map((list) =>
        request(list, `https://hacker-news.firebaseio.com/v0/${list}.json`),
      );
    case "usgs":
      return [
        request(
          "quakes",
          "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
        ),
      ];
    case "launch-library":
      return [
        request(
          "launches",
          "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=8&mode=list",
        ),
      ];
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
}

/** The URL of one Hacker News item. */
export function hnItemUrl(id: number): string {
  return `https://hacker-news.firebaseio.com/v0/item/${String(id)}.json`;
}

export interface HnLists {
  readonly top: readonly number[];
  readonly show: readonly number[];
  readonly ask: readonly number[];
}

/** The first 12 ids of each list, each id once, in the order top, show, ask (requirement 13.4). */
export function selectItemIds(lists: HnLists): number[] {
  const chosen: number[] = [];
  for (const list of [lists.top, lists.show, lists.ask]) {
    for (const id of list.slice(0, HN_IDS_PER_LIST)) {
      if (!chosen.includes(id)) chosen.push(id);
    }
  }
  return chosen;
}
