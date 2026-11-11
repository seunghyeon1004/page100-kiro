import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createHttpClient } from "../../src/sources/http.js";
import type { FetchFn, HttpResponse } from "../../src/sources/http.js";
import {
  bodyPath,
  listFixtureSets,
  metaPath,
  readBody,
  readMeta,
  writeRecorded,
} from "../../scripts/lib/fixture-files.js";
import { recordSource } from "../../scripts/lib/record.js";
import { fakeDelay, textResponse } from "../sources/fake-http.js";

const NOW = new Date("2026-11-11T14:05:09.123Z");
const LATER = new Date("2026-11-11T14:05:11.000Z");
const clock = (): Date => LATER;

/** A fetch that answers by URL: the route's body with status 200, or 404 for any other URL. */
function routeFetch(routes: Readonly<Record<string, string>>, seen: string[] = []): FetchFn {
  return (url): Promise<HttpResponse> => {
    seen.push(url);
    const body = routes[url];
    return Promise.resolve(
      body === undefined ? textResponse(404, "missing") : textResponse(200, body),
    );
  };
}

function httpWith(fetch: FetchFn) {
  return createHttpClient({ fetch, delay: fakeDelay().delay });
}

describe("recordSource (requirement 16.1)", () => {
  it("records both featured days with names, meta and the body exactly as received", async () => {
    const today = '{"news": [1],\n  "mostread": null }\n\n';
    const yesterday = '{"tfa":{}}';
    const http = httpWith(
      routeFetch({
        "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/11": today,
        "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/10": yesterday,
      }),
    );
    const { files, failures } = await recordSource(http, "wikimedia-feed", NOW, clock);
    expect(failures).toEqual([]);
    expect(files).toEqual([
      {
        source: "wikimedia-feed",
        base: "2026-11-11-featured-today",
        body: today,
        meta: {
          url: "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/11",
          fetchedAt: "2026-11-11T14:05:09.123Z",
          status: 200,
          query: {},
        },
      },
      {
        source: "wikimedia-feed",
        base: "2026-11-11-featured-yesterday",
        body: yesterday,
        meta: {
          url: "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/10",
          fetchedAt: "2026-11-11T14:05:11.000Z",
          status: 200,
          query: {},
        },
      },
    ]);
  });

  it("gives the first request of a source the fetchedAt of now", async () => {
    const http = httpWith(
      routeFetch({
        "https://api.frankfurter.dev/v1/latest?base=USD": "{}",
        "https://api.frankfurter.dev/v1/2026-10-12..?base=USD&symbols=EUR,GBP,JPY,KRW,CNY,INR":
          "{}",
      }),
    );
    const { files } = await recordSource(http, "frankfurter", NOW, clock);
    expect(files.map((f) => [f.base, f.meta.fetchedAt])).toEqual([
      ["2026-11-11-latest", NOW.toISOString()],
      ["2026-11-11-series", LATER.toISOString()],
    ]);
    expect(files[1]?.meta.query).toEqual({ base: "USD", symbols: "EUR,GBP,JPY,KRW,CNY,INR" });
  });

  it("records the requests that work and lists the ones that fail", async () => {
    const http = httpWith(
      routeFetch({
        "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/11": "{}",
      }),
    );
    const { files, failures } = await recordSource(http, "wikimedia-feed", NOW, clock);
    expect(files.map((f) => f.base)).toEqual(["2026-11-11-featured-today"]);
    expect(failures).toEqual([
      {
        source: "wikimedia-feed",
        url: "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/11/10",
        failure: { kind: "status", status: 404 },
      },
    ]);
  });

  it("records Hacker News id lists and the selected items, and lists a failed item", async () => {
    const ids = (from: number, n: number): number[] =>
      Array.from({ length: n }, (_, i) => from + i);
    const seen: string[] = [];
    const routes: Record<string, string> = {
      "https://hacker-news.firebaseio.com/v0/topstories.json": JSON.stringify(ids(1, 14)),
      "https://hacker-news.firebaseio.com/v0/showstories.json": JSON.stringify([
        2,
        ...ids(100, 14),
      ]),
      "https://hacker-news.firebaseio.com/v0/askstories.json": JSON.stringify([]),
    };
    // Items 1 to 12 and 100 to 110 exist, except item 7, which the fake serves as 404.
    for (const id of [...ids(1, 12), ...ids(100, 11)]) {
      if (id !== 7)
        routes[`https://hacker-news.firebaseio.com/v0/item/${String(id)}.json`] =
          `{"id":${String(id)}}`;
    }
    const http = httpWith(routeFetch(routes, seen));
    const { files, failures } = await recordSource(http, "hacker-news", NOW, clock);

    expect(files.slice(0, 3).map((f) => f.base)).toEqual([
      "2026-11-11-topstories",
      "2026-11-11-showstories",
      "2026-11-11-askstories",
    ]);
    // 12 from top + 11 from show (2 is a repeat; 100 to 110) = 23 items, one of which failed.
    const items = files.filter((f) => f.base.includes("-item-"));
    expect(items).toHaveLength(22);
    expect(items.map((f) => f.base)).not.toContain("2026-11-11-item-7");
    expect(failures).toEqual([
      {
        source: "hacker-news",
        url: "https://hacker-news.firebaseio.com/v0/item/7.json",
        failure: { kind: "status", status: 404 },
      },
    ]);
    expect(seen.filter((u) => u.includes("/item/"))).toHaveLength(23);
  });
});

describe("fixture files (requirement 16.1)", () => {
  const dir = mkdtempSync(join(import.meta.dirname, ".tmp-fixtures-"));
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes the body byte for byte and the meta with 2-space indentation and one final LF", async () => {
    const body = '{"a": 1}\n\n  ';
    const http = httpWith(
      routeFetch({
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson": body,
      }),
    );
    const { files } = await recordSource(http, "usgs", NOW, clock);
    writeRecorded(dir, files);

    expect(readFileSync(bodyPath(dir, "usgs", "2026-11-11-quakes"), "utf8")).toBe(body);
    expect(readFileSync(metaPath(dir, "usgs", "2026-11-11-quakes"), "utf8")).toBe(
      [
        "{",
        '  "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",',
        '  "fetchedAt": "2026-11-11T14:05:09.123Z",',
        '  "status": 200,',
        '  "query": {}',
        "}",
        "",
      ].join("\n"),
    );
    expect(readBody(dir, "usgs", "2026-11-11-quakes")).toBe(body);
    expect(readMeta(dir, "usgs", "2026-11-11-quakes").fetchedAt).toBe("2026-11-11T14:05:09.123Z");
  });

  it("lists fixture sets newest first and ignores meta files and synthetic/", () => {
    writeRecorded(dir, [
      {
        source: "usgs",
        base: "2026-11-09-quakes",
        body: "{}",
        meta: { url: "u", fetchedAt: "f", status: 200, query: {} },
      },
      {
        source: "usgs",
        base: "2026-11-10-quakes",
        body: "{}",
        meta: { url: "u", fetchedAt: "f", status: 200, query: {} },
      },
    ]);
    expect(listFixtureSets(dir, "usgs")).toEqual([
      { source: "usgs", date: "2026-11-11", bases: ["2026-11-11-quakes"] },
      { source: "usgs", date: "2026-11-10", bases: ["2026-11-10-quakes"] },
      { source: "usgs", date: "2026-11-09", bases: ["2026-11-09-quakes"] },
    ]);
    expect(listFixtureSets(dir, "open-meteo")).toEqual([]);
  });
});
