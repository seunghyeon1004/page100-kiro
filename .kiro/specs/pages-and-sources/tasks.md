# pages-and-sources: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits. Tasks 11 to 14 need recorded fixtures and come after task 10, which the owner does.

- [ ] 1. Project changes
  - [ ] 1.1 Install `zod` and `tsx` with the exact command in `design.md` ("Toolchain"), once the owner says go. npm network use only.
    - Requirements: 1.1. Verify: `npm ls --depth=0` lists `zod@4.6.7`, `tsx@4.23.15` and the seven grid-core packages, with no `UNMET` or `invalid` line
    - Commit: `deps: zod runtime dependency and tsx`
  - [ ] 1.2 Add `scripts` to `tsconfig.json`, `src/sources/snapshot/` to `.prettierignore`; update `test/scaffold.test.ts` to the new exact lists; extend `test/boundaries.test.ts` with 17.1, 17.2 and the amended expect-error rule.
    - Requirements: 1.2, 1.3, 1.4, 17.1, 17.2. Verify: `npm test -- test/scaffold.test.ts test/boundaries.test.ts && npm run typecheck && npm run lint`
    - Commit: `scaffold: scripts folder, snapshot ignore, new boundaries`

- [ ] 2. Types: `src/pages/page-def.ts`, `alt-block.ts`, `compiled-page.ts`, `src/sources/source-id.ts`.
  - Requirements: 4.1, 4.2, 11.1. Verify: `npm run typecheck`
  - Commit: `pages: page, alt block and compiled page types`

- [ ] 3. Registry and lookup: `registry.ts`, `page-lookup.ts`, `test/pages/registry.test.ts`, `page-lookup.test.ts`, `page-lookup.property.test.ts` (Properties 3, 4).
  - Requirements: 2.1 to 2.6, 3.1 to 3.4. Verify: `npm test -- test/pages/registry test/pages/page-lookup`, including `Property 3:` and `Property 4:`
  - Commit: `pages: registry, lookup and neighbours`

- [ ] 4. Frame builder
  - [ ] 4.1 `attribution.ts`, `frame-time.ts`, `frame-rows.ts`, `build-screen.ts`, with `attribution.test.ts`, `frame-time.test.ts`, `build-screen.test.ts`.
    - Requirements: 5.1 to 5.5, 6.1, 6.2, 7.1 to 7.5. Verify: `npm test -- test/pages/attribution test/pages/frame-time test/pages/build-screen.test.ts`
    - Commit: `pages: frame builder for rows 0, 1, 22 and 23`
  - [ ] 4.2 `test/pages/page-arbitraries.ts`, `build-screen.property.test.ts` (Properties 1, 2).
    - Requirements: 5.1, 5.3, 5.4, 5.5, 6.1, 6.2, 7.1 to 7.3, 7.5. Verify: `npm test -- test/pages/build-screen.property.test.ts`, including `Property 1:` and `Property 2:`
    - Commit: `test: frame validity and layout properties`

- [ ] 5. Alt agreement: `alt-agreement.ts`, `check-compiled-page.ts`, their example tests, `alt-agreement.property.test.ts` (Property 6).
  - Requirements: 9.1, 9.2. Verify: `npm test -- test/pages/alt-agreement test/pages/check-compiled-page`, including `Property 6:`
  - Commit: `pages: alt/grid agreement and compiled-page check`

- [ ] 6. Not-in-service screen: `not-in-service.ts`, `not-in-service.test.ts`, `not-in-service.property.test.ts` (Property 5).
  - Requirements: 8.1, 8.2, 8.3, 9.1, 9.2. Verify: `npm test -- test/pages/not-in-service`, including `Property 5:`
  - Commit: `pages: not-in-service screen`

- [ ] 7. HTTP client: `user-agent.ts`, `http.ts`, `test/sources/http.test.ts`, `http.property.test.ts` (Property 10). Fake `fetch` and `delay` only.
  - Requirements: 10.1 to 10.6, 18.2. Verify: `npm test -- test/sources/http`, including `Property 10:`
  - Commit: `sources: HTTP client with timeout, retry and size cap`

- [ ] 8. Requests and schedule: `cities.ts`, `source-requests.ts`, `schedule.ts`, `source-requests.test.ts`, `schedule.property.test.ts` (Property 12).
  - Requirements: 11.2, 11.3, 13.5, 14.1, 14.2. Verify: `npm test -- test/sources/source-requests test/sources/schedule`, including `Property 12:`
  - Commit: `sources: cities, request URLs and schedule data`

- [ ] 9. Recorder: `scripts/lib/record.ts`, `scripts/lib/fixture-files.ts`, `scripts/record-fixtures.ts`, `test/scripts/record.test.ts`. Kiro does not run the script.
  - Requirements: 16.1, 16.2. Verify: `npm test -- test/scripts/record.test.ts && npm run typecheck && npm run lint`
  - Commit: `scripts: fixture recorder`

- [ ] 10. Owner records fixtures: the owner runs `npx tsx scripts/record-fixtures.ts`. Repeat on another day if no two consecutive featured days cover both `news` and `mostread` (`sources.md`). Kiro then lists the files; it does not open them before this.
  - Requirements: 16.1. Verify: `ls test/fixtures/sources/*/*.meta.json | wc -l` and one or more files per source directory
  - Commit (owner): `fixtures: first recording`

- [ ] 11. Source modules, each with `test/sources/<source>.test.ts` and its `synthetic/` files. Wire field names come from the fixtures; if one lacks data for a normalised field, stop and ask.
  - [ ] 11.1 `outcome.ts`, `plain-text.ts`, `wikimedia-feed.ts`, `wikimedia-feed.property.test.ts` (Property 8). Requirements: 12.1 to 12.6, 13.1. Verify: `npm test -- test/sources/wikimedia-feed`, including `Property 8:`. Commit: `sources: Wikimedia featured feed`
  - [ ] 11.2 `wikimedia-onthisday.ts`. Requirements: 12.1 to 12.6. Verify: `npm test -- test/sources/wikimedia-onthisday`. Commit: `sources: Wikimedia on this day`
  - [ ] 11.3 `open-meteo.ts`. Requirements: 12.1 to 12.6, 13.2. Verify: `npm test -- test/sources/open-meteo`. Commit: `sources: Open-Meteo`
  - [ ] 11.4 `frankfurter.ts`. Requirements: 12.1 to 12.6, 13.3. Verify: `npm test -- test/sources/frankfurter`. Commit: `sources: Frankfurter`
  - [ ] 11.5 `hacker-news.ts`, `hacker-news.property.test.ts` (Property 9). Requirements: 12.1 to 12.6, 13.4. Verify: `npm test -- test/sources/hacker-news`, including `Property 9:`. Commit: `sources: Hacker News`
  - [ ] 11.6 `usgs.ts`. Requirements: 12.1 to 12.6. Verify: `npm test -- test/sources/usgs`. Commit: `sources: USGS`
  - [ ] 11.7 `launch-library.ts`. Requirements: 12.1 to 12.6, 13.5. Verify: `npm test -- test/sources/launch-library`. Commit: `sources: Launch Library 2`

- [ ] 12. `fetchers.ts`, `test/sources/source-arbitraries.ts` (JSON variations), `normalisers.property.test.ts` (Property 7).
  - Requirements: 12.1, 12.2, 12.4, 18.1. Verify: `npm test -- test/sources/normalisers.property.test.ts`, including `Property 7:`
  - Commit: `test: normalisers on fixture variations`

- [ ] 13. Snapshot schema: `snapshot.ts`, `snapshot.property.test.ts` (Property 11).
  - Requirements: 15.1, 15.2, 15.3. Verify: `npm test -- test/sources/snapshot.property.test.ts`, including `Property 11:`
  - Commit: `sources: snapshot schema`

- [ ] 14. Boot snapshot: `scripts/lib/fixture-replay.ts`, `scripts/lib/build-snapshot.ts`, `scripts/refresh-snapshot.ts`; run it (no network) to write `snapshot.json`; `test/sources/snapshot.test.ts`.
  - Requirements: 15.4, 16.3, 16.4. Verify: `npx tsx scripts/refresh-snapshot.ts && npm test -- test/sources/snapshot.test.ts`, then a second run leaves `git diff --stat src/sources/snapshot/` empty
  - Commit: `sources: boot snapshot from recorded fixtures`

- [ ] 15. Full gate. Fix failures in the code, never by weakening a validator, schema or test (`tech.md`, rule 3).
  - Requirements: 18.1, 18.2, 18.3. Verify: `npm run typecheck && npm run lint && npm test && npm run build`; quote the `Test Files` and `Tests` lines
  - Commit: none unless a fix was needed

- [ ] 16. Counts: test files, tests, property tests. `npx vitest list | grep -cE "Property [0-9]+:"` must equal grid-core's 20 plus this spec's 12 (32), and `grep -cE "^Property [0-9]+:" .kiro/specs/pages-and-sources/design.md` must print 12.
  - Requirements: 18.1. Verify: the two commands above and `npm test`
  - Commit: `docs: pages-and-sources test counts`
