# rule-compilers: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits.

Preconditions: pages-and-sources tasks 2 to 6 (types, registry, frame, alt agreement) are done before task 6 here, and tasks 13 and 14 (snapshot schema, boot snapshot) before task 9. Tasks 2 to 5 need only grid-core. If `CITIES` has no display name per city, or any pages-and-sources export named in the design differs, stop and ask; do not work around it.

- [ ] 1. Boundaries: extend `test/boundaries.test.ts` with 1.2 to 1.4. It passes with `src/compilers` empty; tasks 2 onwards are its real checks.
  - Requirements: 1.2, 1.3, 1.4. Verify: `npm test -- test/boundaries.test.ts && npm run lint`
  - Commit: `test: compiler module boundaries`

- [ ] 2. Formatters: `src/compilers/format.ts`, `test/compilers/format.test.ts`, `format.property.test.ts` (Property 10). `formatTimeUtc` is added in task 6, once `src/pages/frame-time.ts` exists.
  - Requirements: 2.1 to 2.5, 2.7. Verify: `npm test -- test/compilers/format`, including `Property 10:`
  - Commit: `compilers: shared number and date formatters`

- [ ] 3. Fitting: `fit-text.ts`, `fit-text.test.ts`, `fit-text.property.test.ts` (Property 4).
  - Requirements: 3.1 to 3.8. Verify: `npm test -- test/compilers/fit-text`, including `Property 4:`
  - Commit: `compilers: wrap and fit text by the editorial rules`

- [ ] 4. Drawing
  - [ ] 4.1 `mosaic-canvas.ts`, `chart.ts`, `mosaic-canvas.property.test.ts` (Property 6), `chart.test.ts`. Requirements: 5.1, 5.2, 5.3. Verify: `npm test -- test/compilers/mosaic-canvas test/compilers/chart`, including `Property 6:`. Commit: `compilers: mosaic canvas and charts`
  - [ ] 4.2 `weather-symbol.ts`, `moon-disc.ts`, `block-font.ts` and their tests. Requirements: 5.4, 5.5, 5.6. Verify: `npm test -- test/compilers/weather-symbol test/compilers/moon-disc test/compilers/block-font`. Commit: `compilers: weather symbols, moon disc, block letters`

- [ ] 5. Moon: `moon.ts`, `moon.test.ts` (known-dates table), `moon.property.test.ts` (Property 7). Transcribe the Meeus terms from the cited chapters; if a known date misses by more than 5 minutes, fix the transcription, never the tolerance.
  - Requirements: 6.1 to 6.4. Verify: `npm test -- test/compilers/moon`, including `Property 7:`
  - Commit: `compilers: moon phase and next full and new moon`

- [ ] 6. Builder and shared types: `compile-types.ts`, `content-builder.ts`, `no-data-page.ts`, `pick-spread.ts`, `service-status.ts`, `formatTimeUtc` in `format.ts`; `content-builder.test.ts`, `content-builder.property.test.ts` (Property 11).
  - Requirements: 2.6, 4.1 to 4.7, 7.5, 16.1. Verify: `npm test -- test/compilers/content-builder test/compilers/format`, including `Property 11:`
  - Commit: `compilers: content builder with alt blocks`

- [ ] 7. Editor seam: `editorial-input.ts` (`rulesDraft`, `checkDraft`) and its example test.
  - Requirements: 8.2, 8.3, 8.4, 8.5. Verify: `npm test -- test/compilers/editorial-input`
  - Commit: `compilers: editorial input, rules draft and draft checks`

- [ ] 8. Static pages: `static-page.ts`, `pages/800.page`, `801.page`, `899.page`, `static-page.test.ts`, `static-page.property.test.ts` (Property 12).
  - Requirements: 17.1, 17.2, 17.3. Verify: `npm test -- test/compilers/static-page`, including `Property 12:`
  - Commit: `compilers: static pages and placeholder page files`

- [ ] 9. Page compilers, each with `test/compilers/<module>.test.ts` on the boot snapshot and its edge cases
  - [ ] 9.1 `p100-index.ts`, `p802-service-status.ts`. Requirements: 7.1 to 7.3, 9.1, 16.2. Verify: `npm test -- test/compilers/p100 test/compilers/p802`. Commit: `compilers: index and service status`
  - [ ] 9.2 `p110-news-index.ts`, `p111-news-story.ts`, `p700-featured-article.ts`. Requirements: 7.1 to 7.5, 8.1, 10.1, 10.2, 10.4. Verify: `npm test -- test/compilers/p110 test/compilers/p111 test/compilers/p700`. Commit: `compilers: news index, story pages, featured article`
  - [ ] 9.3 `p120-most-read.ts`. Requirements: 7.1 to 7.5, 10.3. Verify: `npm test -- test/compilers/p120`. Commit: `compilers: most read`
  - [ ] 9.4 `p200-weather-now.ts`, `p201-outlook.ts`. Requirements: 7.1 to 7.5, 11.1, 11.2. Verify: `npm test -- test/compilers/p200 test/compilers/p201`. Commit: `compilers: weather now and outlook`
  - [ ] 9.5 `p300-rates.ts`, `p301-rate-trend.ts`. Requirements: 7.1 to 7.5, 12.1, 12.2. Verify: `npm test -- test/compilers/p300 test/compilers/p301`. Commit: `compilers: exchange rates and trend`
  - [ ] 9.6 `p400-developer-news.ts`. Requirements: 7.1 to 7.5, 13.1. Verify: `npm test -- test/compilers/p400`. Commit: `compilers: developer news`
  - [ ] 9.7 `p500-on-this-day.ts`, `p501-births-deaths.ts`, `p550-quiz.ts`, `p550-quiz.property.test.ts` (Property 8). Requirements: 7.1 to 7.5, 8.1, 14.1 to 14.3. Verify: `npm test -- test/compilers/p500 test/compilers/p501 test/compilers/p550`, including `Property 8:`. Commit: `compilers: on this day and quiz`
  - [ ] 9.8 `p600-earthquakes.ts`, `p601-moon.ts`, `p610-launches.ts`. Requirements: 7.1 to 7.7, 15.1 to 15.3. Verify: `npm test -- test/compilers/p600 test/compilers/p601 test/compilers/p610`. Commit: `compilers: earthquakes, moon, launches`

- [ ] 10. `test/compilers/compile-arbitraries.ts` and `editor-seam.property.test.ts` (Property 9). Every generated snapshot goes through `parseSnapshot` (`tech.md`, rule 4).
  - Requirements: 8.1 to 8.5. Verify: `npm test -- test/compilers/editor-seam`, including `Property 9:`
  - Commit: `test: editor seam properties`

- [ ] 11. `compile-all.ts`, `compile-all.test.ts`, `compile-all.property.test.ts` (Properties 1, 2, 3, 5).
  - Requirements: 7.2, 7.6, 18.1, 18.2, 18.3. Verify: `npm test -- test/compilers/compile-all`, including `Property 1:`, `Property 2:`, `Property 3:` and `Property 5:`
  - Commit: `compilers: compileAll with per-page outcomes`

- [ ] 12. grid:check: `scripts/lib/check-status.ts`, `scripts/grid-check.ts`, the `grid:check` script in `package.json`, `test/scaffold.test.ts` (exact scripts list), `test/scripts/grid-check.test.ts`.
  - Requirements: 1.1, 19.1, 19.2. Verify: `npm test -- test/scaffold.test.ts test/scripts/grid-check.test.ts && npm run grid:check` (quote its summary line)
  - Commit: `scripts: grid:check over the boot snapshot and pages/`

- [ ] 13. Full gate. Fix failures in the code or data, never by weakening a validator, schema or test (`tech.md`, rule 3).
  - Requirements: 20.1, 20.2. Verify: `npm run typecheck && npm run lint && npm test && npm run build && npm run grid:check`; quote the `Test Files` and `Tests` lines
  - Commit: none unless a fix was needed

- [ ] 14. Counts: test files, tests, property tests. `npx vitest list | grep -cE "Property [0-9]+:"` must equal grid-core's 20, pages-and-sources' 12 and this spec's 12 (44), and `grep -cE "^Property [0-9]+:" .kiro/specs/rule-compilers/design.md` must print 12.
  - Requirements: 20.1. Verify: the two commands above and `npm test`
  - Commit: `docs: rule-compilers test counts`
