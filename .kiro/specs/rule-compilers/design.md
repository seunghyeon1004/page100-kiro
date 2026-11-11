# rule-compilers: design

Requirements: `requirements.md`. Contracts: `editorial.md`, `grid-rules.md`, `product.md`, `frontend.md`, and the pages-and-sources design ("Types", "Registry", "Cities", "Normalised types", "Alt agreement"). Existing code used: `foldText`, `validateContentRows`, `parseContent`, `serialiseContent`, `mosaicCodePoint`, `isRepertoireCodePoint`, `BLANK_CELL`, `toNonEmpty`; from pages-and-sources: `REGISTRY`, `findPage`, `buildScreen`, `checkAltAgreement`, `checkCompiledPage`, `formatUtcTime`, `CITIES`, `REGIONS`, `OUTLOOK_CITY_IDS`, `SERIES_SYMBOLS` (from `src/sources/source-requests.ts`), `parseSnapshot`. Names as in the code: `NonEmpty` is in `src/grid/types.ts`, `toNonEmpty` in `src/grid/non-empty.ts`, `checkCompiledPage` returns `CompiledProblem[]` (codes `number`, `subpage-count`, `editor`, `table-width`, `alt-missing`), `Launch` has `rocket`, `mission`, `net`, `status` and no provider or pad.

## Overview

```
Snapshot ─┬─> compileNNN(data)     ─────────────────────────────┐   (rules pages)
          └─> editorialInput(data) ─> rulesDraft ─> assemble(data, rows) ─┤   (ai pages; ai-editor spec swaps rulesDraft)
ServiceStatus ─> compile802 ────────────────────────────────────┤
pageFiles (text of pages/*.page) ─> compileStatic ──────────────┤
                                                                 v
              format.ts, fit-text.ts, content-builder.ts ─> CompileResult { page: CompiledPage, outcome }
                                                                 │
compileAll(snapshot, status, now, pageFiles) ─> checkCompiledPage + buildScreen per subpage ─> { pages, outcomes }
scripts/grid-check.ts ─> snapshot.json + pages/*.page ─> compileAll ─> report, exit code
```

Everything in `src/compilers` is pure and synchronous. Only `scripts/grid-check.ts` reads files.

## Files

| File | Exports |
|---|---|
| `compile-types.ts` | `SourceEntry`, `Outcome`, `CompileResult`, `CompileProblem`, `CompileProblemCode`, `PageFiles` |
| `format.ts` | the formatters below |
| `fit-text.ts` | `wrapWords`, `fitHeadline`, `fitBody`, `FitResult`, `UNIT_WORDS`, `NUMBER_WORDS` |
| `content-builder.ts` | `createContentBuilder`, `ContentBuilder`, `CellStyle`, `Column` |
| `mosaic-canvas.ts`, `chart.ts`, `weather-symbol.ts`, `moon-disc.ts`, `block-font.ts` | requirement 5 |
| `moon.ts` | `moonAt`, `MoonState`, `PhaseName` |
| `editorial-input.ts` | `EditorialSlot`, `EditorialInput`, `DraftRows`, `rulesDraft`, `checkDraft` (shared by every `assemble`) |
| `city-data.ts`, `currency-names.ts`, `day-entries.ts`, `news-stories.ts`, `compile-helpers.ts`, `cell-style.ts` | lists and small helpers the page modules share: `CITY_LIST`, `REGION_LIST`, `OUTLOOK_IDS`, `SERIES_CODES` (copies of the `src/sources` lists, checked by a test, because compilers import `src/sources` for types only), currency names, on-this-day selection, news selection, `finishPage` and the colour styles |
| `pick-spread.ts` | `pickSpread(n, k)` |
| `no-data-page.ts` | `noDataPage(number, kind: "no-data" \| "no-story")` |
| `service-status.ts` | `ServiceStatus` |
| `p100-index.ts` `p110-news-index.ts` `p111-news-story.ts` `p120-most-read.ts` `p200-weather-now.ts` `p201-outlook.ts` `p300-rates.ts` `p301-rate-trend.ts` `p400-developer-news.ts` `p500-on-this-day.ts` `p501-births-deaths.ts` `p550-quiz.ts` `p600-earthquakes.ts` `p601-moon.ts` `p610-launches.ts` `p700-featured-article.ts` `p802-service-status.ts` | one compiler each (`compile100`, ...); the five ai modules also export `editorialInput`, `rulesDraft` (re-export) and `assemble` |
| `static-page.ts` | `compileStatic` |
| `compile-all.ts` | `compileAll`, `PageOutcome`, `CompileAllResult` |
| `scripts/grid-check.ts`, `scripts/lib/check-status.ts` | entry point; `CHECK_STATUS(now)` |
| `pages/666.page`, `800.page`, `801.page`, `899.page` | placeholders |

Data arguments (a compiler takes `now` only where its page uses it, so that no parameter is unused): `compile100()`; `compile601(now)`; `compile802(status, now)`; `compileStory({ entry, story })` for 111 to 118 (`story` 1 to 8); `compileHn({ entry, list })` for 400 to 402 (`list` `top`, `show` or `ask`); every other compiler takes its `SourceEntry` (`wikimedia-feed` for 110, 120, 700; `wikimedia-onthisday` for 500, 501 (550 also takes `now`, for its seed); and so on).

## Types

```ts
type SourceEntry<S extends SourceId> = Snapshot["sources"][S];
type Outcome = "compiled" | "no-data";
type CompileResult =
  | { readonly ok: true; readonly page: CompiledPage; readonly outcome: Outcome }
  | { readonly ok: false; readonly problems: NonEmpty<CompileProblem> };
type CompileProblemCode =
  | "out-of-bounds" | "overlap" | "not-repertoire" | "markup" | "grid" | "alt-empty" | "alt-missing"   // builder, static pages
  | "slot-count" | "slot-rows" | "row-width" | "row-space" | "total-rows"                              // assemble
  | "page-check" | "frame" | "threw";                                                                 // compileAll
interface CompileProblem {
  readonly code: CompileProblemCode; readonly subpage: number | null; // 0-based
  readonly row: number | null; readonly col: number | null;           // page row, cell
  readonly message: string;
}
type PageFiles = { readonly [N in 666 | 800 | 801 | 899]: string };
interface ServiceStatus {
  readonly aiEditor: boolean;                                            // false when no API key
  readonly modelCalls: { readonly used: number; readonly cap: number };
  readonly drafts: { readonly accepted: number; readonly rejected: number };
  readonly pages: readonly { readonly number: number; readonly compiledAt: Date | null; readonly editor: EditorKind }[];
}
interface EditorialSlot { readonly id: string; readonly mode: "headline" | "body"; readonly text: string; readonly maxRows: number; readonly width: number }
interface EditorialInput { readonly page: number; readonly slots: readonly EditorialSlot[]; readonly totalRows: number }
type DraftRows = readonly (readonly string[])[];  // one array per slot, in slot order; [] omits the slot
type FitResult = { readonly ok: true; readonly rows: NonEmpty<string> } | { readonly ok: false; readonly reason: "empty" | "word-too-long" | "too-long" };
type PageOutcome =
  | { readonly number: number; readonly outcome: Outcome }
  | { readonly number: number; readonly outcome: "failed"; readonly problems: NonEmpty<CompileProblem> };
interface CompileAllResult { readonly pages: readonly CompiledPage[]; readonly outcomes: readonly PageOutcome[] }
```

Slot ids: `story-1` to `story-8` (110); `lead`, `background` (111 to 118); `event-1` to `event-6` (500); `born-1` to `born-4`, `died-1` to `died-4` (501); `body` (700).

## Formatters

Inputs are `number | null`; time formatters take an ISO string, a `Date` or `null`; `formatCalendarDate` and `formatFullDate` take `YYYY-MM-DD`. Out of range, `null`, non-finite or invalid gives `n/a` (Departure 3). The range is tested on the raw value and again on the rounded one. Rounding: `Math.abs(x).toFixed(d)`, which rounds the exact binary value with ties up, then the sign, dropped when every digit is 0. Thousands commas go on the integer part only.

| Function | Range | Example | Max width |
|---|---|---|---|
| `formatInteger(n, max)` | 0 to `max` (`max` at most 99,999,999), rounded | `12,400` | width of `max` |
| `formatTemperature` | -100 to 100 | `-3°C` | 6 |
| `formatWind` | 0 to 999 | `22 km/h` | 8 |
| `formatPrecipitation` | 0 to 999 | `3.5 mm` | 8 |
| `formatRate` | over 0, under 999,999.5 (so rounding never prints 1,000,000); 4 decimals when the 4-decimal print is under 10, else 2 when the 2-decimal print is under 1,000, else 0 | `0.9213` | 7 |
| `formatChange` | -999.99 to 999.99 | `+0.15%` | 8 |
| `formatMagnitude` | -2 to 10 | `M5.2` | 5 |
| `formatKm` | -100 to 1,000 | `10 km` | 8 |
| `formatPercent` | 0 to 100 | `87%` | 4 |
| `formatTime`, `formatTimeUtc` | year 1970 to 2199 | `14:05`, `14:05 UTC` | 5, 9 |
| `formatDate`, `formatCalendarDate` | as above | `Wed 11 Nov` | 10 |
| `formatFullDate` | as above | `11 Nov 2026` | 11 |
| `formatDayMonth(month, day)` | a real day of a leap year | `11 Nov` | 6 |
| `formatYear` | integers -9,999 to 9,999 except 0 | `1066`, `44 BC` | 7 |

Each row's pattern for Property 10 is the example with digits generalised (`^[+-]?\d{1,3}(,\d{3})*\.\d{2}%$` for `formatChange`, and so on). `formatTimeUtc` is `formatUtcTime` (requirement 2.6); the others use `getUTC*` getters and the `editorial.md` abbreviations.

## Fitting

- Normalise: split on U+0020, drop empty words. A word may split after any of its internal hyphens; each part keeps its hyphen.
- `wrapWords`: greedy. Put the next word on the current row if it fits after one space; else put its longest hyphen-ended prefix that fits there; else start a new row. A part longer than `width` gives `word-too-long`; more than `maxRows` rows gives `too-long`.
- Sentences: a sentence ends after a word ending in `.`, `?` or `!` (optionally followed by `"` or `'`) when the next word starts with an upper-case letter, a digit or a quote, unless the word is a single letter plus `.` (`J.`), contains another `.` (`U.S.`), or is one of `Mr. Mrs. Ms. Dr. St. Mt. Jr. Sr. No. vs.`.
- `fitBody`: try sentence prefixes from longest to shortest with `wrapWords`; then word prefixes of the first sentence with `...` joined to the last word, longest first, applying requirement 3.7 to each candidate and keeping the first that fits.
- `fitHeadline` makes the first letter upper case after removing an article (sentence case, `editorial.md`); the other functions change no letter.
- `UNIT_WORDS`: `km km/h mm cm m kg t °C °F % mph ft mi per cent percent` (`per` and `cent` are listed singly so that `Rates rise 2 per...` also loses `per`). `NUMBER_WORDS`: `one` to `twenty`, `dozen hundred thousand million billion` (`editorial.md`). Both compared in lower case after stripping trailing `, ; :`.

## Content builder

```ts
interface CellStyle { readonly fg: Colour; readonly bg: Colour; readonly conceal?: boolean } // default white on black
interface Column { readonly header: string; readonly col: number; readonly width: number; readonly align: "left" | "right"; readonly style: CellStyle }
interface ContentBuilder {
  text(row: number, col: number, text: string, style?: CellStyle): void;      // grid only
  markup(row: number, line: string): void;                                     // grid only
  cells(row: number, col: number, cells: Rows): void;                          // mosaics from canvasToCells
  alt(block: AltBlock): void;                                                  // alt only
  heading(row: number, col: number, text: string, style?: CellStyle, level?: 2 | 3): void;
  lines(row: number, col: number, rows: readonly string[], style?: CellStyle): void; // one paragraph
  table(row: number, columns: NonEmpty<Column>, records: readonly (readonly (string | readonly string[])[])[], headerRow: boolean): number; // rows used
  link(row: number, col: number, parts: readonly (readonly [string, CellStyle])[], target: LinkTarget): void;
  concealed(row: number, col: number, label: readonly [string, CellStyle], value: readonly [string, CellStyle], summary: string): void;
  build(): { readonly ok: true; readonly subpage: Subpage } | { readonly ok: false; readonly problems: NonEmpty<CompileProblem> };
}
```

`lines` joins rows with one space, or with nothing after a row ending in `-` that `wrapWords` split. A table record cell may be several rows; a record's height is its tallest cell, and its alt row joins each cell's rows the same way. Right-aligned cells end at `col + width - 1`. Text wider than its column is an `out-of-bounds` problem, never cut. `build` checks in this order: recorded problems, `validateContentRows`, `alt-empty`, `checkAltAgreement`.

## Drawing

- Canvas pixels are `boolean[3 * rows][2 * cols]`. Cell (r, c) takes pixels x = 2c..2c+1, y = 3r..3r+2; bit k is set for pixel (2c + k mod 2, 3r + floor(k / 2)). A cell with bits 0 is `{ kind: "text", ch: " ", fg, bg, conceal: false }`.
- `lineChart(values, cols, rows)`: W = 2 cols, H = 3 rows. Point i of n is at x = round(i (W - 1) / (n - 1)) (x = 0 when n = 1), y = round((max - v) (H - 1) / (max - min)), or floor((H - 1) / 2) when max = min. Consecutive non-null points are joined by filling every pixel of x between them from the earlier y to the later y.
- `rangeBars(ranges, cols, rows)`: bar i of n covers x from floor(i W / n) + 1 to floor((i + 1) W / n) - 2 and y from the scaled high to the scaled low (same scale over all highs and lows).
- WMO codes: 0, 1 `clear`; 2, 3 `cloud`; 45, 48 `fog`; 51 to 57, 61 to 67, 80 to 82 `rain`; 71 to 77, 85, 86 `snow`; 95 to 99 `storm`; anything else `null`. Labels: `Clear`, `Cloudy`, `Fog`, `Rain`, `Snow`, `Storm`, `n/a`.
- Symbols, 6 × 6 pixels (`#` on, rows top to bottom), drawn as 3 × 2 cells: clear (yellow) `..##../.####./######/######/.####./..##..`; cloud (white) `....../..##../.####./######/######/......`; rain (cyan) `.####./######/....../#.#.#./.#.#.#/#.#.#.`; snow (white) `.####./######/....../#..#../..#..#/#..#..`; storm (yellow) `.####./######/...#../..##../.##.../.#....`; fog (white) `######/....../######/....../######/......`.
- Moon disc: 8 × 6 cells (16 × 18 pixels). Pixel (x, y) has u = (x + 0.5 - 8) / 7.5 and v = (y + 0.5 - 9) / 9 (equal radii on a 4:3 screen), is on the disc when u² + v² ≤ 1, and is lit when, with s = (1 - 2f) √(1 - v²), u > s (waxing) or u < -s (waning). White.
- Block font: `GLYPHS` maps each of the 36 characters to 7 strings of 5 `#`/`.`; space is 5 columns off. Glyph n starts at x = 6n, y = 1, on a canvas of 3 rows.

## Moon

Jean Meeus, *Astronomical Algorithms*, 2nd ed., Willmann-Bell, 1998. ΔT is ignored (under 2 minutes in 1970 to 2050); the tolerance in requirement 6.2 covers it.

- JD = ms / 86,400,000 + 2,440,587.5; T = (JD - 2,451,545) / 36,525. D, M, M' from eq. 47.2 to 47.4. Phase angle i from eq. 48.4; illuminated = (1 + cos i) / 2 (eq. 48.1). Elongation e = (180° - i) mod 360°; `waxing` = e < 180°.
- Phase names by e: `New moon` under 22.5° or from 337.5°; then every 45°: `Waxing crescent`, `First quarter`, `Waxing gibbous`, `Full moon`, `Waning gibbous`, `Last quarter`, `Waning crescent`.
- Next new and full moon: chapter 49, eq. 49.1 with k from (year - 2000) × 12.3685, the new and full moon corrections and the 14 additional corrections. Start one lunation before t and step k by 1 (full: k + 0.5) until the instant is after t.

Known dates (UT, F. Espenak, "Phases of the Moon: 2001 to 2100", astropixels.com/ephemeris/phasescat/phases2001.html, read 2026-11-11):

| t | Expected |
|---|---|
| 2001-01-20T00:00Z | next new 2001-01-24 13:07 |
| 2024-04-01T00:00Z | next new 2024-04-08 18:21, next full 2024-04-23 23:49 |
| 2025-01-07T00:00Z | next full 2025-01-13 22:27, next new 2025-01-29 12:36 |
| 2026-11-11T14:05:09Z | next full 2026-11-24 14:53, next new 2026-12-09 00:52 |
| quarters | first 2026-11-17 11:48 (waxing), last 2026-12-01 06:09 (waning) |

## Page layouts

Content rows r0 to r19 are page rows 2 to 21. Text starts at col 1 unless given. "Whole items" means an item is placed only when all its rows fit before r20 (or the row given); the list ends at the first one that does not. Headings yellow, column headers cyan, values white unless given.

| Page | Layout |
|---|---|
| 100 | r1-r3 `PAGE 100` block letters, yellow, cols 8-31. r5-r13 two columns, column-major: number yellow at col 1 / 21, label at col 5 / 25: 110 World news, 120 Most read, 200 Weather now, 201 Outlook, 300 Exchange rates, 301 Rate trend, 400 Developer news, 500 On this day, 501 Born and died; 550 Quiz, 600 Earthquakes, 601 The moon, 610 Launches, 700 Article, 800 Help, 801 About, 802 Status, 899 Test page. r15-r16 `Type a page number, or use the` / `coloured links below.` Alt: paragraph `Page 100`, a link per entry (`110 World news`), the r15-r16 paragraph. |
| 110 | r0 `Top stories, ` + `formatFullDate(date)`. From r2, whole items: `111`... yellow cols 1-3, headline cols 5-39. `totalRows` 18. Alt: heading, one link per story to its page. |
| 111-118 | r0 lead (5 × 38). Blank row. `Background: <title>` cyan when it fits 38. Background (12 × 38). `totalRows` 17. Alt: paragraph, heading (level 3), paragraph, link `Read on Wikipedia: <title>` to the article URL when not null. |
| 120 | r0 `Article` col 4, `Views` ending col 39. From r1, whole items: rank yellow ending col 2 (`formatInteger(rank, 999)`), title cols 4-28 (2 rows), views ending col 39 (`max` 99,999,999). Alt: table Rank, Article, Views. |
| 200 | Subpage per region. r0 region name. r1 `City` col 5, `Temp` ending col 28, `Wind` ending col 38. City k: r(2+3k) symbol cols 1-3 over two rows, name col 5, temperature, wind; r(3+3k) condition label cyan col 5. Alt: heading, table City, Weather, Temperature, Wind. |
| 201 | Subpage per outlook city. r0 city name. r1-r8 range bars, yellow, cols 7-38; highest high ending col 5 on r1, lowest low on r8. r9 weekday (first 3 characters of `formatCalendarDate`) centred under each bar. r11 `Day` col 1, `Weather` col 12, `High` ending 26, `Low` ending 33, `Rain` ending 39. r12-r16 one row per day. Alt: heading, table Day, Weather, High, Low, Rain. |
| 300 | r0 `Rates per US dollar, ` + `formatFullDate(date)`. r2 `Currency` col 1, `Code` col 20, `Rate` ending 30, `Change` ending 39. r3-r8 one currency each; change green when it prints with `+`, red with `-`, else white. r10 `Other rates` cyan. r11-r15 the ten other codes, column-major, five per column: code yellow at col 1 / 21, rate ending col 11 / 31. r17-r18 `Change is against the previous ECB` / `reference date in the series.` Names: Euro, Pound sterling, Japanese yen, South Korean won, Chinese yuan, Indian rupee; other codes AUD Australian dollar, CAD Canadian dollar, CHF Swiss franc, SEK Swedish krona, NOK Norwegian krone, MXN Mexican peso, BRL Brazilian real, SGD Singapore dollar, HKD Hong Kong dollar, ZAR South African rand. A code that `Rates.rates` lacks is left out, and the block ends early. Alt: heading, table (Currency, Code, Rate, Change), heading `Other rates`, table (Currency, Code, Rate), paragraph. |
| 301 | Subpage per currency. r0 `<name> (<code>) per US dollar`. r1-r12 line chart, cyan, cols 8-39; highest rate ending col 6 on r1, lowest on r12. r13 first date col 8, last date ending col 39. r15-r17 `Latest`, `Highest`, `Lowest` col 1, rate ending col 17, `formatCalendarDate` col 19 (earliest date on ties). Alt: heading, a paragraph per r15-r17 row, table Date, Rate of every point. |
| 400-402 | From r0, whole items: rank yellow ending col 1 (`max` 99), title cols 3-38 (2 rows), then cyan col 3 `<n> points, <n> comments` (`max` 999,999; `1 point`, `1 comment`). Alt: list, one item per story (`1 Title, 12 points, 3 comments`). |
| 500 | r0 `Events on ` + `formatDayMonth`. From r2, packed: year yellow ending col 6, text cols 8-39 (3 rows). `totalRows` 18. Alt: heading, list `<year>: <text>`. |
| 501 | r0 `Born on <day>`; r1-r8 births, packed; r10 `Died on <day>`; r11-r18 deaths. Year ending col 6, text cols 8-39 (2 rows). `totalRows` 16. Alt: two headings and two lists. |
| 550 | r0 `In which year did each of these happen?`. Question k (0 to 4) from r(2+3k): `k+1` yellow col 1, text cols 3-39 (2 rows, `fitBody`), then on the next row `Year:` cyan col 3 and the year concealed, yellow, from col 9. r18 `Press Reveal to show the answers.` Alt: paragraph; per question paragraph `Question 1: <text>` and concealed `{ summary: "Show answer", text: "Year: <year>" }`; paragraph. |
| 600 | r0 `UTC` col 1, `Mag` col 7, `Depth` ending 20, `Place` col 22. From r1 to r18, whole items: time, magnitude yellow col 7, depth ending col 20, place cols 22-39 (2 rows, `fitBody`; dropped on `word-too-long`). r19 `Showing <n> of <m>.` when n < m. Empty list: r1-r2 `No earthquakes are listed for this` / `period.` Alt: table Time UTC, Magnitude, Depth, Place, and the count paragraph. |
| 601 | r0 phase name. Disc cols 1-8, r2-r7. Col 11: r2 `<percent> illuminated`, r4 `Next full moon` cyan, r5 date and `formatTimeUtc`, r6 `Next new moon` cyan, r7 the same. r10-r11 `Times are computed here and may differ` / `from published tables by a few minutes.` Alt: heading, paragraphs. |
| 610 | Whole items, one blank row between: row 1 date yellow col 1, `formatTimeUtc` col 12, status green cols 22-39 (`fitBody`, 1 row; left out when it fails or is null); then mission cols 1-38 (2 rows, `wrapWords`; item dropped when it fails); then the rocket cyan cols 1-38 (`fitBody`, 1 row; left out when it fails or is null). The source gives no provider or pad. Alt: table Date, Time UTC, Status, Mission, Rocket. |
| 700 | r0-r1 title yellow (2 × 38, `wrapWords`; left out when it fails). Blank row. Body (16 × 38). `totalRows` 16. Alt: heading (always), paragraph, link `Read on Wikipedia: <title>`. |
| 802 | r0 `AI editor: on` or `off`. r1 `Model calls today: <used> of <cap>`. r2 `Drafts today, accepted: <n>`. r3 `Drafts today, rejected: <n>` (`max` 99,999). r4 `Page`, `UTC`, `Editor` cyan at cols 1, 6, 12 and again at 21, 26, 32. r5-r19 the 30 registry pages, column-major, 15 then 15: number yellow, `formatTime`, `Rules`, `AI` or `Static` (`n/a` without an entry; the last entry for a number wins). Alt: paragraphs, table Page, Compiled UTC, Editor. |

The editor seam pages lay out each slot's rows in the slot's place; empty slots take no rows, and packed items follow each other with no gap. `assemble` runs `checkDraft(input, rows, rowOf)` (requirement 8.4; `rowOf(slot, row)` is the page row that the page layout gives that row of the draft, so that messages name page rows) before building, so a draft never reaches the builder with a bad row.

## Selection rules

- Stories (110 to 118): the first eight stories whose text folds; story n is the n-th of those. Background article: the first article whose title and extract both fold.
- `pickSpread(n, k)`: indices round(i (n - 1) / (k - 1)) for i from 0 to k - 1, deduplicated, ascending (k = 1 gives index 0). Pages 500 and 501 sort the entries that fold by year ascending, stable, then take `pickSpread(count, 6)` or `(count, 4)`.
- Quiz: eligible events fold, have |year| ≥ 10, `fitBody` into 2 × 37, and their fitted text has no number token equal to the digits of their own year. seed = YYYYMMDD of `now` (UTC). Order eligible events by `fmix32(seed + 0x9E3779B9 × i)` (MurmurHash3's 32-bit finaliser on index i, `Math.imul` arithmetic), ties by index; take events in that order, skipping one whose year digits are a token of an already chosen text or whose text contains a token equal to an already chosen year's digits, until five are chosen. Fixed text on the page has no digits besides the question numbers 1 to 5, which |year| ≥ 10 cannot match.

## Numbers per page

Property 5's allowed tokens, each made by the test with `format.ts` from the data, plus the number tokens of shown source text:

| Page | Values |
|---|---|
| 100, 802 | `REGISTRY` numbers; 802 also every counter and compile time |
| 110, 111-118 | 111 to 118 and 110; feed date |
| 120, 400-402 | ranks (120: `rank` field; 400s: position + 1); views; score; comments |
| 200, 201 | temperatures, wind, precipitation chance, forecast dates, highest high, lowest low |
| 300, 301 | `Rates.date`; rates; changes from requirement 12.1; series dates and rates |
| 500, 501, 550 | data day and month; years; 550 also 1 to 5 |
| 600 | times, magnitudes, depths; shown and total counts |
| 601 | `moonAt(now)`: illuminated × 100, next full and new dates and times |
| 610 | launch dates and times |
| no-data pages | 100; no-story pages 110 |

## No-data page

Lines (content markup, col 1): r1 `{y}No data yet.`; r3-r4 `This page fills in after the next good` / `update from its source.`; r6 `{y}100{w}  Index`. No-story (111 to 118): r1 `{y}No story on this page today.`; r3 `{y}110{w}  World news index`. Alt: one paragraph per text, a link for the last line. `dataAt` is null and `outcome` `no-data`.

## Static pages

`compileStatic(n, text)`: `parseContent`, then `validateContentRows`; errors become `markup` or `grid` problems with their rows and columns. Static alt: a row's visible text is its unconcealed text cells (mosaic and concealed cells read as spaces), trimmed, with runs of spaces collapsed. Consecutive rows with visible text make one paragraph, joined with one space. A row's concealed text is each run of non-space characters (mosaic cells count as spaces) that holds at least one concealed cell, read in full and joined with one space, so that a word that is half concealed still appears whole (without this, `checkAltAgreement` fails for it, and Property 12 would not hold). Where concealed cells are set apart from visible text by spaces, this is just the concealed cells' text. A row with concealed text adds `{ kind: "concealed", summary: "Show hidden text", text }` after the paragraph that row belongs to; a row with concealed text and no visible text ends the open paragraph and adds its block at once. No blocks gives one paragraph with the PageDef title.

Placeholders, two lines each: `pages/800.page` is ` {y}How to use Page 100` then ` This page is not written yet.`; `801.page`, `899.page` and `666.page` are the same with ` {y}About, sources and licences`, ` {y}Engineering test page` and ` {y}Back from the dead`. The static-pages spec replaces them.

## compileAll and grid:check

`compileAll` walks `REGISTRY`. For each def it calls its compiler inside `try`/`catch` (a throw becomes `threw` with the error's `name` only, never the data), then `checkCompiledPage(def, page)` (each problem becomes `page-check`), then `buildScreen(def, page, i, { now, stale, lastGoodAt: page.dataAt })` for every subpage i and both `stale` values (`frame` with the error code or violations). Any problem gives `failed`. Nothing is shared between pages, so one failure cannot affect another.

`CHECK_STATUS(now)`: `aiEditor` true, every counter 99,999, one entry per registry page with `compiledAt` now and the registry editor, so 802 is checked at its widest. `grid-check.ts` runs, in order: `parseSnapshot` on `snapshot.json`; each `pages/*.page` file (name must be `800`, `801` or `899`); `compileAll`; `checkAltAgreement` on every subpage. Output lines: `pages/801.page row 7 col 12: <message>`, `page 201 subpage 3 row 9 col 4: <message>`, then `<n> pages, <m> screens, <k> problems`.

## Error handling

No function in `src/compilers` throws on purpose; total functions return result unions and exhaustive `switch` statements end in a `never` default. `compileAll` catches only around each compiler call. Problems carry codes, positions and messages, never whole source texts.

## Correctness properties

Each is one fast-check test named `Property N: ...` in the file shown. New arbitraries live in `test/compilers/compile-arbitraries.ts`: snapshots with hostile values (words of 1 to 120 letters, names with `α`, `д`, `©`, U+1F600 and lone surrogates, empty and 50-item lists, finite doubles from -1e308 to 1e308 without -0, years from -1e6 to 1e6, ISO times from 1970 to 2100), every one checked with `parseSnapshot` before use; statuses with counters from 0 to 1e9; page files from `serialiseContent` of grid-core's `validContent`.

Property 1: for all generated snapshots, statuses, `now` from 1970 to 2100 and page files, `compileAll` does not throw, gives 30 outcomes in registry order with none `failed`, and `buildScreen` succeeds for every subpage of every returned page with both `stale` values. Validates: 2.2, 2.7, 4.2, 7.1, 7.3, 7.4, 7.5, 18.1, 18.2. (`test/compilers/compile-all.property.test.ts`)

Property 2: for the same inputs, `checkCompiledPage(def, page)` is empty for every returned page, so every subpage's alt agrees with its grid. Validates: 4.6, 9.1, 10.1 to 17.2. (`compile-all.property.test.ts`)

Property 3: for the same inputs, two calls give deep-equal results and every input deep-equals a clone taken before the first call. Validates: 7.2. (`compile-all.property.test.ts`)

Property 4: for all texts of repertoire words (with digits, hyphens, unit and number words, sentence ends and abbreviations), widths 1 to 40 and row limits 1 to 20, each fit function's rows obey 3.2; their words, with `...` removed and hyphen splits rejoined, are a prefix of the input words (all of them for `wrapWords`; all after 3.5 for `fitHeadline`); only `fitBody` adds `...`, and when it does the last word has no digit and is not a unit or number word; `word-too-long` is returned exactly when some part is wider than the width. Validates: 3.1 to 3.8. (`test/compilers/fit-text.property.test.ts`)

Property 5: for the inputs of Property 1, every number token in every compiled page's content rows is in the allowed set for that page ("Numbers per page"). Validates: 2.1, 7.6. (`compile-all.property.test.ts`)

Property 6: for all canvases of 1 to 40 by 1 to 20 cells with any pixels set and any style, `cellsToCanvas(canvasToCells(c, style))` equals c, and every cell is a mosaic with bits 1 to 63 or a text space. Validates: 5.1, 5.2. (`test/compilers/mosaic-canvas.property.test.ts`)

Property 7: for all t from 1970-01-01 to 2100-12-31, `moonAt(t)` is defined, `illuminated` is in 0 to 1, `nextFull` and `nextNew` are after t and at most 30 days after it, `moonAt(nextFull).illuminated` is at least 0.99 and `moonAt(nextNew).illuminated` at most 0.01 (each when that phase is itself on or before 2100-12-31; after it `moonAt` is `undefined`). Validates: 6.1, 6.3. (`test/compilers/moon.property.test.ts`)

Property 8: for all generated on-this-day values and `now`, no question year of page 550 appears as a number token in any unconcealed cell run, and each question's concealed cells read `formatYear(year)`. Validates: 14.3. (`test/compilers/p550-quiz.property.test.ts`)

Property 9: for all generated feed and on-this-day entries and `now`, each ai page's compiler equals `assemble(data, rulesDraft(editorialInput(data)))` and succeeds; replacing any one draft row with a repertoire string 1 to 10 cells over its width gives a `row-width` problem at that page row with message `row R is N cells, limit W`; and `assemble` does not throw for arbitrary arrays of strings. Validates: 8.1 to 8.5. (`test/compilers/editor-seam.property.test.ts`)

Property 10: for all doubles (with `NaN`, both infinities, -0 and extremes), `null`, arbitrary strings and Dates, every formatter does not throw, prints at most its maximum width, and prints `n/a` exactly when the input is null, non-finite, invalid or out of range, else a match of its pattern. Validates: 2.1, 2.2, 2.3, 2.5, 2.7. (`test/compilers/format.property.test.ts`)

Property 11: for all sequences of builder calls (positions inside and outside the grid, texts with non-repertoire code points, any colour pairs, alt blocks or none), `build` does not throw, succeeds exactly when an independent oracle finds no out-of-bounds, overlap, non-repertoire, contrast or alt problem, and on success every written cell is where it was written. Validates: 4.1 to 4.7. (`test/compilers/content-builder.property.test.ts`)

Property 12: for all valid content c, `compileStatic(800, serialiseContent(c))` succeeds, its rows deep-equal c, its alt equals the static alt rule computed by the test, and `checkAltAgreement` succeeds. Validates: 17.1, 17.2. (`test/compilers/static-page.property.test.ts`)

## Example tests

- `format.test.ts`: every example in 2.4, the bands in 2.5, `-0.4` and `-0.001`, each range edge and one past it, `formatInteger(1e8, 99_999_999)`.
- `fit-text.test.ts`: the examples in 3.7; `well-known` split; `U.S. troops leave. Talks resume` (one sentence break); `The` and `A` removal; a 41-letter word.
- `content-builder.test.ts`: each problem code with its message; a two-row table record; `lines` hyphen join.
- `weather-symbol.test.ts`, `moon-disc.test.ts`, `block-font.test.ts`: the WMO table; each bitmap; fraction 0 and 1; 36 distinct glyphs of 5 × 7; `?` gives `undefined`.
- `moon.test.ts`: the known-dates table; the eight names at their band edges; 1969-12-31 and 2101-01-01 give `undefined`.
- One test per page module, built from the boot snapshot (`snapshot.json` through `parseSnapshot`): exact content markup of subpage 0 at 2026-11-11T14:05:09Z; plus the edge cases of its requirement (no data, empty list, fewer than 8 stories, a currency with 1 point, `1 point`, quiz with 0 to 6 eligible events).
- `static-page.test.ts`: every file in `pages/` compiles; a bad file gives `markup` problems at the right rows; a name `123.page` is rejected by the check.
- `compile-all.test.ts`: a compiler made to throw through a test-only snapshot value is reported `threw` while the other 29 compile; outcome order.
- `test/scripts/grid-check.test.ts`: runs the check functions on the boot snapshot and on a broken page file (exit code and line format).

## Test plan

| Command | Covers |
|---|---|
| `npm test -- test/compilers/format test/compilers/fit-text test/compilers/content-builder` | Requirements 2 to 4; Properties 4, 10, 11 |
| `npm test -- test/compilers/mosaic-canvas test/compilers/chart test/compilers/weather-symbol test/compilers/moon` | Requirements 5, 6; Properties 6, 7 |
| `npm test -- test/compilers` | Requirements 7 to 18; Properties 1 to 3, 5, 8, 9, 12 |
| `npm test -- test/scaffold.test.ts test/boundaries.test.ts test/scripts` | Requirements 1, 19 |
| `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check` | Requirement 20 |

Property tests use fast-check's default 100 runs and a random seed.
