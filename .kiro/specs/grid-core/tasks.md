# grid-core: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result summary after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits.

Open questions, answered by the owner and recorded in `requirements.md` (Departures 2, 3, 5 and 6) and in `grid-rules.md`: folding step 3 is agreed; `engines` is `>=20.19.0`; the toolchain versions are confirmed and the npm install in `design.md` may run; the fixed replacement table is extended (requirement 7.13); the sextant example is corrected to `BLOCK SEXTANT-235`. No task is blocked.

- [x] 1. Project scaffold
  - [x] 1.1 Write `package.json` with the fields and the five scripts, then install the seven dev dependencies with the exact command in `design.md` ("Toolchain"). The owner allowed this npm install (network use for npm only). Commit `package.json` and `package-lock.json`.
    - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
    - Verify: `npm ls --depth=0` lists exactly `typescript@6.0.3`, `vitest@4.1.12`, `fast-check@4.10.2`, `eslint@10.14.0`, `typescript-eslint@8.72.2`, `prettier@3.9.10`, `@types/node@20.19.43`, with no `UNMET` or `invalid` line
    - Done: `npm ls --depth=0` printed `page100@0.1.0` and those seven packages, one per line, with no UNMET or invalid line. Note: the combined install command failed inside npm with `Cannot read properties of null (reading 'edgesOut')`. `vitest@4.1.12` alone also failed that way, so it was installed with `--legacy-peer-deps` (a flag only; `package.json` pins are unchanged). `npm audit` reports 9 moderate advisories in the dev-only tree.
    - Commit: `scaffold: package.json with pinned dev dependencies`
  - [x] 1.2 Write `tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts`.
    - Requirements: 1.6, 1.7, 1.10
    - Verify: `npm run typecheck` exits 0, and `npx vitest run --passWithNoTests` exits 0
    - Done: `npm run typecheck` exit 0. `npx vitest run --passWithNoTests` exit 0 with "No test files found, exiting with code 0". The build config is checked in task 7.1.
    - Commit: `scaffold: TypeScript and vitest config`
  - [x] 1.3 Write `eslint.config.js`, `.prettierrc.json`, `.prettierignore` and `.editorconfig`.
    - Requirements: 1.8, 1.9, 1.11
    - Verify: `npm run lint` exits 0, and `npx prettier --file-info .kiro/steering/grid-rules.md` and `npx prettier --file-info docs/kiro-evidence/01-steering-session.txt` both print `"ignored": true`
    - Done: `npm run lint` exit 0 ("All matched files use Prettier code style!"). Both `--file-info` commands print `{ "ignored": true, "inferredParser": null }`. `eslint.config.js` was run through `prettier --write` once.
    - Commit: `scaffold: eslint, prettier and editorconfig`
  - [x] 1.4 Write `test/scaffold.test.ts` (design, "Example tests").
    - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 1.10, 1.11
    - Verify: `npm test -- test/scaffold.test.ts` passes
    - Done: `npm test -- test/scaffold.test.ts` → "Test Files 1 passed (1)", "Tests 15 passed (15)". `npm run lint` exit 0 after adding the file.
    - Commit: `test: scaffold config checks`

- [x] 2. Dimensions, cell types, colours and the blank cell: `src/grid/dimensions.ts`, `types.ts`, `colours.ts`, `blank-cell.ts`, and `test/grid/colours.test.ts`. `relativeLuminance` is in task 3.
  - Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3
  - Verify: `npm run typecheck` exits 0, and `npm test -- test/grid/colours.test.ts` passes
  - Done: `npm run typecheck` exit 0. `npm test -- test/grid/colours.test.ts` → "Test Files 1 passed (1)", "Tests 6 passed (6)".
  - Commit: `grid: dimensions, cell types and the eight colours`

- [x] 3. Contrast: `src/grid/contrast.ts`, `test/grid/contrast.test.ts` (all 64 ratios against the matrix in `grid-rules.md`) and `test/grid/contrast.property.test.ts` (Property 1).
  - Requirements: 3.4, 4.1, 4.2, 4.3, 4.4, 4.5
  - Verify: `npm test -- test/grid/contrast` passes, including a test named `Property 1:`
  - Done: `npm test -- test/grid/contrast` → "Test Files 2 passed (2)", "Tests 8 passed (8)", including `Property 1: for all colours fg and bg, ...`. One check first failed because the number 21 in a doc comment matched the literal scan. I reworded the comment and left the test as it was.
  - Commit: `grid: contrast computed from RGB`

- [x] 4. Mosaic mapping: `src/grid/mosaic-code-point.ts`, `test/grid/mosaic-code-point.test.ts` and `test/grid/mosaic-code-point.property.test.ts` (Property 2).
  - Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
  - Verify: `npm test -- test/grid/mosaic-code-point` passes, including `Property 2:`
  - Done: `npm test -- test/grid/mosaic-code-point` → "Test Files 2 passed (2)", "Tests 6 passed (6)", including `Property 2: the mapping inverts exactly, ...`.
  - Commit: `grid: mosaic bits to Unicode mapping`

- [x] 5. Repertoire: `src/grid/repertoire.ts`, `test/grid/repertoire.test.ts` and `test/grid/repertoire.property.test.ts` (Property 3).
  - Requirements: 6.1, 6.2
  - Verify: `npm test -- test/grid/repertoire` passes, including `Property 3:`
  - Done: `npm test -- test/grid/repertoire` → "Test Files 2 passed (2)", "Tests 7 passed (7)". The first run failed because the code listed U+20AC before U+00C0, so `REPERTOIRE` was not ascending. I fixed the range order in `repertoire.ts`.
  - Commit: `grid: character repertoire`

- [x] 6. Folding: `src/grid/fold-text.ts`, `test/grid/fold-text.test.ts` (every example in 7.3 to 7.9, 7.13 and 7.14) and `test/grid/fold-text.property.test.ts` (Properties 4, 5 and 6). The folding departure is agreed, so this task is not blocked.
  - Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14
  - Verify: `npm test -- test/grid/fold-text` passes, including `Property 4:`, `Property 5:` and `Property 6:`
  - Done: `npm test -- test/grid/fold-text` → "Test Files 2 passed (2)", "Tests 17 passed (17)", including the three `Property` tests. Two example expectations were wrong in my first draft (`"\u1fb00"` is not U+1FB00; the first-appearance order in one example). I corrected the tests, not the code.
  - Commit: `grid: fold source text into the repertoire`

- [x] 7. validateGrid
  - [x] 7.1 Write `src/grid/grid-violation.ts`, `check-cell.ts`, `check-rows.ts` and `validate-grid.ts`, add `isBlankCell` to `blank-cell.ts`, and write `test/grid/validate-grid.test.ts` with one minimal input and exact message per code and the edge cases listed in the design.
    - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 9.1 to 9.11, 10.1 to 10.5, 1.7
    - Verify: `npm test -- test/grid/validate-grid.test.ts` passes, and `npm run build` exits 0 with `dist/grid/validate-grid.js` present (`ls dist/grid/validate-grid.js`)
    - Done: `npm test -- test/grid/validate-grid.test.ts` → "Test Files 1 passed (1)", "Tests 39 passed (39)". `npm run build` exit 0, and `ls dist/grid/validate-grid.js` prints `dist/grid/validate-grid.js`. Lint was clean after one `dot-notation` fix in a test.
    - Commit: `grid: validateGrid with ValidPage brand`
  - [x] 7.2 Write `test/grid/arbitraries.ts` and `test/grid/validate-grid.property.test.ts` (Properties 7, 8, 9 and 12).
    - Requirements: 8.1, 8.2, 8.3, 8.8, 8.9, 8.10, 9.1 to 9.11, 10.1, 10.2, 10.4, 12.1, 12.6
    - Verify: `npm test -- test/grid/validate-grid.property.test.ts` passes, including `Property 7:`, `Property 8:`, `Property 9:` and `Property 12:`
    - Done: `npm test -- test/grid/validate-grid.property.test.ts` → "Test Files 1 passed (1)", "Tests 4 passed (4)", including the four named properties. Property 7 here covers `validateGrid` only. Task 8.2 extends it to `validateContentRows`. A first run failed in fast-check's own value inspection on a revoked Proxy, so the exotic inputs are now built inside the property.
    - Commit: `test: validateGrid properties`

- [x] 8. validateContentRows
  - [x] 8.1 Write `src/grid/validate-content-rows.ts` on top of `check-rows.ts`, and `test/grid/validate-content-rows.test.ts`.
    - Requirements: 12.1, 12.2, 12.3, 12.4, 12.6
    - Verify: `npm test -- test/grid/validate-content-rows.test.ts` passes
    - Done: `npm test -- test/grid/validate-content-rows.test.ts` → "Test Files 1 passed (1)", "Tests 8 passed (8)".
    - Commit: `grid: validateContentRows with ValidContent brand`
  - [x] 8.2 Write `test/grid/validate-content-rows.property.test.ts` (Properties 10 and 11). Also extended Property 7 in `validate-grid.property.test.ts` to call `validateContentRows`, as design.md lists.
    - Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
    - Verify: `npm test -- test/grid/validate-content-rows.property.test.ts` passes, including `Property 10:` and `Property 11:`
    - Done: `npm test -- test/grid/validate-content-rows.property.test.ts` → "Test Files 1 passed (1)", "Tests 2 passed (2)". Then `npm test -- test/grid` → "Test Files 13 passed (13)", "Tests 97 passed (97)", with Property 7 covering both validators. A first Property 11 run failed because the generator produced invalid rows when its pool was empty. I fixed the generator to produce exactly n valid rows.
    - Commit: `test: content rows agree with full-grid validation`

- [x] 9. Brand and boundary checks: `test/grid/types.test.ts` (the `@ts-expect-error` lines) and `test/boundaries.test.ts`.
  - Requirements: 2.4, 11.1, 18.1, 18.2, 18.3, 19.3, 19.4, 20.2
  - Verify: `npm run typecheck` exits 0, and `npm test -- test/grid/types.test.ts test/boundaries.test.ts` passes
  - Done: `npm run typecheck` exit 0. `npm test -- test/grid/types.test.ts test/boundaries.test.ts` → "Test Files 2 passed (2)", "Tests 9 passed (9)". The first boundary run found the test's own titles and messages containing banned strings, and one `readdirSync` typing error. I reworded the test, not the rule.
  - Commit: `test: brand types and module boundaries`

- [x] 10. Parser
  - [x] 10.1 Write `src/markup/markup-error.ts`, `split-lines.ts`, `parse-row.ts` and `parse-page.ts`, and `test/markup/parse-page.test.ts`.
    - Requirements: 13.1, 13.2, 13.3, 13.5, 13.6, 13.7, 14.1 to 14.8, 15.1, 15.2, 15.3, 15.4, 15.6
    - Verify: `npm test -- test/markup/parse-page.test.ts` passes
    - Done: `npm test -- test/markup/parse-page.test.ts` → "Test Files 1 passed (1)", "Tests 26 passed (26)". The first run failed in my test helper: joining 24 lines with LF drops a blank last row, because a final LF ends the last line. The helper now ends every line with LF.
    - Commit: `markup: page parser with row and column errors`
  - [x] 10.2 Write `src/markup/parse-content.ts` and `test/markup/parse-content.test.ts`.
    - Requirements: 13.1, 13.4, 15.3, 15.4, 15.5, 15.6
    - Verify: `npm test -- test/markup/parse-content.test.ts` passes
    - Done: `npm test -- test/markup/parse-content.test.ts` → "Test Files 1 passed (1)", "Tests 12 passed (12)".
    - Commit: `markup: content parser for pages/ files`
  - [x] 10.3 Write `test/markup/markup-arbitraries.ts` (the noisy writer), `test/markup/parse-page.property.test.ts` (Property 13) and `test/markup/parse-content.property.test.ts` (Property 14).
    - Requirements: 13.1, 13.3, 13.4, 13.5, 13.7, 13.8, 14.4, 14.7, 15.1 to 15.5
    - Verify: `npm test -- test/markup/parse-page.property.test.ts test/markup/parse-content.property.test.ts` passes, including `Property 13:` and `Property 14:`
    - Done: `npm test -- test/markup/parse-page.property.test.ts test/markup/parse-content.property.test.ts` → "Test Files 2 passed (2)", "Tests 3 passed (3)" (Property 13, Property 14, and a sanity check that the unchanged rows parse). Then `npm test -- test/markup` → "Test Files 4 passed (4)", "Tests 41 passed (41)". `npm run lint` exit 0 after removing one unused import.
    - Commit: `test: parser properties`

- [x] 11. Serialiser
  - [x] 11.1 Write `src/markup/serialise-row.ts` and `serialise-page.ts`, and `test/markup/serialise-page.test.ts`.
    - Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7
    - Verify: `npm test -- test/markup/serialise-page.test.ts` passes
    - Done: `npm test -- test/markup/serialise-page.test.ts` → "Test Files 1 passed (1)", "Tests 9 passed (9)".
    - Commit: `markup: canonical page serialiser`
  - [x] 11.2 Write `src/markup/serialise-content.ts` and `test/markup/serialise-content.test.ts`.
    - Requirements: 16.1, 16.6
    - Verify: `npm test -- test/markup/serialise-content.test.ts` passes
    - Done: `npm test -- test/markup/serialise-content.test.ts` → "Test Files 1 passed (1)", "Tests 4 passed (4)".
    - Commit: `markup: canonical content serialiser`
  - [x] 11.3 Write `test/markup/serialise-page.property.test.ts` (Properties 15, 17, 18, 19 and 20) and `test/markup/serialise-content.property.test.ts` (Property 16).
    - Requirements: 16.2 to 16.7, 17.1, 17.2, 17.3, 17.4
    - Verify: `npm test -- test/markup/serialise-page.property.test.ts test/markup/serialise-content.property.test.ts` passes, including `Property 15:` to `Property 20:`
    - Done: `npm test -- test/markup/serialise-page.property.test.ts test/markup/serialise-content.property.test.ts` → "Test Files 2 passed (2)", "Tests 7 passed (7)", including Properties 15, 16, 17, 18, 19 (page and content) and 20. Two bugs were in my test code, not the serialiser: a scanner that read every tag as three characters, and a generator that could add a toggle pair while the mode was on. Both are fixed in the tests.
    - Commit: `test: round-trip and canonical form properties`

- [x] 12. Run the full gate on the finished feature. Fix any failure in the code, never by weakening a validator, schema or test (`tech.md`, rule 3).
  - Requirements: 20.1, 20.2, 19.1, 19.2
  - Verify: `npm run typecheck && npm run lint && npm test` exits 0, then `npm run build` exits 0. Quote the vitest summary lines (`Test Files ... passed`, `Tests ... passed`).
  - Done: `npm run typecheck` exit 0; `npm run lint` exit 0 ("All matched files use Prettier code style!"); `npm test` exit 0 with "Test Files 24 passed (24)" and "Tests 183 passed (183)"; `npm run build` exit 0, and `dist/grid/` and `dist/markup/` are emitted.
  - Commit: none unless a fix was needed

- [x] 13. Record how many tests and properties exist. Add the counts to this task's tick line: test files, tests, and property tests. The property count must equal the number of properties in `design.md`; if it does not, task 12 is not done.
  - Requirements: 19.1
  - Verify: `npm test` (quote `Test Files` and `Tests`), `npx vitest list | grep -cE "Property [0-9]+:"` and `grep -cE "^Property [0-9]+:" .kiro/specs/grid-core/design.md`. The last two print the same number, 20.
  - Counts: 24 test files, 183 tests, 20 property tests (`Property 1:` to `Property 20:`, one test each). `npx vitest list | grep -cE "Property [0-9]+:"` prints 20, and `grep -cE "^Property [0-9]+:" .kiro/specs/grid-core/design.md` prints 20.
  - Commit: `docs: grid-core test counts`
