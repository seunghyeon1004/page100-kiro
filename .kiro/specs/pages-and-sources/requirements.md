# pages-and-sources: requirements

Spec for `src/pages` (registry, text alternative and compiled page models, frame builder, not-in-service screen, alt/grid agreement) and `src/sources` (HTTP client, one module per source, schedule data, boot snapshot), plus `scripts/record-fixtures.ts` and `scripts/refresh-snapshot.ts`. Contracts: `grid-rules.md` (rows 0, 1, 22, 23), `product.md` (page map), `sources.md` (sources, HTTP client, parsing, fixtures), `frontend.md` (text alternative). This spec does not restate them; it fixes what they leave open.

## Glossary

- **PageDef**: one registry entry. **In service**: a number that has a PageDef in `REGISTRY`.
- **CompiledPage**, **Subpage**, **AltBlock**: the types of requirement 4.
- **Frame rows**: page rows 0, 1, 22 and 23. **Content rows**, **ValidContent**, **ValidPage**: as in grid-core.
- **SourceId**: one of the seven ids of requirement 11.1. **PageSource**: a SourceId, `static` or `computed`.
- **Normalised value**: the plain JSON data a `fetchX` function returns (types in `design.md`, "Normalised types").
- **Fixture set**: the recorded files of one source from one recording date (`sources.md`, "Fixtures and the boot snapshot").
- **Word**: a maximal run of `\p{L}` or `\p{N}` code points, compared in lower case.

## Departures

1. **Merged spec.** `kiro-workflow.md` plans `page-frame` and `sources` as two specs. This spec covers both, because the owner asked for it and the frame's row 22 needs the source ids.
2. **Boot snapshot format.** `sources.md` says the boot snapshot "uses the same format" as the fixtures (raw responses). Here it holds normalised values in one JSON file checked by one zod schema (requirement 15), as the owner specified, so the server can compile every page at boot without parsing raw responses. It is still built only from recorded fixtures, through the same parse functions.
3. **grid-core scaffold rules.** This spec changes grid-core requirements 1.3 (adds `tsx` 4.23.15), 1.4 (adds `"dependencies": { "zod": "4.6.7" }`), 1.6 (`include` gains `scripts`), 1.9 (`.prettierignore` gains `src/sources/snapshot/`) and 20.2 (an `@ts-expect-error` may name `pages-and-sources`). `test/scaffold.test.ts` keeps exact-match checks against the new lists. The owner approved both packages in the request for this spec (`tech.md`, "Dependencies").
4. **Frame time formats.** `editorial.md` puts every formatter in `src/compilers/format.ts`. The two frame formats (header clock, `HH:MM UTC`) live in `src/pages/frame-time.ts`, because compilers will import `src/pages` types and the reverse import would make a cycle. The rule-compilers spec may re-export them.

## Decisions already made by the owner

- Row 0 shows the service name `Page 100` in cyan.
- The User-Agent URL is `https://github.com/seunghyeon1004/page100-kiro` until a deploy host exists (`sources.md` allows the repository URL).
- Subpage URLs use `?s=N`, 1-based. The server spec implements this; `buildScreen` takes a 0-based index.
- The frame builder owns the attribution text, chosen by the registry's source id from the table in `sources.md`.

## Decisions where steering is silent

- Previous and next page wrap: before 100 is 899, after 899 is 100.
- Static pages (source `static`) have a blank row 22.
- `AltBlock` headings are level 2 or 3. The renderer writes the single `<h1>` from the registry (`frontend.md`).
- The response size cap is 5 MiB, 5,242,880 bytes.

## Owner answers (2026-11-11)

1. **News extracts.** Each `news` item in the featured feed has `links`, and each link is an article summary object with `extract`. This is to be confirmed against the recorded fixture. IF the fixture does not show it, THEN the Wikimedia feed task (11.1) stops and says so.
2. **Confirmed decisions.** Previous and next page wrap (3.2). Static pages have a blank row 22 (7.1). The featured fetch succeeds when only one of the two days returns (13.1).
3. **Frame colours confirmed** as in 6.1, 6.2, 7.2 and 7.3: row 0 page number white, service name cyan, clock yellow; row 1 yellow on blue; row 22 cyan.
4. **Fixture recording.** Kiro is authorised to run `npx tsx scripts/record-fixtures.ts` once in the implementing session (task 10). That script is the only network use besides `npm install`. If a source fails, the others are recorded and the tasks that depend on the failed source stay unticked. `public/` and `scripts/subset-font.sh` belong to the owner and are left alone.

5. **Lint and fonts (2026-11-11).** `public/fonts/` is added to `.prettierignore` (after `src/sources/snapshot/`), and `test/scaffold.test.ts` lists it exactly. Tasks 1.2 and 9 are then finished and ticked. Requirement 1.3 reads accordingly.
6. **Launch Library (2026-11-11).** Keep `mode=list` (one request, small response). `Launches` drops `provider` and `pad`. The normaliser splits `name` on `" | "` into `rocket` and `mission`; with no separator the whole name is the mission and `rocket` is `null`. `net` is the time and `status.abbrev` is the status.
7. **Nulls (2026-11-11).** The providers document that these values can be null. Exactly these wire fields allow null: Open-Meteo `current.temperature_2m`, `current.weather_code`, `current.wind_speed_10m` and every element of the `daily` arrays read (`weather_code`, `temperature_2m_max`, `temperature_2m_min`, `precipitation_probability_max`); USGS `properties.mag`, `properties.place` and the depth coordinate (third coordinate). A null becomes `null` in the normalised value (compilers show n/a). A USGS feature with a null magnitude is dropped. No other schema is loosened. Each case has a synthetic fixture whose `comment` names the provider documentation as the reason, and a test (12.3, 16.4).

## Requirement 1: Project changes

**User story:** As a developer, I want the two new packages and the scripts folder wired into the existing checks, so that the gate covers the new code.

1.1 THE `package.json` file SHALL list `"dependencies": { "zod": "4.6.7" }` and add `"tsx": "4.23.15"` to the seven grid-core `devDependencies`, both exact versions, with `package-lock.json` updated.

1.2 THE `tsconfig.json` `include` SHALL be exactly `["src", "test", "scripts", "vitest.config.ts"]`, AND `tsconfig.build.json` SHALL still include only `src`.

1.3 THE `.prettierignore` file SHALL list the grid-core entries followed by `src/sources/snapshot/` and `public/fonts/` (owner answer 5).

1.4 THE `test/scaffold.test.ts` checks SHALL match requirements 1.1 to 1.3 exactly.

## Requirement 2: Page registry

**User story:** As the server and the compilers, I want one table of every in-service page, so that numbers, banners, sources and links are defined once.

2.1 THE module `src/pages/registry.ts` SHALL export `REGISTRY`, frozen at every level, holding exactly the 30 numbers 100, 110 to 118, 120, 200, 201, 300, 301, 400, 401, 402, 500, 501, 550, 600, 601, 610, 666, 700, 800, 801, 802 and 899, in ascending order.

2.2 EACH PageDef SHALL have `number`, `title`, `banner`, `source`, `editor` and `links` with the values in the table in `design.md`, "Registry".

2.3 EACH banner SHALL be 1 to 35 repertoire characters and equal to its own `toUpperCase()`. EACH title SHALL be 1 to 32 repertoire characters.

2.4 EACH PageDef SHALL have exactly four links, for red, green, yellow and blue in that order, each with a label of 1 to 8 repertoire characters with no leading or trailing space, and a target page that is in service and is not the page's own number.

2.5 THE `editor` SHALL be `static` exactly for 666, 800, 801 and 899, AND THE `source` SHALL be `static` exactly for 100, 666, 800, 801 and 899 and `computed` exactly for 601 and 802.

2.6 THE function `findPage(n: number)` SHALL return the PageDef whose number is n, or `undefined`, for any number.

## Requirement 3: Page lookup and neighbours

**User story:** As the server, I want each typed number classified the same way everywhere, so that every route agrees on what is a page.

3.1 THE function `lookupPage(input: string)` SHALL return `{ kind: "in-service", def }` when the input matches `^[0-9]{3}$`, is 100 to 899 and is in service; `{ kind: "not-in-service", number, lower, higher }` when it matches, is 100 to 899 and is not in service; and `{ kind: "not-a-page-number" }` otherwise (for example `""`, `"99"`, `"099"`, `"900"`, `"1000"`, `"12a"`, `" 123"`, `"١٢٣"`). It SHALL never throw.

3.2 THE function `previousInService(n)` SHALL return the largest in-service number below n, or 899 when there is none, AND `nextInService(n)` SHALL return the smallest in-service number above n, or 100 when there is none, for every integer n from 100 to 899.

3.3 IF n is not an integer from 100 to 899, THEN `previousInService` and `nextInService` SHALL return `undefined`.

3.4 WHEN n is not in service, THE `lower` and `higher` of 3.1 SHALL equal `previousInService(n)` and `nextInService(n)`, and satisfy `lower < n < higher`.

## Requirement 4: Text alternative and compiled page models

**User story:** As a renderer author, I want each page's text alternative as plain data, so that HTML, text and JSON output come from the same source as the grid.

4.1 THE module `src/pages/alt-block.ts` SHALL export `AltBlock`, a union on `kind` of exactly `heading` (`level: 2 | 3`, `text`), `paragraph` (`text`), `list` (`ordered: boolean`, `items: NonEmpty<string>`), `table` (`headers: NonEmpty<string>`, `rows`), `link` (`text`, `target: { page: number } | { url: string }`) and `concealed` (`summary`, `text`). Every field is readonly; no field holds HTML.

4.2 THE module `src/pages/compiled-page.ts` SHALL export `Subpage` (`content: ValidContent`, `alt: NonEmpty<AltBlock>`) and `CompiledPage` (`number`, `subpages: NonEmpty<Subpage>`, `dataAt: Date | null`, `editor: "rules" | "ai" | "static"`).

## Requirement 5: Frame builder

**User story:** As the page store, I want full screens built in one pure function, so that rows 0, 1, 22 and 23 are always right and always validated.

5.1 THE function `buildScreen(def, compiled, subpageIndex, { now, stale, lastGoodAt })` SHALL return `{ ok: true, page: ValidPage }` or `{ ok: false, error }`, where `error` is one of `page-mismatch`, `subpage-count`, `subpage-index`, `time-invalid` or `frame-invalid` (with the `violations`), and SHALL never throw.

5.2 IF `compiled.number !== def.number`, THEN `buildScreen` SHALL return `page-mismatch`; IF `compiled.subpages` has more than 9 entries, `subpage-count`; IF `subpageIndex` is not an integer from 0 to the subpage count minus 1, `subpage-index`; IF `now` or a non-null `lastGoodAt` is an invalid Date, `time-invalid`. The checks run in this order.

5.3 WHEN the checks pass, THE function `buildScreen` SHALL assemble 24 rows (frame rows from requirements 6 and 7, rows 2 to 21 from the subpage's content) and return the result of `validateGrid`, with `frame-invalid` when it fails.

5.4 WHEN `buildScreen` succeeds, rows 2 to 21 of the page SHALL deep-equal the selected subpage's content.

5.5 THE function `buildScreen` SHALL be pure: it reads no clock, mutates no input, and equal inputs give deep-equal results.

## Requirement 6: Rows 0 and 1

6.1 THE row 0 SHALL hold `P` and the three digits of `def.number` in cols 0 to 3 (white), `Page 100` in cols 5 to 12 (cyan), and `now` in UTC as `Ddd DD Mon HH:MM:SS` in cols 21 to 39 (yellow), all on black, with blank cells elsewhere. Seconds are truncated, so 2026-11-11T14:05:09.999Z gives `Wed 11 Nov 14:05:09`.

6.2 THE row 1 SHALL have a blue background in all 40 cells, the banner in yellow from col 0, AND, WHEN the page has more than one subpage, `n/m` in white ending at col 39, where n is `subpageIndex + 1` and m the subpage count.

## Requirement 7: Rows 22 and 23

7.1 WHERE `def.source` is `static`, THE row 22 SHALL be 40 blank cells.

7.2 WHILE `stale` is false and the source is not `static`, THE row 22 SHALL hold the source's attribution text from col 0 (cyan on black) and, WHEN `lastGoodAt` is not null, `HH:MM UTC` of `lastGoodAt` in cols 31 to 39 (white on black).

7.3 WHILE `stale` is true and the source is not `static`, THE row 22 SHALL read `Data delayed: last good HH:MM UTC` from col 0 in yellow on black, or `Data delayed` when `lastGoodAt` is null.

7.4 THE module `src/pages/attribution.ts` SHALL export `ATTRIBUTION`, mapping each SourceId to the row 22 text in `sources.md` and `computed` to `Computed by Page 100`, each at most 30 characters. A test compares it with the table in `sources.md`.

7.5 THE row 23 SHALL be four 10-cell blocks with backgrounds red, green, yellow and blue, each holding its link's label from the block's second cell, black on red, green and yellow and white on blue, with the rest of each block spaces in the block's colour.

## Requirement 8: Not-in-service screen

**User story:** As a visitor who typed a number that is not in service, I want to be told so and shown where to go, on the grid and in the text alternative.

8.1 THE function `notInServicePage(n)` SHALL return `{ ok: true, def, compiled }` for every n from 100 to 899 that is not in service, with the def, content and alt blocks laid out in `design.md`, "Not-in-service screen", one subpage, `dataAt: null` and `editor: "static"`.

8.2 THE screen SHALL say that page n is not in service and list, with number and title, the lower and higher pages of 3.4 and page 100 (100 only once when it is the lower page), AND its links SHALL be `Index` to 100, `P<lower>`, `P<higher>` and `Help` to 800.

8.3 IF n is in service, or is not an integer from 100 to 899, THEN `notInServicePage` SHALL return `{ ok: false, reason: "in-service" }` or `{ ok: false, reason: "out-of-range" }`.

## Requirement 9: Alt/grid agreement and the compiled-page check

**User story:** As a screen reader user, I want the text alternative to contain everything the grid shows, so that I miss nothing.

9.1 THE function `checkAltAgreement(content, alt)` SHALL collect the words of the text cells of each content row (concealed cells included, mosaic cells and row ends treated as spaces) and the words of every string in the alt blocks (link targets excluded; each alt word folded by `foldText` when that succeeds), AND SHALL return `{ ok: true }` when every grid word is an alt word, or `{ ok: false, missing }` listing each missing word once, in order of first appearance in the grid.

9.2 THE function `checkCompiledPage(def, compiled)` SHALL return a list of problems, empty when the page is sound, with one entry for each of: number differs from `def.number`; more than 9 subpages; `editor` not allowed for `def.editor` (`static` needs `static`, `rules` needs `rules`, `ai` allows `ai` or `rules`); a table row whose length differs from its headers; a subpage that fails 9.1 (with its index and missing words).

## Requirement 10: HTTP client

**User story:** As an operator, I want every outbound request to follow the rules in `sources.md`, so that Page 100 is a polite client and tests never touch the network.

10.1 THE function `createHttpClient({ fetch, delay })` in `src/sources/http.ts` SHALL return `getText(url, { retry })` and `getJson(url, { retry })`, whose promises always resolve, to `{ ok: true, url, status, attempts, body }` or `{ ok: false, url, attempts, failure }`.

10.2 EVERY request SHALL use method GET, `credentials: "omit"`, the header `Accept: application/json` and the header `User-Agent: Page100/0.1.0 (teletext revival, Kiroween 2026; +https://github.com/seunghyeon1004/page100-kiro)`, and no `Cookie` or `Authorization` header. The version comes from a constant that a test compares with `package.json`.

10.3 IF a request (headers and body) takes more than 10,000 ms by the injected `delay`, THEN THE client SHALL abort it and report `timeout`.

10.4 WHEN `retry` is true and the first attempt fails with `network`, `timeout` or a status from 500 to 599, THE client SHALL call `delay(30_000)` and make exactly one more attempt. It SHALL never make a third attempt, and SHALL not retry any other failure.

10.5 IF the status is 429, THEN THE client SHALL report `rate-limited` with `retryAfterMs` (delta-seconds times 1,000; an HTTP-date minus the response `Date` header; otherwise `null`) and not retry.

10.6 IF `Content-Length` exceeds 5,242,880 or the body read so far exceeds it, THEN THE client SHALL cancel the body and report `too-large`. Any other non-2xx status gives `status` with the code, AND `getJson` reports `not-json` when the body does not parse.

## Requirement 11: Source ids, requests and cities

11.1 THE module `src/sources/source-id.ts` SHALL export `SOURCE_IDS`: `wikimedia-feed`, `wikimedia-onthisday`, `open-meteo`, `frankfurter`, `hacker-news`, `usgs`, `launch-library`, in that order.

11.2 THE function `sourceRequests(source, now)` SHALL return, for the UTC date of `now`, exactly the requests listed in `design.md`, "Requests", each with its fixture name, URL and query parameters, AND `hnItemUrl(id)` SHALL return `https://hacker-news.firebaseio.com/v0/item/<id>.json`.

11.3 THE module `src/sources/cities.ts` SHALL export `CITIES` (the 24 cities, ids, regions and coordinates in `design.md`, in that order), `REGIONS` (four, six cities each) and `OUTLOOK_CITY_IDS` (`london`, `new-york`, `tokyo`, `seoul`, `sydney`, `cairo`).

## Requirement 12: Parsing and normalising

**User story:** As a compiler author, I want every source as typed, checked, plain data, so that compilers never see the wire format.

12.1 EACH source module SHALL export its wire schema(s), its normalised zod schema and type (same name, `structure.md`), `parseX(body: unknown)` returning `{ ok: true, value }` or `{ ok: false, issuePaths }`, and `fetchX(http, now)` returning `{ ok: true, value, fetchedAt }` or `{ ok: false, source, url, failure }`. Neither throws.

12.2 EVERY response body SHALL pass through its wire schema with `safeParse` before other code reads it, AND a failure SHALL carry the zod issue paths (joined with `.`) and never any part of the body.

12.3 THE wire schemas SHALL list only fields that a normaliser reads, follow `sources.md` ("Parsing") on loosening, AND each test of a loosened field SHALL name the fixture file that shows the shape.

12.4 EVERY normalised value SHALL be JSON data with no `undefined`, `NaN`, `Infinity`, `-Infinity` or `-0`, times as `Date.prototype.toISOString()` strings, and `null` (never 0) for a value the source does not give.

12.5 EVERY normalised text field SHALL be plain text: tags removed and the entities `&amp; &lt; &gt; &quot; &#39;` and numeric references decoded where the fixture shows markup. Normalisers do not fold text (compilers do).

12.6 THE `fetchedAt` SHALL be `now.toISOString()`, AND no source module SHALL read the clock.

12.7 (added by rule-compilers owner answer 4, 2026-11-11) THE on-this-day normaliser SHALL keep, in each of `events`, `births` and `deaths`, the first 40 entries in the order the response gives them and every later entry that the response's `selected` list also holds (same year and same text), AND each kept `DayEntry` SHALL hold only `year` and `text`. This keeps the boot snapshot small (529,001 bytes before, 118,502 after).

12.7a (owner amendment by hand, 2026-11-11, replaces "the first 40 entries" in 12.7) THE on-this-day normaliser SHALL keep, in each list longer than 40, the entries at positions round(j * (n - 1) / 39) for j = 0..39 of the list as delivered, so that every era the feed lists is represented, plus every other entry that `selected` holds, in the order delivered. Reason: the feed lists the newest years first, so "the first 40" made pages 500 and 501 show only recent decades. Verify: `npm test -- test/sources/wikimedia-onthisday.test.ts`.

## Requirement 13: Per-source rules

13.1 THE `fetchWikimediaFeed` function SHALL request today and yesterday, and SHALL set each of `news`, `mostRead` and `featuredArticle` to today's value when present, else yesterday's, else `null`. It SHALL succeed when at least one day parses, and fail with today's failure when neither does.

13.2 THE `parseOpenMeteo` function SHALL fail unless the array has 24 elements and each element's latitude and longitude are within 0.5 degrees of the city at the same position in `CITIES`.

13.3 THE `fetchFrankfurter` function SHALL succeed only when both the latest and the series request parse, AND each series SHALL be sorted by date ascending, in the order of `SERIES_SYMBOLS` (EUR, GBP, JPY, KRW, CNY, INR).

13.4 THE `fetchHackerNews` function SHALL request the three id lists with `retry: true`, take the first 12 ids of each, request each distinct id once with `retry: false` and at most 6 item requests in flight, skip items that are null, deleted, dead, fail or do not parse, keep list order, and fail only when an id list fails.

13.5 THE `fetchLaunchLibrary` function SHALL make one request with `retry: false`. Every other request uses `retry: true`, except Hacker News items (13.4).

## Requirement 14: Schedule data

14.1 THE module `src/sources/schedule.ts` SHALL export `SCHEDULE` with `intervalMs`, `staleAfterMs = 2 × intervalMs` and `retry` per SourceId as in `design.md`, "Schedule", and `JITTER_FRACTION = 0.1`. It contains no timer.

14.2 THE function `isStale(source, lastGoodAt, now)` SHALL return true exactly when `now - lastGoodAt > SCHEDULE[source].staleAfterMs`.

## Requirement 15: Snapshot

**User story:** As the server, I want one checked file with every source's last good data, so that every page compiles at boot before any fetch.

15.1 THE module `src/sources/snapshot.ts` SHALL export the zod schema and type `Snapshot`: `{ version: 1, sources }` with one `{ fetchedAt, value }` entry per SourceId, each value checked by its normalised schema.

15.2 THE function `parseSnapshot(value: unknown)` SHALL return `{ ok: true, snapshot }` or `{ ok: false, issuePaths }` and never throw.

15.3 FOR every valid Snapshot s, `parseSnapshot(JSON.parse(JSON.stringify(s)))` SHALL succeed with a value that deep-equals s.

15.4 THE file `src/sources/snapshot/snapshot.json` SHALL parse with `parseSnapshot` and equal, byte for byte, the output of `buildSnapshot` on the committed fixtures.

## Requirement 16: Scripts

16.1 THE script `scripts/record-fixtures.ts` SHALL, for each source, read the clock once (`now`), send the requests of `sourceRequests(source, now)` (and for Hacker News the item requests of 13.4) through the real client, and write each raw body exactly as received plus its `.meta.json` (`url`, `fetchedAt`, `status`, `query`) under the names in `design.md`, "Fixture files". The first `fetchedAt` of a source equals `now`.

16.2 THE script `scripts/record-fixtures.ts` SHALL print each failed request and exit non-zero if any failed, AND SHALL print which of the featured keys each featured day contains.

16.3 THE script `scripts/refresh-snapshot.ts` SHALL build the snapshot by replaying, for each source, its newest fixture set that gives `ok` through the same `fetchX` with a fetch that serves recorded bodies by URL and rejects any other URL, with `now` = that set's earliest `fetchedAt`; validate it with `parseSnapshot`; and write it with 2-space indentation and one final LF. It SHALL make no network request.

16.4 THE synthetic fixtures SHALL have the form `{ "comment": "<real shape imitated>", "body": <response> }`.

## Requirement 17: Boundaries and determinism

17.1 THE `.ts` files in `src/pages` SHALL import only `src/pages`, `src/grid`, `src/markup` and, type-only, `src/sources/source-id.ts`. THE `.ts` files in `src/sources` SHALL import only `src/sources` and `zod`. No file in `src/` SHALL import from `scripts/`, `tools/` or `test/`.

17.2 THE `.ts` files in `src/pages` and `src/sources` SHALL not contain `Date.now`, `new Date()` with no argument, `Math.random`, `process`, `globalThis` or a call to a global `fetch`.

## Requirement 18: Tests and gate

18.1 THE test suite SHALL contain one fast-check test per property in `design.md`, named `Property N:`, AND every source schema SHALL have a test against each of its recorded fixtures.

18.2 THE tests SHALL make no network request (HTTP tests use a fake `fetch` and `delay`), call the real validator, parser and schemas (`tech.md`, rule 4), and not edit recorded fixtures.

18.3 WHEN the feature is complete, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` SHALL each exit 0, with grid-core requirement 20.2 kept as amended by Departure 3.
