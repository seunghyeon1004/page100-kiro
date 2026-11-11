# grid-core: tasks

Requirements: `requirements.md`. Design: `design.md`. A task is ticked only after its `Verify` command has run in the session and passed, with the command and its quoted result summary after the tick (`tech.md`, rule 5). Kiro suggests the commit message; the user stages and commits.

Before task 1.1: the open question on `engines` and the toolchain must be answered. Before task 6: the folding departure (requirements, Departures 2) must be agreed.

- [ ] 1. Project scaffold
  - [ ] 1.1 Write `package.json` with the fields and the five scripts, then install the seven dev dependencies with the exact command in `design.md` ("Toolchain"). The install uses the network, so ask the user before running it. Commit `package.json` and `package-lock.json`.
    - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
    - Verify: `npm ls --depth=0` lists exactly `typescript@6.0.3`, `vitest@4.1.12`, `fast-check@4.10.2`, `eslint@10.14.0`, `typescript-eslint@8.72.2`, `prettier@3.9.10`, `@types/node@20.19.43`, with no `UNMET` or `invalid` line
    - Commit: `scaffold: package.json with pinned dev dependencies`
  - [ ] 1.2 Write `tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts`.
    - Requirements: 1.6, 1.7, 1.10
    - Verify: `npm run typecheck` exits 0, and `npx vitest run --passWithNoTests` exits 0
    - Commit: `scaffold: TypeScript and vitest config`
  - [ ] 1.3 Write `eslint.config.js`, `.prettierrc.json`, `.prettierignore` and `.editorconfig`.
    - Requirements: 1.8, 1.9, 1.11
    - Verify: `npm run lint` exits 0, and `npx prettier --file-info .kiro/steering/grid-rules.md` and `npx prettier --file-info docs/kiro-evidence/01-steering-session.txt` both print `"ignored": true`
    - Commit: `scaffold: eslint, prettier and editorconfig`
  - [ ] 1.4 Write `test/scaffold.test.ts` (design, "Example tests").
    - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9, 1.10, 1.11
    - Verify: `npm test -- test/scaffold.test.ts` passes
    - Commit: `test: scaffold config checks`

- [ ] 2. Dimensions, cell types, colours and the blank cell: `src/grid/dimensions.ts`, `types.ts`, `colours.ts`, `blank-cell.ts`, and `test/grid/colours.test.ts`. `relativeLuminance` is in task 3.
  - Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3
  - Verify: `npm run typecheck` exits 0, and `npm test -- test/grid/colours.test.ts` passes
  - Commit: `grid: dimensions, cell types and the eight colours`

- [ ] 3. Contrast: `src/grid/contrast.ts`, `test/grid/contrast.test.ts` (all 64 ratios against the matrix in `grid-rules.md`) and `test/grid/contrast.property.test.ts` (Property 1).
  - Requirements: 3.4, 4.1, 4.2, 4.3, 4.4, 4.5
  - Verify: `npm test -- test/grid/contrast` passes, including a test named `Property 1:`
  - Commit: `grid: contrast computed from RGB`

- [ ] 4. Mosaic mapping: `src/grid/mosaic-code-point.ts`, `test/grid/mosaic-code-point.test.ts` and `test/grid/mosaic-code-point.property.test.ts` (Property 2).
  - Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
  - Verify: `npm test -- test/grid/mosaic-code-point` passes, including `Property 2:`
  - Commit: `grid: mosaic bits to Unicode mapping`

- [ ] 5. Repertoire: `src/grid/repertoire.ts`, `test/grid/repertoire.test.ts` and `test/grid/repertoire.property.test.ts` (Property 3).
  - Requirements: 6.1, 6.2
  - Verify: `npm test -- test/grid/repertoire` passes, including `Property 3:`
  - Commit: `grid: character repertoire`

- [ ] 6. Folding: `src/grid/fold-text.ts`, `test/grid/fold-text.test.ts` (every example in 7.3 to 7.9) and `test/grid/fold-text.property.test.ts` (Properties 4, 5 and 6). Blocked until the folding departure is agreed.
  - Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12
  - Verify: `npm test -- test/grid/fold-text` passes, including `Property 4:`, `Property 5:` and `Property 6:`
  - Commit: `grid: fold source text into the repertoire`

- [ ] 7. validateGrid
  - [ ] 7.1 Write `src/grid/grid-violation.ts`, `check-cell.ts`, `check-rows.ts` and `validate-grid.ts`, add `isBlankCell` to `blank-cell.ts`, and write `test/grid/validate-grid.test.ts` with one minimal input and exact message per code and the edge cases listed in the design.
    - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 9.1 to 9.11, 10.1 to 10.5, 1.7
    - Verify: `npm test -- test/grid/validate-grid.test.ts` passes, and `npm run build` exits 0 with `dist/grid/validate-grid.js` present (`ls dist/grid/validate-grid.js`)
    - Commit: `grid: validateGrid with ValidPage brand`
  - [ ] 7.2 Write `test/grid/arbitraries.ts` and `test/grid/validate-grid.property.test.ts` (Properties 7, 8, 9 and 12).
    - Requirements: 8.1, 8.2, 8.3, 8.8, 8.9, 8.10, 9.1 to 9.11, 10.1, 10.2, 10.4, 12.1, 12.6
    - Verify: `npm test -- test/grid/validate-grid.property.test.ts` passes, including `Property 7:`, `Property 8:`, `Property 9:` and `Property 12:`
    - Commit: `test: validateGrid properties`

- [ ] 8. validateContentRows
  - [ ] 8.1 Write `src/grid/validate-content-rows.ts` on top of `check-rows.ts`, and `test/grid/validate-content-rows.test.ts`.
    - Requirements: 12.1, 12.2, 12.3, 12.4, 12.6
    - Verify: `npm test -- test/grid/validate-content-rows.test.ts` passes
    - Commit: `grid: validateContentRows with ValidContent brand`
  - [ ] 8.2 Write `test/grid/validate-content-rows.property.test.ts` (Properties 10 and 11).
    - Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
    - Verify: `npm test -- test/grid/validate-content-rows.property.test.ts` passes, including `Property 10:` and `Property 11:`
    - Commit: `test: content rows agree with full-grid validation`

- [ ] 9. Brand and boundary checks: `test/grid/types.test.ts` (the `@ts-expect-error` lines) and `test/boundaries.test.ts`.
  - Requirements: 2.4, 11.1, 18.1, 18.2, 18.3, 19.3, 19.4, 20.2
  - Verify: `npm run typecheck` exits 0, and `npm test -- test/grid/types.test.ts test/boundaries.test.ts` passes
  - Commit: `test: brand types and module boundaries`

- [ ] 10. Parser
  - [ ] 10.1 Write `src/markup/markup-error.ts`, `split-lines.ts`, `parse-row.ts` and `parse-page.ts`, and `test/markup/parse-page.test.ts`.
    - Requirements: 13.1, 13.2, 13.3, 13.5, 13.6, 13.7, 14.1 to 14.8, 15.1, 15.2, 15.3, 15.4, 15.6
    - Verify: `npm test -- test/markup/parse-page.test.ts` passes
    - Commit: `markup: page parser with row and column errors`
  - [ ] 10.2 Write `src/markup/parse-content.ts` and `test/markup/parse-content.test.ts`.
    - Requirements: 13.1, 13.4, 15.3, 15.4, 15.5, 15.6
    - Verify: `npm test -- test/markup/parse-content.test.ts` passes
    - Commit: `markup: content parser for pages/ files`
  - [ ] 10.3 Write `test/markup/markup-arbitraries.ts` (the noisy writer), `test/markup/parse-page.property.test.ts` (Property 13) and `test/markup/parse-content.property.test.ts` (Property 14).
    - Requirements: 13.1, 13.3, 13.4, 13.5, 13.7, 13.8, 14.4, 14.7, 15.1 to 15.5
    - Verify: `npm test -- test/markup/parse-page.property.test.ts test/markup/parse-content.property.test.ts` passes, including `Property 13:` and `Property 14:`
    - Commit: `test: parser properties`

- [ ] 11. Serialiser
  - [ ] 11.1 Write `src/markup/serialise-row.ts` and `serialise-page.ts`, and `test/markup/serialise-page.test.ts`.
    - Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7
    - Verify: `npm test -- test/markup/serialise-page.test.ts` passes
    - Commit: `markup: canonical page serialiser`
  - [ ] 11.2 Write `src/markup/serialise-content.ts` and `test/markup/serialise-content.test.ts`.
    - Requirements: 16.1, 16.6
    - Verify: `npm test -- test/markup/serialise-content.test.ts` passes
    - Commit: `markup: canonical content serialiser`
  - [ ] 11.3 Write `test/markup/serialise-page.property.test.ts` (Properties 15, 17, 18, 19 and 20) and `test/markup/serialise-content.property.test.ts` (Property 16).
    - Requirements: 16.2 to 16.7, 17.1, 17.2, 17.3, 17.4
    - Verify: `npm test -- test/markup/serialise-page.property.test.ts test/markup/serialise-content.property.test.ts` passes, including `Property 15:` to `Property 20:`
    - Commit: `test: round-trip and canonical form properties`

- [ ] 12. Run the full gate on the finished feature. Fix any failure in the code, never by weakening a validator, schema or test (`tech.md`, rule 3).
  - Requirements: 20.1, 20.2, 19.1, 19.2
  - Verify: `npm run typecheck && npm run lint && npm test` exits 0, then `npm run build` exits 0. Quote the vitest summary lines (`Test Files ... passed`, `Tests ... passed`).
  - Commit: none unless a fix was needed

- [ ] 13. Record how many tests and properties exist. Add the counts to this task's tick line: test files, tests, and property tests. The property count must equal the number of properties in `design.md`; if it does not, task 12 is not done.
  - Requirements: 19.1
  - Verify: `npm test` (quote `Test Files` and `Tests`), `npx vitest list | grep -cE "Property [0-9]+:"` and `grep -cE "^Property [0-9]+:" .kiro/specs/grid-core/design.md`. The last two print the same number, 20.
  - Commit: `docs: grid-core test counts`
