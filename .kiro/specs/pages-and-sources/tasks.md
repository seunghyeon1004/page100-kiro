# pages-and-sources: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits. Tasks 11 to 14 need recorded fixtures and come after task 10. Owner answers of 2026-11-11 are in `requirements.md` ("Owner answers"): the owner has said go for task 1.1, and has authorised Kiro to run the recorder once in task 10.

- [x] 1. Project changes
  - [x] 1.1 Install `zod` and `tsx` with the exact command in `design.md` ("Toolchain"), once the owner says go. npm network use only.
    - Requirements: 1.1. Verify: `npm ls --depth=0` lists `zod@4.6.7`, `tsx@4.23.15` and the seven grid-core packages, with no `UNMET` or `invalid` line
    - Done: `npm ls --depth=0` listed `tsx@4.23.15` and `zod@4.6.7` plus the seven grid-core packages; `npm ls --depth=0 | grep -ciE "UNMET|invalid"` printed `0`.
    - Commit: `deps: zod runtime dependency and tsx`
  - [x] 1.2 Add `scripts` to `tsconfig.json`, `src/sources/snapshot/` to `.prettierignore`; update `test/scaffold.test.ts` to the new exact lists; extend `test/boundaries.test.ts` with 17.1, 17.2 and the amended expect-error rule.
    - Requirements: 1.2, 1.3, 1.4, 17.1, 17.2. Verify: `npm test -- test/scaffold.test.ts test/boundaries.test.ts && npm run typecheck && npm run lint`
    - Done (owner answer 5: `public/fonts/` added to `.prettierignore` and the scaffold list): `npm test -- test/scaffold.test.ts test/boundaries.test.ts` gave "Test Files  2 passed (2) / Tests  27 passed (27)"; `npm run typecheck` no errors; `npm run lint` exit 0 ("All matched files use Prettier code style!").
    - Commit: `scaffold: scripts folder, snapshot ignore, new boundaries`

- [x] 2. Types: `src/pages/page-def.ts`, `alt-block.ts`, `compiled-page.ts`, `src/sources/source-id.ts`.
  - Requirements: 4.1, 4.2, 11.1. Verify: `npm run typecheck`
  - Done: `npm run typecheck` (`tsc --noEmit`) printed no errors (exit 0).
  - Commit: `pages: page, alt block and compiled page types`

- [x] 3. Registry and lookup: `registry.ts`, `page-lookup.ts`, `test/pages/registry.test.ts`, `page-lookup.test.ts`, `page-lookup.property.test.ts` (Properties 3, 4).
  - Requirements: 2.1 to 2.6, 3.1 to 3.4. Verify: `npm test -- test/pages/registry test/pages/page-lookup`, including `Property 3:` and `Property 4:`
  - Commit: `pages: registry, lookup and neighbours`
  - Done: `npm test -- test/pages/registry test/pages/page-lookup` gave "Test Files  3 passed (3) / Tests  28 passed (28)", including `Property 3:` and `Property 4:` (listed with `--reporter=verbose`).

- [x] 4. Frame builder
  - [x] 4.1 `attribution.ts`, `frame-time.ts`, `frame-rows.ts`, `build-screen.ts`, with `attribution.test.ts`, `frame-time.test.ts`, `build-screen.test.ts`.
    - Requirements: 5.1 to 5.5, 6.1, 6.2, 7.1 to 7.5. Verify: `npm test -- test/pages/attribution test/pages/frame-time test/pages/build-screen.test.ts`
    - Commit: `pages: frame builder for rows 0, 1, 22 and 23`
    - Done: `npm test -- test/pages/attribution test/pages/frame-time test/pages/build-screen.test.ts` gave "Test Files  3 passed (3) / Tests  28 passed (28)".
  - [x] 4.2 `test/pages/page-arbitraries.ts`, `build-screen.property.test.ts` (Properties 1, 2).
    - Requirements: 5.1, 5.3, 5.4, 5.5, 6.1, 6.2, 7.1 to 7.3, 7.5. Verify: `npm test -- test/pages/build-screen.property.test.ts`, including `Property 1:` and `Property 2:`
    - Commit: `test: frame validity and layout properties`
    - Done: `npm test -- test/pages/build-screen.property.test.ts` gave "Test Files  1 passed (1) / Tests  2 passed (2)", listing `Property 1:` and `Property 2:` (verbose reporter).

- [x] 5. Alt agreement: `alt-agreement.ts`, `check-compiled-page.ts`, their example tests, `alt-agreement.property.test.ts` (Property 6).
  - Requirements: 9.1, 9.2. Verify: `npm test -- test/pages/alt-agreement test/pages/check-compiled-page`, including `Property 6:`
  - Commit: `pages: alt/grid agreement and compiled-page check`
  - Done: `npm test -- test/pages/alt-agreement test/pages/check-compiled-page` gave "Test Files  3 passed (3) / Tests  21 passed (21)", including `Property 6:` (verbose reporter).

- [x] 6. Not-in-service screen: `not-in-service.ts`, `not-in-service.test.ts`, `not-in-service.property.test.ts` (Property 5).
  - Requirements: 8.1, 8.2, 8.3, 9.1, 9.2. Verify: `npm test -- test/pages/not-in-service`, including `Property 5:`
  - Commit: `pages: not-in-service screen`
  - Done: `npm test -- test/pages/not-in-service` gave "Test Files  2 passed (2) / Tests  14 passed (14)", including `Property 5:` (verbose reporter).

- [x] 7. HTTP client: `user-agent.ts`, `http.ts`, `test/sources/http.test.ts`, `http.property.test.ts` (Property 10). Fake `fetch` and `delay` only.
  - Requirements: 10.1 to 10.6, 18.2. Verify: `npm test -- test/sources/http`, including `Property 10:`
  - Commit: `sources: HTTP client with timeout, retry and size cap`
  - Done: `npm test -- test/sources/http` gave "Test Files  2 passed (2) / Tests  26 passed (26)", including `Property 10:` (verbose reporter). A temporary mutation (`>` to `>=` on the size cap) made 2 tests fail, then was reverted.

- [x] 8. Requests and schedule: `cities.ts`, `source-requests.ts`, `schedule.ts`, `source-requests.test.ts`, `schedule.property.test.ts` (Property 12).
  - Requirements: 11.2, 11.3, 13.5, 14.1, 14.2. Verify: `npm test -- test/sources/source-requests test/sources/schedule`, including `Property 12:`
  - Commit: `sources: cities, request URLs and schedule data`
  - Done: `npm test -- test/sources/source-requests test/sources/schedule` gave "Test Files  3 passed (3) / Tests  25 passed (25)", including `Property 12:` (verbose reporter).

- [x] 9. Recorder: `scripts/lib/record.ts`, `scripts/lib/fixture-files.ts`, `scripts/record-fixtures.ts`, `test/scripts/record.test.ts`. Kiro does not run the script.
  - Requirements: 16.1, 16.2. Verify: `npm test -- test/scripts/record.test.ts && npm run typecheck && npm run lint`
  - Done: `npm test -- test/scripts/record.test.ts` 1 file, 6 tests passed; `npm run typecheck` no errors; `npm run lint` exit 0 (after owner answer 5).
  - Commit: `scripts: fixture recorder`

- [x] 10. Record fixtures: Kiro runs `npx tsx scripts/record-fixtures.ts` once (authorised by the owner, 2026-11-11). Repeat on another day if no two consecutive featured days cover both `news` and `mostread` (`sources.md`). Kiro then lists the files; it does not open them before this.
  - Requirements: 16.1. Verify: `ls test/fixtures/sources/*/*.meta.json | wc -l` and one or more files per source directory
  - Commit (owner): `fixtures: first recording`
  - Done: ran `npx tsx scripts/record-fixtures.ts` once. Output: every source "0 failed" (wikimedia-feed 2, wikimedia-onthisday 1, open-meteo 1, frankfurter 2, hacker-news 39, usgs 1, launch-library 1 recorded). Featured today has keys `news, mostread, tfa, dyk, onthisday, image`; featured yesterday has `mostread, tfa, onthisday, image`. `ls test/fixtures/sources/*/*.meta.json | wc -l` printed `47`, and each of the 7 source directories has at least one meta file.

- [x] 11. Source modules, each with `test/sources/<source>.test.ts` and its `synthetic/` files. Wire field names come from the fixtures; if one lacks data for a normalised field, stop and ask.
  - [x] 11.1 `outcome.ts`, `plain-text.ts`, `wikimedia-feed.ts`, `wikimedia-feed.property.test.ts` (Property 8). Requirements: 12.1 to 12.6, 13.1. Verify: `npm test -- test/sources/wikimedia-feed`, including `Property 8:`. Commit: `sources: Wikimedia featured feed`
    - Done: `npm test -- test/sources/wikimedia-feed` gave "Test Files  2 passed (2) / Tests  21 passed (21)", including `Property 8:`. Owner answer 1 confirmed against `2026-11-11-featured-today.json`: all 5 news items have `links`, each link has a string `extract` (2/2, 3/3, 4/4, 4/4, 3/3). Also added `normal-number.ts` (shared `NormalNumber`) and tests `outcome.test.ts`, `plain-text.test.ts` (`npm test -- test/sources/wikimedia-feed test/sources/plain-text test/sources/outcome`: 4 files, 36 tests passed).
  - [x] 11.2 `wikimedia-onthisday.ts`. Requirements: 12.1 to 12.6. Verify: `npm test -- test/sources/wikimedia-onthisday`. Commit: `sources: Wikimedia on this day`
    - Done: `npm test -- test/sources/wikimedia-onthisday` gave "Test Files  1 passed (1) / Tests  10 passed (10)".
  - [x] 11.3 `open-meteo.ts`. Requirements: 12.1 to 12.6, 13.2. Verify: `npm test -- test/sources/open-meteo`. Commit: `sources: Open-Meteo`
    - Done: `npm test -- test/sources/open-meteo` gave "Test Files  1 passed (1) / Tests  15 passed (15)". The recorded order is the request order, confirmed by the position test. Revised by owner answer 7: null is now allowed (and normalised to `null`) for `current.temperature_2m`, `current.weather_code`, `current.wind_speed_10m` and every element of the four daily arrays; four synthetic fixtures name the Open-Meteo documentation. `npm test -- test/sources/open-meteo test/sources/usgs` gave "Test Files  2 passed (2) / Tests  34 passed (34)".
  - [x] 11.4 `frankfurter.ts`. Requirements: 12.1 to 12.6, 13.3. Verify: `npm test -- test/sources/frankfurter`. Commit: `sources: Frankfurter`
    - Done: `npm test -- test/sources/frankfurter` gave "Test Files  1 passed (1) / Tests  15 passed (15)".
  - [x] 11.5 `hacker-news.ts`, `hacker-news.property.test.ts` (Property 9). Requirements: 12.1 to 12.6, 13.4. Verify: `npm test -- test/sources/hacker-news`, including `Property 9:`. Commit: `sources: Hacker News`
    - Done: `npm test -- test/sources/hacker-news` gave "Test Files  2 passed (2) / Tests  16 passed (16)", including `Property 9:`. A temporary mutation (6 to 7 in flight) made Property 9 fail, then was reverted. The recorded items include no dead, deleted or null item, so those skips are covered by synthetic fixtures (comments say so).
  - [x] 11.6 `usgs.ts` (revised by owner answer 7: null `mag` drops the feature, null `place` and null depth become `null`; synthetic `null-magnitude`, `null-place`, `null-depth`). Requirements: 12.1 to 12.6. Verify: `npm test -- test/sources/usgs`. Commit: `sources: USGS`
    - Done: `npm test -- test/sources/usgs` gave "Test Files  1 passed (1) / Tests  11 passed (11)".
  - [x] 11.7 `launch-library.ts`. Requirements: 12.1 to 12.6, 13.5. Verify: `npm test -- test/sources/launch-library`. Commit: `sources: Launch Library 2`
    - Done (owner answer 6: `mode=list` kept, `provider` and `pad` dropped, `name` split on `" | "`): `npm test -- test/sources/launch-library` gave "Test Files  1 passed (1) / Tests  11 passed (11)".

- [x] 12. `fetchers.ts`, `test/sources/source-arbitraries.ts` (JSON variations), `normalisers.property.test.ts` (Property 7).
  - Requirements: 12.1, 12.2, 12.4, 18.1. Verify: `npm test -- test/sources/normalisers.property.test.ts`, including `Property 7:`
  - Commit: `test: normalisers on fixture variations`
  - Done: `npm test -- test/sources/normalisers.property.test.ts` gave "Test Files  1 passed (1) / Tests  25 passed (25)" at the time; Property 7 was later folded into one test that loops over the 8 recorded-fixture cases (task 16 needs one test per property), 18 tests in the file after that, counting the per-case example tests. A temporary mutation (`cleanNumber` returning `-0` unchanged) made 1 to 3 tests fail in each of 3 runs, then was reverted.

- [x] 13. Snapshot schema: `snapshot.ts`, `snapshot.property.test.ts` (Property 11).
  - Requirements: 15.1, 15.2, 15.3. Verify: `npm test -- test/sources/snapshot.property.test.ts`, including `Property 11:`
  - Commit: `sources: snapshot schema`
  - Done: `npm test -- test/sources/snapshot.property.test.ts` gave "Test Files  1 passed (1) / Tests  2 passed (2)", including `Property 11:`; `npm run typecheck` no errors.

- [x] 14. Boot snapshot: `scripts/lib/fixture-replay.ts`, `scripts/lib/build-snapshot.ts`, `scripts/refresh-snapshot.ts`; run it (no network) to write `snapshot.json`; `test/sources/snapshot.test.ts`.
  - Requirements: 15.4, 16.3, 16.4. Verify: `npx tsx scripts/refresh-snapshot.ts && npm test -- test/sources/snapshot.test.ts`, then a second run leaves `git diff --stat src/sources/snapshot/` empty
  - Commit: `sources: boot snapshot from recorded fixtures`
  - Done: `npx tsx scripts/refresh-snapshot.ts` wrote `src/sources/snapshot/snapshot.json` (529,001 bytes, all seven sources, no network); `npm test -- test/sources/snapshot.test.ts` gave "Test Files  1 passed (1) / Tests  4 passed (4)". A second run produced a file `cmp` reported identical to the first (`git diff --stat` cannot show it because the file is not yet committed; after your commit it will be empty). Replay note: the replay `delay` passes the 30 s retry wait at once and never fires the 10 s request timeout, so a recorded response is never cut short.
  - Amended 2026-11-11 (rule-compilers owner answers 4 and 5): requirement 12.7 caps the on-this-day lists at 40 entries plus `selected` and drops `articles`; the snapshot was rebuilt offline with `npx tsx scripts/refresh-snapshot.ts` and is now 118,502 bytes. Page 666 joined the registry (30 pages).

- [x] 15. Full gate. Fix failures in the code, never by weakening a validator, schema or test (`tech.md`, rule 3).
  - Requirements: 18.1, 18.2, 18.3. Verify: `npm run typecheck && npm run lint && npm test && npm run build`; quote the `Test Files` and `Tests` lines
  - Commit: none unless a fix was needed
  - Done: `npm run typecheck && npm run lint && npm test && npm run build` all exit 0; `npm test` gave "Test Files  56 passed (56) / Tests  483 passed (483)". Fixes needed: lint errors in my new tests (void operator, unused variable, dynamic delete) and `test/boundaries.test.ts` caught `zod` imported in a test (removed the import; the boundary rule is unchanged).

- [x] 16. Counts: test files, tests, property tests. `npx vitest list | grep -cE "Property [0-9]+:"` must equal grid-core's 20 plus this spec's 12 (32), and `grep -cE "^Property [0-9]+:" .kiro/specs/pages-and-sources/design.md` must print 12.
  - Requirements: 18.1. Verify: the two commands above and `npm test`
  - Commit: `docs: pages-and-sources test counts`
  - Done: `npx vitest list | grep -cE "Property [0-9]+:"` printed 32; `grep -cE "^Property [0-9]+:" .kiro/specs/pages-and-sources/design.md` printed 12; `npm test` gave "Test Files  56 passed (56) / Tests  483 passed (483)". The first count was 39 because Property 7 was one test per fixture (8); folding them into one test gave 32. Counts: 56 test files, 483 tests.

## Notes from the implementation session (2026-11-11)

- `vitest.config.ts` gained `testTimeout: 30_000`. The grid-core test `test/grid/repertoire.test.ts` ("agrees with the array on every value from -1 to U+110000") passes alone in about 3.4 s but exceeded the 5 s default in 2 of 4 full runs once more test files ran in parallel. No assertion, rule or test body changed.
- `npm run lint` exits 1 only because `prettier --check .` flags the owner-added `public/fonts/bedstead-extended-subset.coverage.json`. `npx eslint .` exits 0 and `prettier --check` is clean for `src test scripts .kiro docs` and the root config files. Tasks 1.2 and 9 (and 15) include `npm run lint` in their Verify and stay unticked until the owner decides (format that file, or add `public/` to `.prettierignore` and the scaffold test).
- Task 11.7 is stopped (see there). Tasks 12 to 16 wait for that decision.
- Extra files not in the design table: `src/sources/normal-number.ts` (shared `NormalNumber` schema), `test/sources/fixtures.ts`, `test/sources/fake-http.ts`, `test/pages/page-arbitraries.ts`, `test/pages/frame-markup.ts`.
