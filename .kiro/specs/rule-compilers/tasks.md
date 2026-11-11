# rule-compilers: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits.

Preconditions: pages-and-sources tasks 2 to 6 (types, registry, frame, alt agreement) are done before task 6 here, and tasks 13 and 14 (snapshot schema, boot snapshot) before task 9. Tasks 2 to 5 need only grid-core. If `CITIES` has no display name per city, or any pages-and-sources export named in the design differs, stop and ask; do not work around it.

- [x] 1. Boundaries: extend `test/boundaries.test.ts` with 1.2 to 1.4. It passes with `src/compilers` empty; tasks 2 onwards are its real checks.
  - Requirements: 1.2, 1.3, 1.4. Verify: `npm test -- test/boundaries.test.ts && npm run lint`
  - Commit: `test: compiler module boundaries`
  - Done: `npm test -- test/boundaries.test.ts && npm run lint` gave "Test Files  1 passed (1) / Tests  16 passed (16)" and "All matched files use Prettier code style!". Before the tick, the same session also ran the owner-answer changes: `npm test -- test/sources` (19 files, 200 tests passed), `npm test -- test/pages` (12 files, 93 tests passed), snapshot rebuilt to 118,502 bytes.

- [x] 2. Formatters: `src/compilers/format.ts`, `test/compilers/format.test.ts`, `format.property.test.ts` (Property 10). `formatTimeUtc` is added in task 6, once `src/pages/frame-time.ts` exists.
  - Requirements: 2.1 to 2.5, 2.7. Verify: `npm test -- test/compilers/format`, including `Property 10:`
  - Commit: `compilers: shared number and date formatters`
  - Done: `npm test -- test/compilers/format` gave "Test Files  2 passed (2) / Tests  11 passed (11)", including `Property 10:`. `formatTimeUtc` was added here instead of task 6, because `src/pages/frame-time.ts` already exists.

- [x] 3. Fitting: `fit-text.ts`, `fit-text.test.ts`, `fit-text.property.test.ts` (Property 4).
  - Requirements: 3.1 to 3.8. Verify: `npm test -- test/compilers/fit-text`, including `Property 4:`
  - Commit: `compilers: wrap and fit text by the editorial rules`
  - Done: `npm test -- test/compilers/fit-text` gave "Test Files  2 passed (2) / Tests  14 passed (14)", including `Property 4:`.

- [x] 4. Drawing
  - [x] 4.1 `mosaic-canvas.ts`, `chart.ts`, `mosaic-canvas.property.test.ts` (Property 6), `chart.test.ts`. Requirements: 5.1, 5.2, 5.3. Verify: `npm test -- test/compilers/mosaic-canvas test/compilers/chart`, including `Property 6:`. Commit: `compilers: mosaic canvas and charts`
    - Done: `npm test -- test/compilers/mosaic-canvas test/compilers/chart` gave "Test Files  2 passed (2) / Tests  10 passed (10)", including `Property 6:`. `cell-style.ts` (the `CellStyle` type, re-exported by `content-builder.ts` in task 6) was added so the canvas needs no import from the builder.
  - [x] 4.2 `weather-symbol.ts`, `moon-disc.ts`, `block-font.ts` and their tests. Requirements: 5.4, 5.5, 5.6. Verify: `npm test -- test/compilers/weather-symbol test/compilers/moon-disc test/compilers/block-font`. Commit: `compilers: weather symbols, moon disc, block letters`
    - Done: `npm test -- test/compilers/weather-symbol test/compilers/moon-disc test/compilers/block-font` gave "Test Files  3 passed (3) / Tests  13 passed (13)".

- [x] 5. Moon: `moon.ts`, `moon.test.ts` (known-dates table), `moon.property.test.ts` (Property 7). Transcribe the Meeus terms from the cited chapters; if a known date misses by more than 5 minutes, fix the transcription, never the tolerance.
  - Requirements: 6.1 to 6.4. Verify: `npm test -- test/compilers/moon`, including `Property 7:`
  - Commit: `compilers: moon phase and next full and new moon`
  - Done: `npm test -- test/compilers/moon` gave "Test Files  3 passed (3) / Tests  15 passed (15)" (the pattern also matches `moon-disc`), including `Property 7:`. Every known date was within 5 minutes with the Meeus terms as first transcribed; no tolerance was changed. The design's expected times were checked against astropixels.com for 2024 to 2026. Property 7 was corrected in the design: the illumination check at the next phase applies only when that phase is on or before 2100-12-31, because `moonAt` is `undefined` after it.

- [x] 6. Builder and shared types: `compile-types.ts`, `content-builder.ts`, `no-data-page.ts`, `pick-spread.ts`, `service-status.ts`, `formatTimeUtc` in `format.ts`; `content-builder.test.ts`, `content-builder.property.test.ts` (Property 11).
  - Requirements: 2.6, 4.1 to 4.7, 7.5, 16.1. Verify: `npm test -- test/compilers/content-builder test/compilers/format`, including `Property 11:`
  - Commit: `compilers: content builder with alt blocks`
  - Done: `npm test -- test/compilers/content-builder test/compilers/format` gave "Test Files  4 passed (4) / Tests  29 passed (29)", including `Property 11:` (the example tests for `pick-spread.ts` and `no-data-page.ts` are in `content-builder.test.ts`). `formatTimeUtc` was already added in task 2. The test run found and fixed one flaw in my own Property 10 test (an invalid Date reached `toISOString`), not in the formatters.

- [x] 7. Editor seam: `editorial-input.ts` (`rulesDraft`, `checkDraft`) and its example test.
  - Requirements: 8.2, 8.3, 8.4, 8.5. Verify: `npm test -- test/compilers/editorial-input`
  - Commit: `compilers: editorial input, rules draft and draft checks`
  - Done: `npm test -- test/compilers/editorial-input` gave "Test Files  1 passed (1) / Tests  10 passed (10)". `checkDraft` takes a third argument, a `RowLocator`, because the page row `R` of requirement 8.4 depends on each page's layout; design.md says so.

- [x] 8. Static pages: `static-page.ts`, `pages/800.page`, `801.page`, `899.page`, `static-page.test.ts`, `static-page.property.test.ts` (Property 12).
  - Requirements: 17.1, 17.2, 17.3. Verify: `npm test -- test/compilers/static-page`, including `Property 12:`
  - Commit: `compilers: static pages and placeholder page files`
  - Done: `npm test -- test/compilers/static-page` gave "Test Files  2 passed (2) / Tests  13 passed (13)", including `Property 12:`. Page 666 has a placeholder too (owner answer 5). The design's "Static alt" rule was refined: a half-concealed word appears whole in the concealed block, because otherwise `checkAltAgreement` fails for it and Property 12 cannot hold.

- [x] 9. Page compilers, each with `test/compilers/<module>.test.ts` on the boot snapshot and its edge cases
  - [x] 9.1 `p100-index.ts`, `p802-service-status.ts`. Requirements: 7.1 to 7.3, 9.1, 16.2. Verify: `npm test -- test/compilers/p100 test/compilers/p802`. Commit: `compilers: index and service status`
    - Done: `npm test -- test/compilers/p100 test/compilers/p802` gave "Test Files  2 passed (2) / Tests  9 passed (9)". Compilers take `now` only where the page uses it (requirement 8.1 and design.md amended). Page 100 does not list 666 (owner answer 5). `compile-helpers.ts` and `test/compilers/boot-snapshot.ts` are shared helpers added for tasks 9 to 11.
  - [x] 9.2 `p110-news-index.ts`, `p111-news-story.ts`, `p700-featured-article.ts`. Requirements: 7.1 to 7.5, 8.1, 10.1, 10.2, 10.4. Verify: `npm test -- test/compilers/p110 test/compilers/p111 test/compilers/p700`. Commit: `compilers: news index, story pages, featured article`
    - Done: `npm test -- test/compilers/p110 test/compilers/p111 test/compilers/p700` gave "Test Files  3 passed (3) / Tests  25 passed (25)". On the boot snapshot page 110 shows 3 of the 5 stories, because `fitHeadline` never shortens and the other two do not fit 3 rows of 35; that is the rules fallback working as specified (the AI editor is the way to shorten them).
  - [x] 9.3 `p120-most-read.ts`. Requirements: 7.1 to 7.5, 10.3. Verify: `npm test -- test/compilers/p120`. Commit: `compilers: most read`
    - Done: `npm test -- test/compilers/p120` gave "Test Files  1 passed (1) / Tests  7 passed (7)". The rank column is 3 cells wide (cols 0 to 2) so that `n/a` fits.
  - [x] 9.4 `p200-weather-now.ts`, `p201-outlook.ts`. Requirements: 7.1 to 7.5, 11.1, 11.2. Verify: `npm test -- test/compilers/p200 test/compilers/p201`. Commit: `compilers: weather now and outlook`
    - Done: `npm test -- test/compilers/p200 test/compilers/p201` gave "Test Files  2 passed (2) / Tests  12 passed (12)". The alternative tables use the header `Temp` (not `Temperature`) because the grid shows `Temp` and every grid word must be in the alternative.
  - [x] 9.5 `p300-rates.ts`, `p301-rate-trend.ts`. Requirements: 7.1 to 7.5, 12.1, 12.2. Verify: `npm test -- test/compilers/p300 test/compilers/p301`. Commit: `compilers: exchange rates and trend`
    - Done: `npm test -- test/compilers/p300 test/compilers/p301` gave "Test Files  2 passed (2) / Tests  15 passed (15)". Page 300 has the second block `Other rates` with the ten codes of owner answer 3 (code and rate in the grid, names in the alternative table).
  - [x] 9.6 `p400-developer-news.ts`. Requirements: 7.1 to 7.5, 13.1. Verify: `npm test -- test/compilers/p400`. Commit: `compilers: developer news`
    - Done: `npm test -- test/compilers/p400` gave "Test Files  1 passed (1) / Tests  7 passed (7)".
  - [x] 9.7 `p500-on-this-day.ts`, `p501-births-deaths.ts`, `p550-quiz.ts`, `p550-quiz.property.test.ts` (Property 8). Requirements: 7.1 to 7.5, 8.1, 14.1 to 14.3. Verify: `npm test -- test/compilers/p500 test/compilers/p501 test/compilers/p550`, including `Property 8:`. Commit: `compilers: on this day and quiz`
    - Done: `npm test -- test/compilers/p500 test/compilers/p501 test/compilers/p550` gave "Test Files  4 passed (4) / Tests  25 passed (25)", including `Property 8:`.
  - [x] 9.8 `p600-earthquakes.ts`, `p601-moon.ts`, `p610-launches.ts`. Requirements: 7.1 to 7.7, 15.1 to 15.3. Verify: `npm test -- test/compilers/p600 test/compilers/p601 test/compilers/p610`. Commit: `compilers: earthquakes, moon, launches`
    - Done: `npm test -- test/compilers/p600 test/compilers/p601 test/compilers/p610` gave "Test Files  3 passed (3) / Tests  20 passed (20)". Page 610 shows the rocket where the design said provider and pad (the source has neither). Page 601 prints the moon times about a minute after the tables (14:54 against 14:53), because it ignores the dynamical-time difference as the design says.

- [x] 10. `test/compilers/compile-arbitraries.ts` and `editor-seam.property.test.ts` (Property 9). Every generated snapshot goes through `parseSnapshot` (`tech.md`, rule 4).
  - Requirements: 8.1 to 8.5. Verify: `npm test -- test/compilers/editor-seam`, including `Property 9:`
  - Commit: `test: editor seam properties`
  - Done: `npm test -- test/compilers/editor-seam` gave "Test Files  1 passed (1) / Tests  1 passed (1)", including `Property 9:`. Every generated snapshot passes `parseSnapshot` inside the arbitrary (it throws otherwise).

- [x] 11. `compile-all.ts`, `compile-all.test.ts`, `compile-all.property.test.ts` (Properties 1, 2, 3, 5).
  - Requirements: 7.2, 7.6, 18.1, 18.2, 18.3. Verify: `npm test -- test/compilers/compile-all`, including `Property 1:`, `Property 2:`, `Property 3:` and `Property 5:`
  - Commit: `compilers: compileAll with per-page outcomes`
  - Done: `npm test -- test/compilers/compile-all` gave "Test Files  2 passed (2) / Tests  11 passed (11)", including `Property 1:`, `Property 2:`, `Property 3:` and `Property 5:`. The hostile data found one real defect on its first run: `rangeBars` and `lineChart` looped for ever on doubles near 1e308 (the scaled pixel row overflowed to Infinity). `scaleY` now halves the values first and clamps the row; `chart.test.ts` has a test for it.

- [x] 12. grid:check: `scripts/lib/check-status.ts`, `scripts/grid-check.ts`, the `grid:check` script in `package.json`, `test/scaffold.test.ts` (exact scripts list), `test/scripts/grid-check.test.ts`.
  - Requirements: 1.1, 19.1, 19.2. Verify: `npm test -- test/scaffold.test.ts test/scripts/grid-check.test.ts && npm run grid:check` (quote its summary line)
  - Commit: `scripts: grid:check over the boot snapshot and pages/`
  - Done: `npm test -- test/scaffold.test.ts test/scripts/grid-check.test.ts && npm run grid:check` gave "Test Files  2 passed (2) / Tests  22 passed (22)" and the summary line "30 pages, 43 screens, 0 problems". The checks are in `scripts/lib/run-grid-check.ts` (a function of the text it reads) so a test can run them on a broken file; `scripts/grid-check.ts` only reads the files and prints.

- [x] 13. Full gate. Fix failures in the code or data, never by weakening a validator, schema or test (`tech.md`, rule 3).
  - Requirements: 20.1, 20.2. Verify: `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check`; quote the `Test Files` and `Tests` lines
  - Commit: none unless a fix was needed
  - Done: `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check` exited 0: "Test Files  95 passed (95)", "Tests  733 passed (733)", then "30 pages, 43 screens, 0 problems". The first run failed `test/boundaries.test.ts` (1.2): `p200`, `p201`, `p300` and `p301` imported values from `src/sources`. Fixed in the code, not the rule: `src/compilers/city-data.ts` holds the lists with types from `src/sources`, and `test/compilers/city-data.test.ts` keeps them equal.

- [x] 14. Counts: test files, tests, property tests. `npx vitest list | grep -cE "Property [0-9]+:"` must equal grid-core's 20, pages-and-sources' 12 and this spec's 12 (44), and `grep -cE "^Property [0-9]+:" .kiro/specs/rule-compilers/design.md` must print 12.
  - Requirements: 20.1. Verify: the two commands above and `npm test`
  - Commit: `docs: rule-compilers test counts`
  - Done: `npx vitest list | grep -cE "Property [0-9]+:"` printed 44; `grep -cE "^Property [0-9]+:" .kiro/specs/rule-compilers/design.md` printed 12; `npm test` gave "Test Files  95 passed (95)" and "Tests  733 passed (733)".

- [x] 15. Owner corrections from the rendered pages, 2026-11-11 (tests first, then code; inline snapshots re-recorded only after the new layout was looked at)
  - [x] 15.1 Page 120 shows the position in our list (1, 2, 3, no gaps), not the feed's rank. Requirements: 10.3. Verify: `npm test -- test/compilers/p120 test/compilers/compile-all`
    - Done: `npm test -- test/compilers/p120 test/compilers/compile-all` gave "Test Files  3 passed (3) / Tests  19 passed (19)". The rank column keeps its width 3; positions are at most 19. Property 5's allowed set for 120 is now the positions 1 to 19, not the feed ranks.
  - [x] 15.2 Page 601 draws the whole 16 × 10 disc: lit cells contiguous yellow, dark cells in the disc separated blue (bits 63); at 4% waxing it has both, at full moon no blue; text re-laid at col 19. Requirements: 5.5, 15.2. Verify: `npm test -- test/compilers/moon-disc test/compilers/p601 test/compilers/compile-all`
    - Done: `npm test -- test/compilers/moon-disc test/compilers/p601 test/compilers/compile-all` gave "Test Files  4 passed (4) / Tests  28 passed (28)". The p601 inline snapshot was re-recorded after the new layout was read: the disc is 10 rows (r2 to r11), the crescent on the right, dark side full blocks, text at col 19. The horizontal radius is 13.33 pixels, so the disc is about 13.3 cells wide inside the 16 cell canvas (a round disc on the 5:4 screen).
  - [x] 15.3 Page 501 picks births and deaths at positions round(i (n − 1) / 3) of the year-sorted kept list, oldest first (Property 13). Requirements: 14.2. Verify: `npm test -- test/compilers/day-entries test/compilers/p501 test/compilers/p500 test/compilers/editor-seam`
    - Done: `npm test -- test/compilers/day-entries test/compilers/p501 test/compilers/p500 test/compilers/editor-seam` gave "Test Files  4 passed (4) / Tests  17 passed (17)", including `Property 13:`. The code already chose by `pickSpread` over the year-sorted list, so the tests passed without a code change and the p501 snapshot is unchanged. The recorded fixture `test/fixtures/editor/2026-11-11-p501.json` still matches (editor input unchanged).
  - Commit: `compilers: page 120 positions, whole moon disc, spread births and deaths`
