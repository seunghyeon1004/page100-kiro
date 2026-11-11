# rule-compilers: requirements

Spec for `src/compilers`: the shared formatters, text fitting, content builder, mosaic drawing and moon calculation, one deterministic compiler per page or page family, `compileAll`, the three placeholder files in `pages/`, and `scripts/grid-check.ts`. Contracts: `editorial.md` (formatting, fitting, voice, numbers), `grid-rules.md` (cells, mosaics, repertoire, folding), `product.md` (page map), `frontend.md` ("Text alternative"), and the pages-and-sources design (page model, registry, frame, normalised types, snapshot). This spec does not restate them; it fixes what they leave open.

## Glossary

- **Compiler**: a pure function from source data and `now` to a `CompileResult` (requirement 7). **Page family**: 111 to 118, or 400 to 402.
- **CompiledPage**, **Subpage**, **AltBlock**, **PageDef**, **REGISTRY**, **Snapshot**, **ValidContent**: as in pages-and-sources and grid-core.
- **SourceEntry<S>**: `Snapshot["sources"][S]`, a source's `{ fetchedAt, value }`.
- **No-data page**: a valid one-subpage page that says plainly that the page has no data yet (design, "No-data page").
- **Slot**: one piece of source text that the editor shortens, with a mode, a row limit and a width (requirement 8).
- **Hostile data**: values that pass the normalised schemas but stress layout: very long words and names, empty lists, negative, zero and extreme finite numbers, and text that does not fold.
- **Number token**: a match of `\d+(?:[.,]\d+)*` (`editorial.md`, "Numeric fidelity check").

## Departures

1. **Imports of `src/pages`.** `structure.md` lets `src/compilers` import `src/grid`, `src/markup` and `src/sources` types. Compilers also import `src/pages` (types, `REGISTRY`, `checkAltAgreement`, `checkCompiledPage`, `buildScreen`, `formatUtcTime`), as pages-and-sources Departure 4 foresaw.
2. **A fourth argument to `compileAll`.** The request names `compileAll(snapshot, status, now)`. Compilers read no files, so the text of `pages/800.page`, `801.page` and `899.page` is passed in as `pageFiles`. The server spec and `grid:check` read the files.
3. **Implausible values shown as `n/a`.** `editorial.md` uses `n/a` only for missing values. A value outside the plausible range for its kind (design, "Formatters") is also shown as `n/a`, so every column has a fixed maximum width and hostile data cannot push a page over 40 cells.
4. **Scripts list.** grid-core 1.2 and pages-and-sources 1.4 fix the exact `package.json` scripts. This spec adds `grid:check` (already named in `tech.md`), and `test/scaffold.test.ts` checks the new list.

## Decisions where steering is silent

- Precipitation probability (page 201) uses the moon illumination format, integer `%`.
- On-this-day pages show their data's calendar day as `DD Mon` (`11 Nov`): the entries span many years, so no weekday or year applies.
- Page numbers in content (index, `Page 110`) and counts and ranks derived from data are numbers from data for the purpose of `editorial.md`; the design lists every derived value per page.
- Pages 111 to 118 have no headline: a lead paragraph (the story text) and a background paragraph (the article extract), both fitted as body text. Headline rules apply on page 110 only.
- Hacker News and Wikipedia titles are names: they are wrapped, never shortened, and dropped when they do not fit.
- Times and dates in content are UTC; a content time always has `UTC` in its row or its column header.

## Requirement 1: Project changes and boundaries

**User story:** As a reviewer, I want the compilers' boundaries checked by tests, so that they stay pure.

1.1 THE `package.json` scripts SHALL be exactly the five grid-core scripts plus `"grid:check": "tsx scripts/grid-check.ts"`, AND `test/scaffold.test.ts` SHALL check that list exactly.

1.2 THE `.ts` files in `src/compilers` SHALL import only `src/compilers`, `src/grid`, `src/markup`, `src/pages`, and with `import type` only, `src/sources`. They import no package and no `node:` module.

1.3 THE `.ts` files in `src/compilers` SHALL not contain `Date.now`, `new Date()` with no argument, `Math.random`, `process`, `globalThis`, `fetch(` or `@anthropic-ai/sdk`.

1.4 THE `.ts` files in `src/compilers` other than `format.ts` SHALL not contain `toFixed(`, `toPrecision(`, `toLocaleString(` or `Intl.`. No file in `src/grid`, `src/markup`, `src/pages` or `src/sources` SHALL import `src/compilers`.

## Requirement 2: Formatters

**User story:** As a reader, I want every number written one way, so that pages are consistent and checkable.

2.1 THE module `src/compilers/format.ts` SHALL export the formatters in the design table "Formatters", one per row of the `editorial.md` "Numbers and units" table plus `formatCalendarDate`, `formatDayMonth` and `formatTimeUtc`, with the inputs given there. Each returns a string and none throws.

2.2 IF the value is `null`, `NaN`, `Infinity`, `-Infinity`, an invalid time or date, or outside the kind's plausible range in the design table, THEN the formatter SHALL return `n/a`.

2.3 THE formatters SHALL round half away from zero on the exact binary value, to the precision in `editorial.md` only, AND a result that prints as zero SHALL have no sign (`-0.4` gives `0°C`; a change of `-0.001` gives `0.00%`).

2.4 THE formatters SHALL give: `12400` → `12,400`; `-3` → `-3°C`; `22.4` → `22 km/h`; `3.45` → `3.5 mm`; `0.92131` → `0.9213`; `151.271` → `151.27`; `1382.4` → `1,382`; `9.99996` → `10.00`; `0.1549` → `+0.15%`; `-1.024` → `-1.02%`; `5.25` → `M5.3`; `10.2` → `10 km`; `86.5` → `87%`; `-44` → `44 BC`; `1066` → `1066`; `2026-11-11T14:05:09Z` → `14:05`, `14:05 UTC` and `Wed 11 Nov`; calendar date `2026-11-11` → `Wed 11 Nov` and `11 Nov 2026`; month 11, day 11 → `11 Nov`.

2.5 THE rate formatter SHALL choose 4, 2 or 0 decimals by the band of the printed value, so that no rate prints as `10.0000` or `1,000.00`.

2.6 THE `formatTimeUtc` export SHALL be `formatUtcTime` from `src/pages/frame-time.ts`, so content and row 22 print times the same way.

2.7 FOR every input, each formatter's output SHALL be at most its maximum width in the design table and SHALL match that row's pattern.

## Requirement 3: Fitting text

**User story:** As a compiler author, I want one implementation of the fitting rules, so that no page cuts a word or leaves a number before `...`.

3.1 THE module `src/compilers/fit-text.ts` SHALL export `wrapWords(text, width, maxRows)`, `fitHeadline(text, width, maxRows)` and `fitBody(text, width, maxRows)`, each returning `{ ok: true, rows }` with 1 to `maxRows` rows or `{ ok: false, reason }` with reason `empty`, `word-too-long` or `too-long`. None throws.

3.2 THE functions SHALL collapse runs of spaces to one and trim the text, AND no output row SHALL start or end with a space or exceed `width` code points.

3.3 THE functions SHALL break rows only at spaces or directly after a hyphen already inside a word (`well-known` may become `well-` and `known`), SHALL never insert a hyphen, and SHALL fill each row with as many words as fit before starting the next.

3.4 IF a word, or a hyphen-ended part of one, is longer than `width`, THEN the functions SHALL return `word-too-long` (the caller drops the item, `editorial.md`).

3.5 THE function `fitHeadline` SHALL remove one leading `A `, `An ` or `The ` and one final `.`, and SHALL succeed only when the whole remaining text fits; it SHALL never add `...`.

3.6 THE function `fitBody` SHALL keep the longest run of whole leading sentences that fits (sentence rule in the design), AND WHEN the first sentence alone does not fit, SHALL keep the longest run of its leading words that fits with `...` joined to the last word, then apply 3.7.

3.7 WHILE the last word before `...` contains a digit, is a spelled-out number from `editorial.md`, or is a unit word from the design list, THE function `fitBody` SHALL remove that word, then strip `, ; : ( - " '` from the end of the new last word; IF no word is left, THEN it SHALL return `too-long`. Examples (width, 1 row): `Quake kills 40 people in the north` at 20 gives `Quake kills...`; `Rates rise 2 per cent on Monday` at 15 gives `Rates rise...`; `Lava flows 3 km from the summit` at 18 gives `Lava flows...`.

3.8 THE function `wrapWords` SHALL succeed only when the whole text fits, and SHALL change no word.

## Requirement 4: Content builder

**User story:** As a compiler author, I want grid and text alternative written by the same calls, so that they cannot drift apart.

4.1 THE module `src/compilers/content-builder.ts` SHALL export `createContentBuilder()`, whose writers place text, markup lines and mosaic cells on content rows 0 to 19 and whose block helpers (heading, lines, list item, table, link, concealed) write cells and append the matching `AltBlock` in the same call (API in the design).

4.2 IF a write would place a cell outside rows 0 to 19 or columns 0 to 39, THEN THE builder SHALL record `out-of-bounds` at the first such cell and write nothing for that call. It SHALL never truncate.

4.3 IF a write touches a cell that an earlier write set, THEN THE builder SHALL record `overlap` at that cell.

4.4 IF text contains a code point outside the repertoire, THEN THE builder SHALL record `not-repertoire` with the code point. The builder does not fold text.

4.5 THE `markup(row, line)` writer SHALL parse the line with `parseContent` and record each `MarkupError` at the builder's row.

4.6 THE `build()` method SHALL return `{ ok: true, subpage }` only when no problem was recorded, `validateContentRows` succeeds on the 20 rows (unwritten cells blank), at least one `AltBlock` exists and `checkAltAgreement` succeeds; otherwise `{ ok: false, problems }` with every recorded problem, violation and missing word.

4.7 EVERY builder problem SHALL carry a page row (content row + 2), a column or `null`, a code and a message, AND the builder SHALL never throw.

## Requirement 5: Mosaic canvas and drawings

**User story:** As a page designer, I want charts, symbols, the moon and block letters drawn on one pixel canvas, so that every mosaic follows the bit rules in `grid-rules.md`.

5.1 THE module `src/compilers/mosaic-canvas.ts` SHALL export `createCanvas(cols, rows)` (2 × cols by 3 × rows pixels, all off), `canvasToCells(canvas, style)` and `cellsToCanvas(cells)`. Setting a pixel outside the canvas does nothing.

5.2 THE function `canvasToCells` SHALL give each cell the bits of its six pixels by the `grid-rules.md` numbering, a mosaic cell when the bits are 1 to 63 and a text space with the style's colours when they are 0.

5.3 THE module `src/compilers/chart.ts` SHALL export `lineChart(values, cols, rows)` and `rangeBars(ranges, cols, rows)`, scaling non-null values linearly so the largest is on the top pixel row and the smallest on the bottom one (all equal: the middle row), leaving gaps for `null`, and drawing a continuous line between consecutive points.

5.4 THE module `src/compilers/weather-symbol.ts` SHALL map a WMO weather code to `clear`, `cloud`, `rain`, `snow`, `storm`, `fog` or `null` by the design table, and draw each of the six as the 6 × 6 pixel bitmap in the design.

5.5 THE module `src/compilers/moon-disc.ts` SHALL draw an 8 × 6 cell disc lit by the design formula for an illuminated fraction (clamped to 0 to 1) and a waxing flag: fraction 0 lights no pixel, fraction 1 lights every disc pixel, waxing lights the right side.

5.6 THE module `src/compilers/block-font.ts` SHALL draw text of `A` to `Z`, `0` to `9` and space as 5 × 7 pixel glyphs with 1 pixel between glyphs on a canvas 3 cells high, AND SHALL return `undefined` for any other character.

## Requirement 6: Moon calculation

**User story:** As a reader of page 601, I want the moon's phase and next full and new moon to be correct.

6.1 THE function `moonAt(t)` in `src/compilers/moon.ts` SHALL return `{ illuminated, waxing, phase, nextFull, nextNew }` by the method of Meeus cited in the design, or `undefined` when `t` is invalid or outside 1970-01-01 to 2100-12-31 UTC.

6.2 THE values `nextFull` and `nextNew` SHALL be within 5 minutes of the UT times in the design's known-dates table (Espenak), for each `t` given there.

6.3 THE value `illuminated` SHALL be at least 0.99 at the known full moons, at most 0.01 at the known new moons, and from 0.45 to 0.55 at the known quarters, with `waxing` true at first quarter and false at last quarter.

6.4 THE value `phase` SHALL be one of the eight names in the design, chosen by the design's elongation bands.

## Requirement 7: Compiler contract

**User story:** As the server, I want every compiler to behave the same way, so that one loop can compile every page.

7.1 EACH compiler SHALL return `{ ok: true, page, outcome }` with `outcome` `compiled` or `no-data`, or `{ ok: false, problems }`, and SHALL never throw.

7.2 EACH compiler SHALL be pure: it reads no clock, mutates no input, and equal inputs give deep-equal results.

7.3 THE compiled page SHALL have its PageDef's number, 1 to 9 subpages, `editor` `rules` (`static` for 800, 801 and 899), and `dataAt` equal to `new Date(entry.fetchedAt)` of its source, `now` for 601 and 802, and `null` for 100, the static pages and every no-data page.

7.4 EACH compiler SHALL fold every source text with `foldText` before use, AND SHALL skip an item whose text does not fold as if the source had not given it.

7.5 WHEN the page's source value is `null`, or no item survives folding and fitting, THE compiler SHALL return the no-data page with outcome `no-data`.

7.6 EVERY number token in a compiled page's content rows SHALL be a token of a value that the design table "Numbers per page" lists for that page, formatted by `format.ts`, or a token of source text shown on that page.

7.7 WHERE content shows a time, THE same row or its column header SHALL contain `UTC`.

## Requirement 8: Editor seam

**User story:** As the ai-editor spec, I want the AI pages split at the point where text is shortened, so that a model draft and the rules draft are laid out and checked by the same code.

8.1 THE modules for 110, 111 to 118, 500, 501 and 700 SHALL export `editorialInput(data)`, `rulesDraft(input)` and `assemble(data, rows, now)`, AND their compiler SHALL equal `assemble(data, rulesDraft(editorialInput(data)), now)`.

8.2 THE `editorialInput` SHALL return `{ page, slots, totalRows }`, where each slot has a stable `id`, `mode` (`headline` or `body`), folded `text`, `maxRows` and `width`, in layout order, and `totalRows` bounds the rows of all slots together.

8.3 THE `rulesDraft` SHALL fit each slot with `fitHeadline` or `fitBody`, give a slot that fails zero rows, AND WHEN a slot would take the total past `totalRows`, SHALL give it and every later slot zero rows (the list ends there).

8.4 THE `assemble` SHALL reject, and never trim, rows that break the limits: a slot count different from the input; a slot with more than `maxRows` rows; a row longer than `width` (message `row R is N cells, limit W`, R the page row); a row that is empty, starts or ends with a space, or contains two spaces in a row; a code point outside the repertoire; or more than `totalRows` rows in all.

8.5 WHEN every slot has zero rows, THE `assemble` SHALL return the no-data page.

## Requirement 9: Index (100)

9.1 THE compiler for 100 SHALL draw `PAGE 100` in block letters on content rows 1 to 3 and list the 18 sections of the design table, each as its page number in yellow and a label in white, with one alt link per section to that page.

## Requirement 10: News and Wikipedia (110 to 118, 120, 700)

10.1 THE page 110 SHALL show the feed date as `DD Mon YYYY` and the first eight stories that fold, each with its story page number (111 to 118) and a headline slot of at most 3 rows of 35 cells, as whole items.

10.2 THE page 110 + n (n from 1 to 8) SHALL show story n of 10.1 as a lead slot (body, at most 5 rows of 38 cells) and, from the first linked article whose extract folds, a `Background: <title>` heading when it fits one row and a background slot (body, at most 12 rows of 38). WHEN story n does not exist, it SHALL show the no-story page in the design with outcome `no-data`.

10.3 THE page 120 SHALL list most-read items in source order as rank, title wrapped to at most 2 rows of 25 cells, and views, as whole items.

10.4 THE page 700 SHALL show the featured article's title wrapped to at most 2 rows of 38 cells (left out when it does not fit) and a body slot of at most 16 rows of 38 cells.

## Requirement 11: Weather (200, 201)

11.1 THE page 200 SHALL have four subpages in `REGIONS` order, each listing its six cities in `CITIES` order with weather symbol, name, temperature, wind and condition label, and an alt table with the same values.

11.2 THE page 201 SHALL have one subpage per `OUTLOOK_CITY_IDS` city, in that order, with a range-bar chart of each day's low to high, day labels, and a table of day, condition, high, low and precipitation chance.

## Requirement 12: Exchange rates (300, 301)

12.1 THE page 300 SHALL list the `SERIES_SYMBOLS` currencies in that order with name, code, rate per US dollar and change on the day, where the change is `(latest / previous − 1) × 100` and `previous` is the last series point dated before `Rates.date`, or `n/a` when there is none.

12.2 THE page 301 SHALL have one subpage per `SERIES_SYMBOLS` currency with at least 2 series points, each with a line chart of the points, the first and last dates, and the latest, highest and lowest rates with their dates. WHEN no currency has 2 points, it SHALL show the no-data page.

## Requirement 13: Developer news (400, 401, 402)

13.1 THE pages 400, 401 and 402 SHALL list `top`, `show` and `ask` stories as rank (position in the list, from 1), title wrapped to at most 2 rows of 36 cells, and a row of points and comments (`1 point`, `n/a points`), as whole items. An empty list gives the no-data page.

## Requirement 14: On this day and quiz (500, 501, 550)

14.1 THE pages 500 and 501 SHALL name the data's day with `formatDayMonth`, never the day of `now`.

14.2 THE page 500 SHALL show up to six events chosen by the design's spread rule, each as year and a body slot of at most 3 rows of 32 cells. THE page 501 SHALL show up to four births under `Born` and four deaths under `Died`, each as year and a body slot of at most 2 rows of 32 cells.

14.3 THE page 550 SHALL ask up to five questions, each an event's fitted text without its year and the year concealed, chosen by the design's seeded rule from the UTC date of `now`, AND no year of a question SHALL appear as a number token in any unconcealed cell. Zero eligible events give the no-data page.

## Requirement 15: Earthquakes, moon, launches (600, 601, 610)

15.1 THE page 600 SHALL list quakes in source order as time, magnitude, depth and place (at most 2 rows), as whole items, with a count row when not all fit, AND an empty list SHALL give a compiled page that says no earthquakes are listed.

15.2 THE page 601 SHALL show the phase name, the moon disc, the illuminated percentage and the next full and new moon as date and `HH:MM UTC`, from `moonAt(now)`; `undefined` gives the no-data page.

15.3 THE page 610 SHALL list launches in source order as date, time with `UTC`, status, name (at most 2 rows) and provider and pad, as whole items. An empty list gives the no-data page.

## Requirement 16: Service status (802)

16.1 THE module `src/compilers/service-status.ts` SHALL export the type `ServiceStatus` in the design, which the server supplies.

16.2 THE page 802 SHALL show whether the AI editor is on, model calls used and the cap, drafts accepted and rejected today, and for every registry page its compile time (`HH:MM`, column header with `UTC`) and editor, `n/a` where the status has no entry.

## Requirement 17: Static pages (800, 801, 899)

17.1 THE function `compileStatic(number, text)` SHALL parse the text with `parseContent`, validate it with `validateContentRows`, and return failure with every error when either fails.

17.2 THE alt blocks of a static page SHALL follow the design rule "Static alt" and nothing else.

17.3 THE repository SHALL contain `pages/800.page`, `pages/801.page` and `pages/899.page` as the placeholders in the design, AND a test SHALL compile every file in `pages/` and fail on any name that is not a static page in `REGISTRY`.

## Requirement 18: compileAll

18.1 THE function `compileAll(snapshot, status, now, pageFiles)` SHALL return `{ pages, outcomes }`: one outcome per registry page in registry order (`compiled`, `no-data` or `failed` with problems), and the pages of the first two kinds in ascending number order. It SHALL never throw.

18.2 THE function `compileAll` SHALL report a page as `failed`, and leave it out of `pages`, when its compiler fails or throws, `checkCompiledPage` reports a problem, or `buildScreen` fails for any subpage with `stale` false or true and `lastGoodAt` equal to `dataAt`.

18.3 A failure of one page SHALL not change the outcome of any other page.

## Requirement 19: grid:check

19.1 THE script `scripts/grid-check.ts` SHALL load `src/sources/snapshot/snapshot.json` with `parseSnapshot`, read every `pages/*.page` file, run `compileAll` with `now` equal to the latest `fetchedAt` in the snapshot and the design's check status, and frame and `checkAltAgreement` every subpage.

19.2 THE script SHALL print one line per problem with page, subpage, row and column (or file, row and column for a `.page` file) and exit 1 when there is any problem or `failed` outcome, else print a summary and exit 0. It makes no network request.

## Requirement 20: Tests and gate

20.1 THE test suite SHALL contain one fast-check test per property in `design.md`, named `Property N:`, AND tests SHALL call the real formatters, builder, validators, parser, frame builder and alt checker (`tech.md`, rule 4) and make no network request.

20.2 WHEN the feature is complete, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run grid:check` SHALL each exit 0.
