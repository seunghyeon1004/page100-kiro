# pages-and-sources: design

Requirements: `requirements.md`. Contracts: `grid-rules.md`, `product.md`, `sources.md`, `frontend.md`, `editorial.md`. Existing code used: `validateGrid`, `validateContentRows`, `parseContent`, `serialisePage`, `foldText`, `BLANK_CELL`, `NonEmpty`, `toNonEmpty`, `isRepertoireCodePoint`.

## Overview

```
scripts/record-fixtures.ts ─(network, owner only)─> test/fixtures/sources/<source>/*.json + .meta.json
                                                        │ replay fetch (no network)
fetchX(http, now) ─> wire schema ─> normaliser ─> FetchOutcome<T> ─> scripts/refresh-snapshot.ts ─> snapshot.json
                                                        │ (server spec: scheduler, store)
compilers (later spec) ─> CompiledPage { subpages: [{ content: ValidContent, alt }] }
                                   │
PageDef (REGISTRY) ─> buildScreen(def, compiled, i, { now, stale, lastGoodAt }) ─> frame rows + content ─> validateGrid ─> ValidPage
```

`src/pages` is pure. `src/sources` does I/O only through the injected `fetch` and `delay`. Neither reads the clock.

## Toolchain

`npm view` on 2026-11-11 (nothing installed): `zod` 4.6.7 is latest and has no `engines`; `tsx` 4.23.15 is latest, needs Node `>=18.0.0` and depends only on `esbuild ~0.28.0`. Install (task 1.1, after the owner's go-ahead): `npm install --save-exact zod@4.6.7 && npm install --save-dev --save-exact tsx@4.23.15`.

## Files

| Directory | File: exports |
|---|---|
| `src/pages` types | `page-def.ts`: `PageDef`, `QuickLink`, `EditorKind`, `PageSource`. `alt-block.ts`: `AltBlock`, `LinkTarget`. `compiled-page.ts`: `CompiledPage`, `Subpage`. |
| `src/pages` registry | `registry.ts`: `REGISTRY`, `findPage`. `page-lookup.ts`: `lookupPage`, `previousInService`, `nextInService`. |
| `src/pages` frame | `attribution.ts`: `ATTRIBUTION`. `frame-time.ts`: `formatHeaderClock`, `formatUtcTime`. `frame-rows.ts`: `frameRows`. `build-screen.ts`: `buildScreen`, `ScreenResult`, `FrameOptions`. `not-in-service.ts`: `notInServicePage`. |
| `src/pages` checks | `alt-agreement.ts`: `checkAltAgreement`, `wordsOf`. `check-compiled-page.ts`: `checkCompiledPage`, `CompiledProblem`. |
| `src/sources` shared | `source-id.ts`: `SOURCE_IDS`, `SourceId`. `user-agent.ts`: `PACKAGE_VERSION`, `USER_AGENT`. `http.ts`: `createHttpClient`, `HttpClient`, `HttpFailure`, `MAX_BODY_BYTES`, `realDelay`. `outcome.ts`: `ParseOutcome`, `FetchOutcome`, `SourceFailure`, `issuePathsOf`. `plain-text.ts`: `plainText`. |
| `src/sources` data | `cities.ts`: `CITIES`, `REGIONS`, `OUTLOOK_CITY_IDS`, `CityId`. `source-requests.ts`: `sourceRequests`, `hnItemUrl`, `selectItemIds`, `SERIES_SYMBOLS`. `schedule.ts`: `SCHEDULE`, `JITTER_FRACTION`, `isStale`. |
| `src/sources` per source | `wikimedia-feed.ts` (also `mergeFeatured`), `wikimedia-onthisday.ts`, `open-meteo.ts`, `frankfurter.ts`, `hacker-news.ts`, `usgs.ts`, `launch-library.ts`: `fetchX`, `parseX`, wire schemas, normalised schema and type. `fetchers.ts`: `FETCHERS`, one `fetchX` per SourceId. |
| `src/sources` snapshot | `snapshot.ts`: `Snapshot`, `parseSnapshot`. `snapshot/snapshot.json`: not emitted by `tsc`; the server spec decides how the build ships it. |
| `scripts/lib` | `record.ts`: `recordSource(http, source, now, clock)` returns `RecordedFile[]`, no file system. `fixture-files.ts`: names, paths, `writeRecorded`, `listFixtureSets` (newest first). `fixture-replay.ts`: `loadFixtureSet`, `replayFetch` (unknown URL rejects with `TypeError`). `build-snapshot.ts`: `buildSnapshot(fixturesRoot)`. |
| `scripts` | `record-fixtures.ts`, `refresh-snapshot.ts`: entry points for `npx tsx`. |

## Types

```ts
// src/pages
type EditorKind = "rules" | "ai" | "static";
type PageSource = SourceId | "static" | "computed";
interface QuickLink { readonly label: string; readonly target: number }
interface PageDef {
  readonly number: number; readonly title: string; readonly banner: string; readonly source: PageSource;
  readonly editor: EditorKind; readonly links: readonly [QuickLink, QuickLink, QuickLink, QuickLink]; // red, green, yellow, blue
}
type LinkTarget = { readonly page: number } | { readonly url: string };
type AltBlock =
  | { readonly kind: "heading"; readonly level: 2 | 3; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly ordered: boolean; readonly items: NonEmpty<string> }
  | { readonly kind: "table"; readonly headers: NonEmpty<string>; readonly rows: readonly (readonly string[])[] }
  | { readonly kind: "link"; readonly text: string; readonly target: LinkTarget }
  | { readonly kind: "concealed"; readonly summary: string; readonly text: string };
interface Subpage { readonly content: ValidContent; readonly alt: NonEmpty<AltBlock> }
interface CompiledPage {
  readonly number: number; readonly subpages: NonEmpty<Subpage>; readonly dataAt: Date | null; readonly editor: EditorKind;
}
interface FrameOptions { readonly now: Date; readonly stale: boolean; readonly lastGoodAt: Date | null }
type ScreenResult =
  | { readonly ok: true; readonly page: ValidPage }
  | { readonly ok: false; readonly error: "page-mismatch" | "subpage-count" | "subpage-index" | "time-invalid" }
  | { readonly ok: false; readonly error: "frame-invalid"; readonly violations: NonEmpty<GridViolation> };
type CompiledProblem =
  | { code: "number" } | { code: "subpage-count"; count: number } | { code: "editor"; actual: EditorKind }
  | { code: "table-width"; subpage: number; block: number; row: number }
  | { code: "alt-missing"; subpage: number; words: NonEmpty<string> };

// src/sources
type HttpFailure =
  | { kind: "network" } | { kind: "timeout" } | { kind: "status"; status: number }
  | { kind: "rate-limited"; retryAfterMs: number | null } | { kind: "too-large" } | { kind: "not-json" };
type SourceFailure = HttpFailure | { kind: "schema"; issuePaths: NonEmpty<string> };
type ParseOutcome<T> = { ok: true; value: T } | { ok: false; issuePaths: NonEmpty<string> };
type FetchOutcome<T> =
  | { ok: true; value: T; fetchedAt: string }
  | { ok: false; source: SourceId; url: string; failure: SourceFailure };
```

`NonEmpty` here is grid-core's own type. `src/sources` cannot import `src/grid` (requirement 17.1), so `outcome.ts` declares the same tuple type locally.

## Registry

Red, green, yellow, blue links are `label target`. Titles are sentence case; banners upper case. Pages 111 to 118 share one row: N is the number minus 110.

| No. | Title | Banner | Source | Editor | Red | Green | Yellow | Blue |
|---|---|---|---|---|---|---|---|---|
| 100 | Index | INDEX | static | rules | News 110 | Weather 200 | Rates 300 | Help 800 |
| 110 | World news | WORLD NEWS | wikimedia-feed | ai | Index 100 | Story 111 | Popular 120 | Weather 200 |
| 111-118 | News story N | WORLD NEWS | wikimedia-feed | ai | Index 100 | News 110 | Popular 120 | Weather 200 |
| 120 | Most read on Wikipedia | MOST READ ON WIKIPEDIA | wikimedia-feed | rules | Index 100 | News 110 | Article 700 | Weather 200 |
| 200 | World weather now | WORLD WEATHER NOW | open-meteo | rules | Index 100 | Outlook 201 | News 110 | Rates 300 |
| 201 | Five-day outlook | FIVE-DAY OUTLOOK | open-meteo | rules | Index 100 | Now 200 | News 110 | Rates 300 |
| 300 | Exchange rates | EXCHANGE RATES | frankfurter | rules | Index 100 | Trend 301 | Weather 200 | Tech 400 |
| 301 | Exchange rate trend | 30-DAY RATE TREND | frankfurter | rules | Index 100 | Rates 300 | Weather 200 | Tech 400 |
| 400 | Developer news | DEVELOPER NEWS: TOP | hacker-news | rules | Index 100 | Show 401 | Ask 402 | This day 500 |
| 401 | Developer news: Show | DEVELOPER NEWS: SHOW | hacker-news | rules | Index 100 | Top 400 | Ask 402 | This day 500 |
| 402 | Developer news: Ask | DEVELOPER NEWS: ASK | hacker-news | rules | Index 100 | Top 400 | Show 401 | This day 500 |
| 500 | On this day | ON THIS DAY | wikimedia-onthisday | ai | Index 100 | Births 501 | Quiz 550 | Quakes 600 |
| 501 | Births and deaths | ON THIS DAY: BIRTHS AND DEATHS | wikimedia-onthisday | ai | Index 100 | Events 500 | Quiz 550 | Quakes 600 |
| 550 | Quiz of the day | QUIZ OF THE DAY | wikimedia-onthisday | rules | Index 100 | Events 500 | Births 501 | Quakes 600 |
| 600 | Earthquakes | EARTHQUAKES M4.5+, LAST 24 HOURS | usgs | rules | Index 100 | Moon 601 | Launches 610 | Article 700 |
| 601 | The moon tonight | THE MOON TONIGHT | computed | rules | Index 100 | Quakes 600 | Launches 610 | Article 700 |
| 610 | Rocket launches | UPCOMING ROCKET LAUNCHES | launch-library | rules | Index 100 | Quakes 600 | Moon 601 | Article 700 |
| 700 | Featured article | FEATURED ARTICLE | wikimedia-feed | ai | Index 100 | News 110 | Popular 120 | Help 800 |
| 800 | How to use Page 100 | HOW TO USE PAGE 100 | static | static | Index 100 | About 801 | Status 802 | Test 899 |
| 801 | About and sources | ABOUT, SOURCES AND LICENCES | static | static | Index 100 | Help 800 | Status 802 | Test 899 |
| 802 | Service status | SERVICE STATUS | computed | rules | Index 100 | Help 800 | About 801 | Test 899 |
| 899 | Engineering test page | ENGINEERING TEST PAGE | static | static | Index 100 | Help 800 | About 801 | Status 802 |

Pages 400 to 402 are `rules`; whether the AI editor may shorten their titles is decided in the ai-editor spec. Pages 111 to 118 stay in service on days with fewer stories; the rule-compilers spec decides what an empty story page shows.

## Frame rows

| Row | Cells (all others blank) |
|---|---|
| 0 | 0-3 `P` + number, white/black. 5-12 `Page 100`, cyan/black. 21-39 `formatHeaderClock(now)`, yellow/black. |
| 1 | All 40 cells bg blue. Banner from col 0, fg yellow. `n/m` right-aligned to col 39, fg white, only when m > 1. Other cells blue spaces. |
| 22 | `static`: blank. Fresh: `ATTRIBUTION[source]` from col 0, cyan/black; `formatUtcTime(lastGoodAt)` at 31-39, white/black, when not null. Stale: `Data delayed: last good HH:MM UTC` (or `Data delayed`), yellow/black. |
| 23 | Block k (cols 10k to 10k+9): bg red, green, yellow, blue; label from col 10k+1; fg black, black, black, white; the rest of the block are spaces with that bg. |

`formatHeaderClock` uses `getUTCDay`, `getUTCDate`, `getUTCMonth`, `getUTCHours`, `getUTCMinutes`, `getUTCSeconds` with the `editorial.md` weekday and month abbreviations and two-digit zero padding. `ATTRIBUTION` values are the last column of the `sources.md` table: `wikimedia-feed` and `wikimedia-onthisday` `Wikipedia, CC BY-SA 4.0`; `open-meteo` `Weather: Open-Meteo, CC BY 4.0`; `frankfurter` `Rates: ECB via Frankfurter`; `hacker-news` `Hacker News API`; `usgs` `USGS, public domain`; `launch-library` `Launch Library 2`; `computed` `Computed by Page 100`.

`buildScreen` runs the checks of requirement 5.2, then `frameRows`, then `validateGrid([row0, row1, ...content, row22, row23])`. Frame text comes only from the registry, `ATTRIBUTION` and the two formatters, all repertoire-only and checked by tests, so `frame-invalid` is unreachable for registry pages; it exists so the function stays total.

## Not-in-service screen

For n = 123 (lower 120, higher 200), content markup lines 1-11 (rows 2-12; rows 13-21 blank):

```
(blank)
 Page 123 is not in service.
(blank)
 Nearest pages in service:
(blank)
 {y}120{w}  Most read on Wikipedia
 {y}200{w}  World weather now
 {y}100{w}  Index
(blank)
 Type a page number, or use the
 coloured links below.
```

The `100 Index` line is left out when lower is 100. The text goes through `parseContent` and `validateContentRows`; any failure gives `ok: false` with the errors, which Property 5 proves never happens. Def: `number` n, title `Page not in service`, banner `PAGE NOT IN SERVICE`, source `static`, editor `static`, links `Index 100`, `P<lower> <lower>`, `P<higher> <higher>`, `Help 800`. Alt blocks, in order: paragraph `Page 123 is not in service.`; paragraph `Nearest pages in service:`; link `120 Most read on Wikipedia` to `{ page: 120 }`; link `200 World weather now`; link `100 Index` (same rule); paragraph `Type a page number, or use the coloured links below.`

## Alt agreement

`wordsOf(s)` returns `s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []`. Grid side: for each content row, a string of each text cell's `ch` with every mosaic cell replaced by a space; rows are separate strings. Alt side: every `text`, `items` entry, `headers` and `rows` cell, and `summary`; each alt word is replaced by `foldText(word).text` when the fold succeeds, so `Dvořák` in the alt matches `Dvorák` on the grid. Link targets are not words.

## HTTP client

`createHttpClient({ fetch, delay })`, `delay(ms, signal): Promise<void>` (resolves after ms; never resolves once `signal` aborts). `realDelay` wraps `setTimeout`/`clearTimeout`. One attempt:

1. `controller = new AbortController()`; `timer = delay(10_000, timerController.signal)`.
2. Race `fetch(url, { method: "GET", headers, credentials: "omit", redirect: "follow", signal })` against the timer. Timer first: abort, `timeout`. Rejection: `network`.
3. Status 429: cancel the body, `rate-limited`. `retryAfterMs` is `Number(value) * 1000` for a value matching `^\d+$`; for an HTTP-date, `Date.parse(value) - Date.parse(response Date header)` when both parse and the result is at least 0; otherwise `null`.
4. Other non-2xx: cancel the body, `status`. `Content-Length` over `MAX_BODY_BYTES` (5,242,880): cancel, `too-large`.
5. Read the body stream chunk by chunk, each read raced against the timer, summing bytes; over the cap: cancel, `too-large`. Decode with `new TextDecoder("utf-8")`.
6. Abort the timer's signal in every outcome.

`getText` runs one attempt, and a second after `delay(30_000)` under requirement 10.4. `getJson` calls `getText`, then `JSON.parse` in a `try` (`not-json`).

## Requests

`D` is the UTC date of `now`, `D-1` and `D-30` calendar days before it. Fixture names (`<what>`) are in brackets. Lists use literal commas, not `%2C`.

| Source | Requests |
|---|---|
| wikimedia-feed | `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/YYYY/MM/DD` for D (`featured-today`) and D-1 (`featured-yesterday`) |
| wikimedia-onthisday | `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/MM/DD` for D (`onthisday`) |
| open-meteo | `https://api.open-meteo.com/v1/forecast?latitude=<24 lats>&longitude=<24 lons>&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5` (`forecast`); coordinates in `CITIES` order, `toFixed(2)` |
| frankfurter | `https://api.frankfurter.dev/v1/latest?base=USD` (`latest`); `https://api.frankfurter.dev/v1/<D-30 as YYYY-MM-DD>..?base=USD&symbols=EUR,GBP,JPY,KRW,CNY,INR` (`series`) |
| hacker-news | `https://hacker-news.firebaseio.com/v0/{topstories,showstories,askstories}.json` (`topstories`, `showstories`, `askstories`), then `hnItemUrl(id)` (`item-<id>`) for `selectItemIds(lists)`: the first 12 of each list, distinct, in order top, show, ask |
| usgs | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson` (`quakes`) |
| launch-library | `https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=8&mode=list` (`launches`) |

## Cities

`id` is the kebab-case name. Coordinates are latitude, longitude in degrees.

| Region | Cities |
|---|---|
| Europe | London 51.51, -0.13; Paris 48.86, 2.35; Berlin 52.52, 13.41; Madrid 40.42, -3.70; Rome 41.89, 12.48; Stockholm 59.33, 18.07 |
| Americas | New York 40.71, -74.01; Los Angeles 34.05, -118.24; Toronto 43.65, -79.38; Mexico City 19.43, -99.13; Sao Paulo -23.55, -46.63; Buenos Aires -34.60, -58.38 |
| Asia-Pacific | Tokyo 35.68, 139.69; Seoul 37.57, 126.98; Beijing 39.90, 116.41; Singapore 1.35, 103.82; Mumbai 19.08, 72.88; Sydney -33.87, 151.21 |
| Africa and Middle East | Cairo 30.04, 31.24; Lagos 6.52, 3.38; Nairobi -1.29, 36.82; Johannesburg -26.20, 28.05; Dubai 25.20, 55.27; Istanbul 41.01, 28.98 |

## Normalised types

These are fixed by this spec. Wire field names are not: each schema task reads them from the recorded fixture. If a fixture lacks the data for a normalised field, the task stops and asks the owner; it does not guess. `Iso` is a `toISOString()` string; `null` means the source did not give the value.

```ts
interface ArticleRef { title: string; extract: string | null; url: string | null }
interface FeaturedFeed { date: string /* D, YYYY-MM-DD */; news: NewsStory[] | null; mostRead: MostRead[] | null; featuredArticle: ArticleRef | null }
interface NewsStory { text: string; articles: ArticleRef[] }
interface MostRead { rank: number; title: string; views: number; extract: string | null }
interface OnThisDay { month: number; day: number; events: DayEntry[]; births: DayEntry[]; deaths: DayEntry[] }
interface DayEntry { year: number /* negative for BC */; text: string; articles: ArticleRef[] }
interface Weather { cities: CityWeather[] /* CITIES order, 24 */ }
interface CityWeather { cityId: CityId; observedAt: Iso; temperatureC: number | null; weatherCode: number | null; windKmh: number | null; daily: DayForecast[] }
interface DayForecast { date: string /* local YYYY-MM-DD */; weatherCode: number | null; maxC: number | null; minC: number | null; precipitationPct: number | null }
interface Rates { base: "USD"; date: string; rates: { code: string; rate: number }[] /* by code */; series: { code: string; points: { date: string; rate: number }[] }[] }
interface HackerNews { top: HnStory[]; show: HnStory[]; ask: HnStory[] /* each at most 12 */ }
interface HnStory { id: number; title: string; by: string | null; score: number | null; comments: number | null; time: Iso; url: string | null }
interface Quakes { generatedAt: Iso; quakes: { id: string; magnitude: number | null; place: string | null; time: Iso; depthKm: number | null; latitude: number; longitude: number }[] }
interface Launches { launches: { id: string; name: string; net: Iso; status: string | null; provider: string | null; pad: string | null }[] }
interface Snapshot { version: 1; sources: { [S in SourceId]: { fetchedAt: Iso; value: ValueOf<S> } } }
```

Normalisers map `-0` to `0`, convert local Open-Meteo times to UTC with the response's UTC offset, keep USGS order as delivered, and sort series points by date. The normalised schemas use `z.number()` with a refinement that rejects `-0`; a test checks that they reject `NaN`, `Infinity` and `-Infinity`.

## Schedule

| Source | intervalMs | staleAfterMs | retry | Scheduler note (server spec) |
|---|---|---|---|---|
| wikimedia-feed | 1,800,000 | 3,600,000 | true | |
| wikimedia-onthisday | 86,400,000 | 172,800,000 (48 h) | true | `alignToUtcMidnight: true`: at boot and after 00:00 UTC |
| open-meteo | 1,800,000 | 3,600,000 | true | |
| frankfurter | 3,600,000 | 7,200,000 | true | |
| hacker-news | 600,000 | 1,200,000 | true | id lists only; items never retry |
| usgs | 600,000 | 1,200,000 | true | |
| launch-library | 3,600,000 | 7,200,000 | false | `strictInterval: true`: at most one request per interval, failures included |

## Fixture files

`test/fixtures/sources/<source>/<D>-<what>.json` holds the raw body; `<D>-<what>.meta.json` holds `{ url, fetchedAt, status, query }`, where `query` is the URL's search parameters as an object (`{}` when none). A fixture set is all files of one source with the same `D`. `buildSnapshot` tries each source's sets newest first and uses the first that replays to `ok`. Synthetic files go in `synthetic/` (requirement 16.4) and are never used by `buildSnapshot`.

## Error handling

- No function in `src/pages` or `src/sources` throws on purpose. `fetchX` and the HTTP client catch only around `fetch`, body reads and `JSON.parse`. Exhaustive `switch` statements end in a `never` default.
- Failures carry the URL and zod issue paths, never a body (`sources.md`). Logging belongs to the server spec.

## Correctness properties

Each is one fast-check test named `Property N: ...`, in the file shown. Arbitraries from `test/grid/arbitraries.ts` (`validContent`) are reused; new ones live in `test/pages/page-arbitraries.ts` and `test/sources/source-arbitraries.ts`.

Property 1: for all registry defs d, compiled pages with 1 to 9 subpages of arbitrary valid content and an editor allowed for d, indices in range, valid `now` and `lastGoodAt` (or null) from 1970 to 2199, and both `stale` values, `buildScreen` succeeds, rows 2-21 deep-equal the chosen content, the inputs deep-equal a clone taken before the call, and a second call gives a deep-equal page. Validates: 5.1, 5.3, 5.4, 5.5. (`test/pages/build-screen.property.test.ts`)

Property 2: for the same inputs, lines 0, 1, 22 and 23 of `serialisePage(page)` equal canonical markup written independently by the test from the "Frame rows" table. Validates: 6.1, 6.2, 7.1, 7.2, 7.3, 7.5. (`test/pages/build-screen.property.test.ts`)

Property 3: for all integers n from 100 to 899, `previousInService(n)` and `nextInService(n)` are in service, no in-service number lies strictly between either and n (wrap aside), and `previousInService(nextInService(n)) === n` when n is in service; for every PageDef, every link target is in service and not its own number; for all other numbers, both return `undefined`. Validates: 2.4, 3.2, 3.3. (`test/pages/page-lookup.property.test.ts`)

Property 4: for all strings s (digit strings of length 0 to 4, arbitrary Unicode, other numeral systems), `lookupPage(s)` does not throw and its kind equals the oracle "`/^[0-9]{3}$/` and 100 to 899, then registry membership"; for not-in-service results, `lower < n < higher` and both are the nearest in-service numbers. Validates: 3.1, 3.4. (`test/pages/page-lookup.property.test.ts`)

Property 5: for all n from 100 to 899 that are not in service, `notInServicePage(n)` succeeds, `checkCompiledPage(def, compiled)` returns no problems, and `buildScreen(def, compiled, 0, opts)` succeeds for any valid opts. Validates: 8.1, 8.2, 9.1, 9.2. (`test/pages/not-in-service.property.test.ts`)

Property 6: for all valid content c, with alt = one paragraph per content row's text (mosaics as spaces), `checkAltAgreement(c, alt)` is ok; and for any word w of c, replacing every token w in alt with a space makes it fail with w in `missing`. Validates: 9.1. (`test/pages/alt-agreement.property.test.ts`)

Property 7: for all sources and JSON variations of each recorded fixture (any 1 to 3 nodes replaced by `null`, `true`, `""`, `"7"`, `0`, `-0`, `-1`, `1e308`, `NaN`, `Infinity`, `-Infinity`, `[]`, `{}` or an arbitrary double, a key removed, or an array element dropped or duplicated), `parseX` does not throw, and every `ok` value passes its normalised schema and contains no `undefined`, `NaN`, `Infinity`, `-Infinity` or `-0` at any depth. Validates: 12.1, 12.2, 12.4. (`test/sources/normalisers.property.test.ts`)

Property 8: for all pairs (today, yesterday), each a featured day or null with each key independently present or absent, `mergeFeatured` takes each key from today when present, else from yesterday, else null. Validates: 13.1. (`test/sources/wikimedia-feed.property.test.ts`)

Property 9: for all three id lists (0 to 40 ids from a pool of 60, so lists overlap) and per-item behaviours (story, null, deleted, dead, network failure, bad shape, varying delay), `fetchHackerNews` with a fake fetch never has more than 6 item requests in flight, requests only ids from `selectItemIds` and each once, and returns at most 12 stories per list, in list order, none of the skipped kinds. Validates: 13.4. (`test/sources/hacker-news.property.test.ts`)

Property 10: for all fake fetch behaviours (status 100 to 599, `Content-Length` and body sizes around 5,242,880, `Retry-After` values, rejection, hanging), `getText` and `getJson` resolve, make at most 2 attempts (2 only for a retryable failure with `retry: true`, with exactly one `delay(30_000)` between), send every request with the headers of 10.2, and return `ok` only for 2xx with a body of at most 5,242,880 bytes. Validates: 10.1 to 10.6. (`test/sources/http.property.test.ts`)

Property 11: for all generated snapshots s (strings with any code units, finite doubles without -0, valid ISO times), `parseSnapshot(JSON.parse(JSON.stringify(s)))` succeeds and deep-equals s. Validates: 15.2, 15.3. (`test/sources/snapshot.property.test.ts`)

Property 12: for all sources and times t0, t1 (ms from 0 to 2^41), `isStale(source, new Date(t0), new Date(t1))` is true exactly when `t1 - t0 > 2 * SCHEDULE[source].intervalMs`. Validates: 14.1, 14.2. (`test/sources/schedule.property.test.ts`)

## Example tests

- `test/pages/registry.test.ts`: the 29 numbers; the table above row by row; banner, title and label rules (2.3, 2.4); editor and source sets (2.5); `findPage` of 99, 100.5, `NaN`.
- `test/pages/page-lookup.test.ts`: the examples in 3.1; 101 (100, 110), 898 (802, 899); wrap at 100 and 899.
- `test/pages/attribution.test.ts`: `ATTRIBUTION` against the backticked last column of the `sources.md` table, read with `node:fs`.
- `test/pages/frame-time.test.ts` and `build-screen.test.ts`: 201 subpage 2 of 6 at 2026-11-11T14:05:09.999Z, exact markup of rows 0 and 1; one subpage (no indicator); `9/9`; 10 subpages; indices -1, 1.5 and 6 of 6; `new Date(NaN)`; stale with and without `lastGoodAt`; 601 (`Computed by Page 100`); 800 (blank row 22); check order of 5.2.
- `test/pages/not-in-service.test.ts`: exact markup for 123, 101 and 898; 100 gives `in-service`; 99, 900 and 1.5 give `out-of-range`.
- `test/pages/alt-agreement.test.ts`, `check-compiled-page.test.ts`: concealed word missing; mosaic ignored; case; `Dvořák`/`Dvorák`; link target not counted; table headers counted; each `CompiledProblem`.
- `test/sources/http.test.ts`: exact headers; 200; 404 (one attempt); 503 then 200; 503 with `retry: false`; 429 with `120`, an HTTP-date, and `soon`; timeout; rejection; `Content-Length` 5,242,881; a stream of 5,242,881 bytes with no length; exactly 5,242,880; `not-json`; `PACKAGE_VERSION` equals `package.json`.
- `test/sources/source-requests.test.ts`: every URL for 2026-11-11; D = 2026-01-01 (yesterday 2025-12-31); D = 2028-03-30 (series from 2028-02-29); `selectItemIds` dedupe; `CITIES` ids unique, 4 x 6.
- `test/sources/<source>.test.ts`: every recorded fixture parses (listed from the directory); spot values from one fixture; the synthetic cases (empty lists, missing key, null, Open-Meteo 23 elements and two cities swapped, HN null, deleted and dead items); the real two-day feed merge.
- `test/sources/snapshot.test.ts`: `snapshot.json` parses and equals `buildSnapshot` output (15.4); version 2 and a missing source are rejected.
- `test/scripts/record.test.ts`: `recordSource` with a fake fetch and clock: names, meta, first `fetchedAt` equals `now`, body text unchanged.
- `test/boundaries.test.ts` (extended): 17.1, 17.2, and grid-core 20.2 as amended.

## Test plan

| Command | Covers |
|---|---|
| `npm test -- test/pages` | Requirements 2 to 9; Properties 1 to 6 |
| `npm test -- test/sources` | Requirements 10 to 15; Properties 7 to 12 |
| `npm test -- test/scripts test/scaffold.test.ts test/boundaries.test.ts` | Requirements 1, 16, 17 |
| `npm run typecheck && npm run lint && npm run build` | 1.2, 18.3 |

Property tests use fast-check's default 100 runs and a random seed. Tests that need recorded fixtures are written only after task 10 (the owner records fixtures).
