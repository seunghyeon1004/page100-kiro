---
inclusion: fileMatch
fileMatchPattern: ["src/sources/**", "test/fixtures/**"]
---

# Page 100: data sources

Only `src/sources` talks to the network, and only on the schedule. A visitor's request never causes a fetch. Every date in a URL is the current UTC date.

## Sources

| Source | URL pattern | Pages | Refresh | Licence | Row 22 attribution (max 30 chars) |
|---|---|---|---|---|---|
| Wikimedia featured feed | `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/YYYY/MM/DD` | 110-118, 120, 700 | 30 min | CC BY-SA 4.0 | `Wikipedia, CC BY-SA 4.0` |
| Wikimedia on this day | `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/MM/DD` | 500, 501, 550 | at boot and after 00:00 UTC each day | CC BY-SA 4.0 | `Wikipedia, CC BY-SA 4.0` |
| Open-Meteo | `https://api.open-meteo.com/v1/forecast?latitude=..&longitude=..` (comma-separated lists) | 200, 201 | 30 min | CC BY 4.0 | `Weather: Open-Meteo, CC BY 4.0` |
| Frankfurter, latest | `https://api.frankfurter.dev/v1/latest?base=USD` | 300 | 60 min | ECB reference rates; licence not stated in the brief | `Rates: ECB via Frankfurter` |
| Frankfurter, series | `https://api.frankfurter.dev/v1/YYYY-MM-DD..?base=USD&symbols=...` | 300 (change on the day), 301 | 60 min | as above | `Rates: ECB via Frankfurter` |
| Hacker News | `https://hacker-news.firebaseio.com/v0/{topstories,showstories,askstories}.json`, then `/v0/item/ID.json` | 400, 401, 402 | 10 min | not stated in the brief | `Hacker News API` |
| USGS | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson` | 600 | 10 min | public domain | `USGS, public domain` |
| Launch Library 2 | `https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=8&mode=list` | 610 | 60 min, never more often | not stated in the brief | `Launch Library 2` |
| Moon (no fetch) | computed from the compile time | 601 | each compile | n/a | `Computed by Page 100` |

Licences marked "not stated in the brief" must be confirmed from the provider's own terms before page 801 is written. Do not fill them in from memory.

## Per-source rules

- **Wikimedia featured.** The keys in the response vary by day: `news` and `dyk` appear on some days and `mostread` on others. Each refresh fetches today and yesterday and merges them key by key. Today's value wins when present, otherwise yesterday's is used. A key missing from both is "no data" for its pages. It is not an error for the other pages.
- **Wikimedia on this day.** One request per UTC day for today's MM/DD. Pages 500 and 501 and the quiz (550) all use the same response.
- **Open-Meteo.** One request covers every city, using comma-separated `latitude` and `longitude` lists. The response is an array. The schema requires its length to equal the number of cities requested, and results are matched to cities by position. A recorded fixture test confirms the order. The exact query parameters are fixed in the weather spec and stored in the fixture metadata.
- **Frankfurter.** `latest` gives page 300's rates. The series request starts 30 days before today, is open-ended (`YYYY-MM-DD..`), and lists only the symbols that page 301 shows. Change on the day compares the latest rate with the previous date in the series. No change is shown if there is no previous date.
- **Hacker News.** Fetch the three id lists. Then fetch only as many items as the pages can show, at most 6 requests in parallel. Items that are deleted, dead or null are skipped.
- **USGS.** One GeoJSON request. Page 600 uses it as delivered: magnitude 4.5 and over, past day.
- **Launch Library 2.** Without a key the limit is 15 requests an hour, so make at most one request per 60 minutes, counting failures and retries. There is no retry within the hour. The limit is tracked per process. After a restart the first request may run straight away, which stays under 15 an hour unless the server restarts more than 14 times in an hour.

## HTTP client (`src/sources/http.ts`)

- Every request sends this User-Agent: `Page100/<package version> (teletext revival, Kiroween 2026; +https://<deployed host>/801)`. The host is fixed once the deploy URL exists. Until then the URL is the repository URL. Never send an empty or browser-like User-Agent.
- GET only. Timeout 10 s. At most one retry, after 30 s, except for Launch Library. On HTTP 429, honour `Retry-After` and skip the cycle. Response bodies over 5 MB are rejected. No cookies, no auth headers.
- Add jitter of up to 10% to each interval so sources do not all fire at once.

## Parsing

- Every response body goes through a zod schema before any other code sees it. Use `safeParse`. A failure counts as a failed fetch and is logged with source, URL and the zod issue paths, never the whole body.
- Schemas list only the fields Page 100 uses. Field names and shapes come from recorded fixtures, not from memory or docs summaries.
- Do not loosen a schema (`optional()`, `nullable()`, `any()`, `passthrough` on a used field) to get a fixture to pass unless the fixture really shows that shape. The test must then cite that fixture.
- On failure the source keeps its last good data. A source becomes stale, and row 22 shows `Data delayed: last good HH:MM UTC`, when its last good data is older than twice its refresh interval (48 hours for on this day).

## Fixtures and the boot snapshot

- Recorded responses live in `test/fixtures/sources/<source>/<yyyy-mm-dd>-<what>.json`. Next to each is `<same name>.meta.json` with `url`, `fetchedAt` (ISO UTC), `status` and the request's query parameters.
- Fixtures are recorded only by `npx tsx scripts/record-fixtures.ts`. That script uses the network, so Kiro asks the user before running it. Recorded fixtures are never edited by hand.
- Hand-made edge cases (empty lists, missing keys, nulls) go in `test/fixtures/sources/<source>/synthetic/`. Each has a comment field saying which real shape it imitates.
- Keep Wikimedia featured fixtures for at least two consecutive days, covering a day with `news` and a day with `mostread`, so the today-plus-yesterday merge is tested on real responses.
- The boot snapshot in `src/sources/snapshot/` uses the same format. It is refreshed by `scripts/refresh-snapshot.ts`, and the server compiles every page from it at boot before any fetch.
