# grid-core: requirements

Spec for the project scaffold, `src/grid` (cell model, colours, contrast, mosaics, repertoire, folding, validators) and `src/markup` (parser and canonical serialiser). The contract is `.kiro/steering/grid-rules.md`. This spec pins down what that file leaves open, and lists every place it departs from it.

Rows and columns are numbered from 0. "Page row" means a row number from 0 to 23 on the full screen.

## Glossary

- **Cell, TextCell, MosaicCell, Colour, Grid**: as defined in `grid-rules.md`, "Cell model".
- **Content rows**: the 20 rows that compilers and `pages/` files supply, page rows 2-21.
- **ValidPage**: a branded 24 x 40 grid. Only `validateGrid` returns one.
- **ValidContent**: a branded 20 x 40 set of content rows. Only `validateContentRows` returns one.
- **Blank cell**: `{ kind: "text", ch: " ", fg: "white", bg: "black", conceal: false }`.
- **Violation**: one problem found by a validator, with a stable string `code`.
- **Markup error**: one problem found by the parser, with a stable string `code`.
- **Page markup**: markup for a full screen (24 lines). **Content markup**: markup for a `pages/` file (1 to 20 lines, rows 2-21).
- **Canonical markup**: the exact output of `serialisePage` or `serialiseContent`.
- **The repertoire**: the 160 code points listed in requirement 6.

## Departures

1. **Merged spec.** `kiro-workflow.md` plans `grid-core` and `page-markup` as two specs. This spec covers both, plus the project scaffold. Reason: the user asked for it, and nothing can be tested before the scaffold exists.
2. **Folding, step 3.** `grid-rules.md` says to apply "NFD with combining marks stripped" to the whole string. Applied to the whole string, that step also strips accents from letters that are in the repertoire: `"café"` becomes `"cafe"` (checked in Node 24.5). This spec applies step 3 only to code points that are still outside the repertoire after step 2 (requirement 7.2). Agreed by the owner. `grid-rules.md` is corrected to match.
3. **Sextant example.** `grid-rules.md` says "`BLOCK SEXTANT-135` has bits 0, 2 and 4". Unicode has no such character: bits 0, 2 and 4 make v = 21, which maps to U+258C LEFT HALF BLOCK. This spec uses `BLOCK SEXTANT-235` (v = 22, bits 1, 2 and 4, U+1FB14) as the worked example. The mapping rule itself is unchanged. Corrected by the owner's answer: `grid-rules.md` now uses the v = 22 example. The mapping is checked by four anchor examples (requirement 5.2) and an order test (requirement 5.5). No Unicode data file is downloaded.
4. **Row and column on whole-grid problems.** `grid-rules.md` invariant 3 says each violation has a row and a column, and "Page markup" says every parse error reports a row and a column. Some problems have no cell: the input is not an array, a row is not an array, a page has the wrong number of lines. For these, `row` and/or `col` is `null` (requirements 10.2 and 15.2) rather than a made-up coordinate.
5. **Fixed replacement table.** `grid-rules.md` listed six fixed replacements. The owner added the entries of requirement 7.13 (`Ł`, `ł`, `Đ`, `đ`, `Œ`, `œ`, `ı`, the guillemets, four spaces, the soft hyphen, the dashes, the minus sign and the two prime marks). `grid-rules.md` is updated to match. Requirements 7.9 and 7.13 change to suit: `Ł`, `œ`, `ı`, `«`, U+2009 and U+202F now fold, so they leave the failing list.
6. **Node engine.** Requirement 1.1 sets `"engines": { "node": ">=20.19.0" }`, agreed by the owner. `tech.md` says "Node 20 or later". The stricter range changes a product rule, so `tech.md` needs the owner's edit too. This spec does not change it.

## Decisions where the steering files are silent

- Both validators and the parser report rows as page rows. Content row 0 is page row 2, and line 1 of a `pages/` file is page row 2.
- `validateGrid` checks shape and cell rules on all 24 rows. It does not check the layouts of rows 0, 1, 22 and 23; that belongs to the `page-frame` spec.
- The parser checks syntax and the repertoire, not contrast. Contrast is checked only by the validators.
- Canonical content markup drops trailing blank rows (requirement 16.6).
- Runtime dependencies (`zod`, `@anthropic-ai/sdk`) and the dev tools that no script uses yet (`tsx`, `@playwright/test`) are not installed by this spec. The spec that first uses each one adds it.

## Requirement 1: Project scaffold

**User story:** As a developer, I want a pinned, strict TypeScript project, so that every later spec can be built, linted and tested the same way on any machine.

1.1 THE `package.json` file SHALL contain `"name": "page100"`, `"version": "0.1.0"`, `"private": true`, `"type": "module"`, `"license": "MIT"` and `"engines": { "node": ">=20.19.0" }`.

1.2 THE `package.json` file SHALL define exactly these scripts and no others: `build` = `tsc -p tsconfig.build.json`, `test` = `vitest run`, `typecheck` = `tsc --noEmit`, `lint` = `eslint . && prettier --check .`, `format` = `prettier --write .`.

1.3 THE `package.json` file SHALL list exactly these `devDependencies`: `typescript` 6.0.3, `vitest` 4.1.12, `fast-check` 4.10.2, `eslint` 10.14.0, `typescript-eslint` 8.72.2, `prettier` 3.9.10, `@types/node` 20.19.43.

1.4 THE `package.json` file SHALL have no `dependencies`, `optionalDependencies` or `peerDependencies` field.

1.5 THE version strings in `devDependencies` SHALL each match `^\d+\.\d+\.\d+$` (no `^`, `~`, range, tag, URL or `latest`), AND THE repository SHALL contain a `package-lock.json` with `"lockfileVersion": 3`.

1.6 THE `tsconfig.json` file SHALL set `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` and `noEmit` to `true`, `module` and `moduleResolution` to `NodeNext`, `target` to `ES2023`, `lib` to `["ES2023"]` and `types` to `["node"]`, and SHALL include `src`, `test` and `vitest.config.ts`.

1.7 WHEN `npm run build` runs, THE compiler SHALL use `tsconfig.build.json`, which extends `tsconfig.json`, includes only `src`, sets `noEmit` to `false`, `rootDir` to `src` and `outDir` to `dist`, so that `src/grid/validate-grid.ts` is emitted as `dist/grid/validate-grid.js` and no file from `test/` is emitted.

1.8 THE `eslint.config.js` file SHALL be an ESLint flat config that applies the typescript-eslint `strictTypeChecked` and `stylisticTypeChecked` configs to `.ts` files with `projectService` enabled, lints `.js` files without type information, ignores `dist/`, bans `@ts-ignore`, and allows `@ts-expect-error` only with a description of at least 10 characters.

1.9 THE `.prettierignore` file SHALL list `dist/`, `coverage/`, `package-lock.json`, `.kiro/`, `docs/` and `test/fixtures/`, so that `npm run format` never rewrites steering files, specs, evidence transcripts or recorded fixtures. THE `.prettierrc.json` file SHALL set `printWidth` to 100 and nothing else.

1.10 THE `vitest.config.ts` file SHALL include `test/**/*.test.ts`, exclude `test/e2e/**`, and set the test environment to `node`.

1.11 THE `.editorconfig` file SHALL set `root = true` and, for all files, `charset = utf-8`, `end_of_line = lf`, `insert_final_newline = true`, `indent_style = space`, `indent_size = 2` and `trim_trailing_whitespace = true`, AND SHALL set `trim_trailing_whitespace = false` for `*.md` and `*.page` files (trailing spaces carry meaning in both).

## Requirement 2: Dimensions and cell types

**User story:** As a module author, I want one definition of the grid's size and cell types, so that every module agrees on them.

2.1 THE module `src/grid/dimensions.ts` SHALL export `GRID_ROWS = 24`, `GRID_COLS = 40`, `CONTENT_FIRST_ROW = 2` and `CONTENT_ROW_COUNT = 20`.

2.2 THE module `src/grid/types.ts` SHALL export the types `Colour`, `TextCell`, `MosaicCell`, `Cell`, `Grid`, `ContentRows`, `ValidPage`, `ValidContent` and `NonEmpty<T>`, with every field of `TextCell` and `MosaicCell` exactly as in `grid-rules.md` and marked `readonly`.

2.3 THE module `src/grid/blank-cell.ts` SHALL export `BLANK_CELL`, a frozen blank cell.

2.4 THE types `ValidPage` and `ValidContent` SHALL be branded so that a value typed `Grid` or `ContentRows` cannot be assigned to either without a type assertion, AND `ValidPage` and `ValidContent` SHALL not be assignable to each other. A test file compiled by `npm run typecheck` checks each of these with an `@ts-expect-error` line.

## Requirement 3: Colours

**User story:** As a renderer author, I want the eight colours defined once with exact values, so that every output uses the same colours.

3.1 THE module `src/grid/colours.ts` SHALL export `COLOURS`, the tuple `["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"]` in that order.

3.2 THE module `src/grid/colours.ts` SHALL give each colour the RGB value in the `grid-rules.md` colour table (for example magenta = 255, 0, 255).

3.3 THE module `src/grid/colours.ts` SHALL give each colour its foreground markup letter (`k r g y b m c w` for black to white) and its background letter (the same letter in upper case).

3.4 THE function `relativeLuminance` SHALL compute WCAG 2.x relative luminance from RGB with the linearisation threshold 0.04045, giving the values in the colour table when rounded to 4 decimals (black 0.0000, blue 0.0722, white 1.0000).

## Requirement 4: Text contrast

**User story:** As a visitor, I want every piece of text to be legible, so that I can read every page.

4.1 THE function `contrastRatio(fg, bg)` SHALL return `(Lmax + 0.05) / (Lmin + 0.05)` computed from the RGB values in requirement 3.2, AND no value from the full matrix in `grid-rules.md` other than 1.00 (for example `5.25`, `15.3` or `21`) SHALL appear as a numeric literal in `src/grid/contrast.ts`.

4.2 THE function `contrastRatio` SHALL return, for each of the 64 fg/bg pairs, a value that rounds to 2 decimals as the matching entry of the full matrix in `grid-rules.md`.

4.3 THE function `contrastRatio(a, b)` SHALL return exactly the same number as `contrastRatio(b, a)` for every pair of colours.

4.4 THE function `isLegibleText(fg, bg)` SHALL return `true` when `contrastRatio(fg, bg) >= 4.5`, compared unrounded, and `false` otherwise, so that it returns `true` for exactly the 20 pairs listed in `grid-rules.md` and for no other pair.

4.5 THE function `isLegibleText` SHALL return `false` for white on red (4.00:1) and `true` for red on black (5.25:1).

## Requirement 5: Mosaic mapping

**User story:** As a page author, I want each of the 64 mosaic patterns to have exactly one Unicode form, so that mosaics survive every round trip.

5.1 THE function `mosaicCodePoint(v)` SHALL return, for each integer v from 0 to 63: U+0020 for 0, U+258C for 21, U+2590 for 42, U+2588 for 63, and `0x1FB00 + v - 1 - (v > 21 ? 1 : 0) - (v > 42 ? 1 : 0)` for every other v.

5.2 THE function `mosaicCodePoint` SHALL return U+1FB00 for v = 1 (`BLOCK SEXTANT-1`), U+1FB14 for v = 22 (`BLOCK SEXTANT-235`), U+1FB28 for v = 43 (`BLOCK SEXTANT-1246`) and U+1FB3B for v = 62 (`BLOCK SEXTANT-23456`).

5.3 THE function `mosaicBitsOf(cp)` SHALL return v when `cp === mosaicCodePoint(v)` for some v from 0 to 63, and `undefined` for every other value.

5.4 IF `mosaicCodePoint` receives a value that is not an integer from 0 to 63 (for example -1, 64, 1.5 or `NaN`), THEN THE function SHALL return `undefined` without throwing.

5.5 THE function `mosaicCodePoint` SHALL be strictly increasing over the 60 values of v in 1-62 other than 21 and 42, giving the 60 code points U+1FB00 to U+1FB3B in order.

## Requirement 6: Character repertoire

**User story:** As a font and renderer author, I want the allowed characters defined once, so that the validator, the parser, folding and the font subset agree.

6.1 THE module `src/grid/repertoire.ts` SHALL export `REPERTOIRE`, a frozen array of exactly 160 code points in ascending order: U+0020 to U+007E (95), U+00A3, U+00B0, U+20AC (3), and U+00C0 to U+00FF except U+00D7 and U+00F7 (62).

6.2 THE function `isRepertoireCodePoint(cp)` SHALL return `true` exactly for the code points in `REPERTOIRE`, and `false` for every other value, including U+00D7, U+00F7, U+00A0, U+007F, U+0009, U+000A, U+000D, U+2588, U+258C, U+2590, U+1FB00 to U+1FB3B, U+D800 to U+DFFF, non-integers and values outside 0 to U+10FFFF.

## Requirement 7: Folding source text

**User story:** As a compiler author, I want one function that brings source text into the repertoire or says it cannot, so that no page ever shows a substitute character.

7.1 THE function `foldText(input: string)` SHALL return either `{ ok: true, text }` or `{ ok: false, code: "fold-unrepresentable", codePoints }`, AND a failed result SHALL contain no text.

7.2 THE function `foldText` SHALL apply these steps in this order: (1) NFC; (2) the fixed replacements of requirement 7.13, one code point at a time; (3) only to each code point that is still outside the repertoire after step 2, replace it by its NFD decomposition with every code point of General_Category Mark (`\p{M}`) removed (repertoire code points, including accented letters, keep their marks); (4) NFC.

7.3 WHEN the input is the empty string, THE function `foldText` SHALL return `{ ok: true, text: "" }`.

7.4 WHEN every code point of the input is in the repertoire, THE function `foldText` SHALL return the input unchanged (for example `"Zürich: 14°C, £5, €3, café"`).

7.5 WHEN the input contains characters with fixed replacements, THE function `foldText` SHALL return the replaced text (for example `‘Hi’ – “no” … 3×4` becomes `'Hi' - "no" ... 3x4`).

7.6 WHEN the input contains a decomposed sequence whose NFC form is in the repertoire, THE function `foldText` SHALL return the precomposed form (`"e\u0301"` becomes `"é"`).

7.7 WHEN the input contains a letter outside the repertoire whose canonical decomposition is a repertoire letter plus marks, THE function `foldText` SHALL return that letter without the marks (`"Dvořák"` becomes `"Dvorák"`, `"Şişli"` becomes `"Sisli"`, `"ő"` becomes `"o"`).

7.8 WHEN the input contains a combining mark that does not compose with the code point before it, THE function `foldText` SHALL remove the mark (`"x\u0301"` becomes `"x"`).

7.9 IF any code point is outside the repertoire after step 4, THEN THE function `foldText` SHALL fail, with `codePoints` listing each such code point once, in order of first appearance. This covers at least: letters with no canonical decomposition that are not in the table of 7.13 (U+0126 `Ħ`, U+0166 `Ŧ`); other scripts (U+03B1 `α`, U+0434 `д`, U+4E2D); U+00F7 `÷`; symbols outside the repertoire (U+00A9 `©`, U+00B6 `¶`, U+00BD `½`, U+00A5 `¥`); control characters including U+0009, U+000A, U+000D and U+007F; spaces other than U+0020, U+00A0 and the spaces of 7.13 (U+200B); emoji (U+1F600); mosaic code points (U+2588, U+1FB00); private use (U+E000); and lone surrogates (U+D800, reported as 0xD800).

7.10 THE function `foldText` SHALL never throw for any JavaScript string, including strings with lone surrogates.

7.11 THE function `foldText` SHALL be idempotent: for every string s, IF `foldText(s)` returns `{ ok: true, text: t }`, THEN `foldText(t)` SHALL return `{ ok: true, text: t }`.

7.12 WHEN `foldText` succeeds, every code point of its `text` SHALL be in the repertoire.

7.13 THE fixed replacements of step 2 SHALL be exactly these, and no others: U+2018 and U+2019 to `'`; U+201C and U+201D to `"`; U+2013 and U+2014 to `-`; U+2026 to `...`; U+00A0 to U+0020; U+00D7 to `x`; U+0141 `Ł` to `L`; U+0142 `ł` to `l`; U+0110 `Đ` to `D`; U+0111 `đ` to `d`; U+0152 `Œ` to `OE`; U+0153 `œ` to `oe`; U+0131 `ı` to `i`; U+00AB `«` and U+00BB `»` to `"`; U+2002, U+2003, U+2009 and U+202F to U+0020; U+00AD (soft hyphen) to nothing; U+2010, U+2011 and U+2212 to `-`; U+2032 `′` to `'`; and U+2033 `″` to `"`.

7.14 WHEN the input contains a code point from the table of 7.13, THE function `foldText` SHALL return its replacement in that place, so that `"Łódź"` becomes `"Lódz"`, `"Œuvre"` becomes `"OEuvre"`, `"1\u202F000"` becomes `"1 000"`, `"a\u00ADb"` becomes `"ab"` and `"5\u2212 3"` becomes `"5- 3"`.

## Requirement 8: validateGrid

**User story:** As the page store, I want one total gate for full pages, so that nothing invalid is ever stored, cached or served.

8.1 THE function `validateGrid(input: unknown)` SHALL return either `{ ok: true, page: ValidPage }` or `{ ok: false, violations }`, where `violations` has at least one element.

8.2 THE function `validateGrid` SHALL never throw, for any input, including `null`, `undefined`, primitives, functions, symbols, bigints, cyclic objects, sparse arrays, typed arrays, Proxies (including revoked Proxies) and objects whose getters throw.

8.3 IF reading part of the input throws, THEN THE function `validateGrid` SHALL record one `unreadable` violation at the row and column being read (`null` for the grid itself, `col: null` for a row), report no other violation for that cell or row, and continue with the next cell or row.

8.4 IF the input is not an array, THEN THE function `validateGrid` SHALL return exactly one violation, `not-array`, with `row: null` and `col: null`.

8.5 IF the input array's length is not 24, THEN THE function `validateGrid` SHALL record a `row-count` violation with `expected: 24`, the actual length, `col: null` and `row` set to the actual length when it is under 24 (the first missing row) or 24 when it is over (the first extra row).

8.6 IF a row is not an array, THEN THE function `validateGrid` SHALL record `row-not-array` at that row with `col: null`.

8.7 IF a row's length is not 40, THEN THE function `validateGrid` SHALL record `row-length` at that row with `expected: 40`, the actual length, and `col` set to the actual length when it is under 40 or 40 when it is over.

8.8 THE function `validateGrid` SHALL read no row index at or above 24 and no cell index at or above 40, AND SHALL still check rows 0 to `min(length, 24) - 1` and cells 0 to `min(length, 40) - 1` when the row count or a row length is wrong.

8.9 WHEN validation succeeds, THE function `validateGrid` SHALL return a new grid that deep-equals the input, shares no array or object with the input, and is frozen at every level (grid, rows and cells), AND SHALL leave the input unchanged.

8.10 THE function `validateGrid` SHALL apply the cell rules of requirement 9 to all 24 rows and SHALL NOT check the layouts of rows 0, 1, 22 and 23 (a grid of valid cells with arbitrary text in row 0 is valid).

## Requirement 9: Cell rules

**User story:** As a module author, I want one set of cell rules shared by both validators, so that content and full pages are judged the same way.

9.1 IF a cell is not a non-null, non-array object, THEN THE validators SHALL record `cell-not-object`.

9.2 IF a cell's `kind` is not `"text"` or `"mosaic"`, THEN THE validators SHALL record `cell-kind` and check nothing else in that cell.

9.3 IF a cell has an own enumerable string key that its kind does not define (text: `kind ch fg bg conceal`; mosaic: `kind bits separated fg bg conceal`), THEN THE validators SHALL record one `cell-field-unknown` per such key, with the key in `field`, in ascending UTF-16 code unit order.

9.4 IF a text cell's `ch` is not a string of exactly one code point, THEN THE validators SHALL record `text-ch`.

9.5 IF a text cell's `ch` is one code point outside the repertoire, THEN THE validators SHALL record `text-repertoire` with that `codePoint` (this includes mosaic code points, control characters and lone surrogates).

9.6 IF a mosaic cell's `bits` is not an integer from 1 to 63 (including 0, -1, 64, 1.5, `NaN` and `"3"`), THEN THE validators SHALL record `mosaic-bits`.

9.7 IF a mosaic cell's `separated` is not a boolean, THEN THE validators SHALL record `mosaic-separated`.

9.8 IF a cell's `fg` or `bg` is not one of the eight colour names, THEN THE validators SHALL record `colour` with `field` set to `"fg"` or `"bg"`, one violation per field.

9.9 IF a cell's `conceal` is not a boolean, THEN THE validators SHALL record `conceal`.

9.10 IF a text cell has a valid `ch` other than U+0020 and valid colours, and `isLegibleText(fg, bg)` is `false`, THEN THE validators SHALL record `contrast` with `fg`, `bg` and the unrounded `ratio`, whether or not the cell is concealed. Text spaces and mosaic cells are exempt.

9.11 THE validators SHALL give every violation found in a cell that cell's page row and column.

## Requirement 10: Violations

**User story:** As a caller (the store, `grid:check`, the AI editor, the MCP server), I want violations I can match on and messages I can show, so that I can act on them and report them.

10.1 THE type `GridViolation` SHALL be a discriminated union on `code` with exactly these 15 codes: `not-array`, `row-count`, `row-not-array`, `row-length`, `unreadable`, `cell-not-object`, `cell-kind`, `cell-field-unknown`, `text-ch`, `text-repertoire`, `mosaic-bits`, `mosaic-separated`, `colour`, `conceal`, `contrast`, AND THE module `src/grid/grid-violation.ts` SHALL export them as `GRID_VIOLATION_CODES`. A code is never renamed or reused without a change to this spec.

10.2 THE validators SHALL give every violation `code`, `row` (a page row number, or `null`), `col` (a column number, or `null`) and a non-empty `message`.

10.3 THE validators SHALL write each message from the fixed template for its code in `design.md`, beginning with `row R col C: ` when both are known and `row R: ` when only the row is known, except `row-count`, whose message is exactly `grid has N rows, expected 24` or `content has N rows, expected 20`.

10.4 THE validators SHALL return violations sorted by row (`null` first), then column (`null` first), then the cell check order of requirement 9 (9.1 to 9.10).

10.5 THE validators SHALL write a code point in a message as `U+` followed by at least four upper-case hex digits, AND SHALL include a string taken from the input (a field name) in a message only when it is 1 to 32 characters of printable ASCII (U+0020 to U+007E).

## Requirement 11: The ValidPage and ValidContent gates

**User story:** As a reviewer, I want the brand casts to exist in exactly one place each, so that "one gate" can be checked by a test.

11.1 THE source tree SHALL contain a type assertion to `ValidPage` only in `src/grid/validate-grid.ts` and a type assertion to `ValidContent` only in `src/grid/validate-content-rows.ts`. A test scans every `.ts` file under `src/` for `as ValidPage` and `as ValidContent`.

## Requirement 12: validateContentRows

**User story:** As a compiler or page author, I want to check my 20 content rows before a frame exists, so that I find problems before the page is assembled.

12.1 THE function `validateContentRows(input: unknown)` SHALL return either `{ ok: true, content: ValidContent }` or `{ ok: false, violations }`, where `violations` has at least one element.

12.2 THE function `validateContentRows` SHALL require exactly 20 rows of exactly 40 cells, using the codes and rules of requirements 8.3 to 8.8 with `expected: 20` for `row-count`.

12.3 THE function `validateContentRows` SHALL apply the cell rules of requirement 9 through the same implementation as `validateGrid`.

12.4 THE function `validateContentRows` SHALL report content row i as page row i + 2, so that a `row-count` violation has row 2 + actual length (under 20) or row 22 (over 20).

12.5 WHEN `validateContentRows` is given any array r of 20 values and `validateGrid` is given any 24-element array whose elements 2-21 are the elements of r, THE violations that `validateGrid` reports with a row from 2 to 21 SHALL equal the violations that `validateContentRows` reports, in the same order and equal in every field including `message`.

12.6 THE function `validateContentRows` SHALL meet requirements 8.2 and 8.9 (total, and a new frozen copy on success).

## Requirement 13: Markup parsing, lines and rows

**User story:** As a page author, I want the parser to read a whole file and tell me where each problem is, so that I can fix a file in one pass.

13.1 THE module `src/markup/parse-page.ts` SHALL export `parsePage(text: string)`, which returns `{ ok: true, value: Grid }` or `{ ok: false, errors }`, AND THE module `src/markup/parse-content.ts` SHALL export `parseContent(text: string)`, which returns `{ ok: true, value: ContentRows }` or `{ ok: false, errors }`, where `errors` has at least one element.

13.2 THE parser SHALL split the text on LF into lines, where a final LF does not start a further line and the empty string has zero lines.

13.3 IF page markup does not have exactly 24 lines, THEN `parsePage` SHALL record `row-count` with `col: null` and `row` set to the line count when it is under 24 or 24 when it is over, AND SHALL still parse lines 0 to `min(count, 24) - 1`.

13.4 THE function `parseContent` SHALL read line i as page row i + 2 and fill missing rows up to row 21 with blank cells, AND IF content markup has 0 lines or more than 20, THEN it SHALL record `row-count` at row 2 (0 lines) or row 22 (over 20) and still parse the first 20 lines.

13.5 IF a line contains U+000D (CR) anywhere, THEN THE parser SHALL record `cr` at that row and the cell index where the CR appears.

13.6 THE parser SHALL reset the state to fg white, bg black, conceal off, separated off at the start of every row.

13.7 WHEN parsing succeeds, THE parser SHALL pad every row shorter than 40 cells with blank cells to exactly 40.

13.8 THE functions `parsePage` and `parseContent` SHALL never throw for any JavaScript string.

## Requirement 14: Markup parsing, tags and characters

**User story:** As a page author, I want a small fixed markup, so that every page file means exactly one grid.

14.1 THE parser SHALL treat `{k} {r} {g} {y} {b} {m} {c} {w}` as setting the foreground and `{K} {R} {G} {Y} {B} {M} {C} {W}` as setting the background, and these tags SHALL take no cells.

14.2 THE parser SHALL treat `{?}` as turning conceal on, `{/?}` as turning it off, `{~}` as turning separated mosaics on and `{/~}` as turning them off, AND IF one of these opens a mode that is on or closes one that is off, THEN THE parser SHALL record `mode-already-on` or `mode-not-on` with `mode` set to `"conceal"` or `"separated"`.

14.3 THE parser SHALL read `{{` as one text cell holding `{`, and a `}` that does not close a tag as one text cell holding `}`.

14.4 IF a `{` that is not part of `{{` is followed by a `}` on the same line but the text between them is not one of the tags in 14.1 and 14.2 (for example `{x}`, `{}`, `{rg}`), THEN THE parser SHALL record `tag-unknown`, AND IF no `}` follows on the same line, THEN it SHALL record `tag-unterminated`. Both are recorded at the index of the next cell.

14.5 THE parser SHALL read a repertoire character as a text cell, and U+0020 as a text space, with the current fg, bg and conceal state.

14.6 THE parser SHALL read U+258C, U+2590, U+2588 and U+1FB00 to U+1FB3B as a mosaic cell whose `bits` is `mosaicBitsOf` of the code point, with the current fg, bg, conceal and separated state.

14.7 IF a line contains any other code point (for example U+0009, U+00A0, U+00D7, U+00F7, U+FEFF or U+1F600), THEN THE parser SHALL record `char-not-allowed` with that `codePoint`.

14.8 IF a row reaches a 41st cell before any other error, THEN THE parser SHALL record `row-too-long` at column 40 with `cells` set to the row's cell count under the counting rule in `design.md`, and the message SHALL be exactly `row R is N cells, limit 40` (for example `row 7 is 43 cells, limit 40`).

## Requirement 15: Markup errors

**User story:** As a page author, I want every bad row reported in one run, so that I do not fix a file one error at a time.

15.1 THE type `MarkupError` SHALL be a discriminated union on `code` with exactly these 8 codes: `row-count`, `cr`, `row-too-long`, `tag-unknown`, `tag-unterminated`, `mode-already-on`, `mode-not-on`, `char-not-allowed`, AND THE module `src/markup/markup-error.ts` SHALL export them as `MARKUP_ERROR_CODES`.

15.2 THE parser SHALL give every error `code`, `row` (a page row number), `col` (a cell index, or `null` for `row-count` only) and a non-empty `message` from the fixed template for its code in `design.md`, following the rules of 10.5. Messages begin with `row R col C: `, except `row-count` (which names no row) and `row-too-long` (14.8).

15.3 WHEN a row has an error, THE parser SHALL record that row's first error by position, stop reading that row, and continue with the next row.

15.4 THE parser SHALL return exactly one error for each row that has at least one error, plus at most one `row-count` error, sorted by row.

15.5 WHEN errors occur in several rows (for example rows 3, 7 and 19 of a content file), THE parser SHALL return one error for each of those rows (rows 3, 7 and 19), not only the first.

15.6 THE parser SHALL NOT check contrast: `{b}x` (blue on black) parses with no error, and `validateGrid` or `validateContentRows` then reports `contrast`.

## Requirement 16: Canonical serialisation

**User story:** As a tool author, I want one canonical text form for every valid page, so that markup can be compared, diffed and round-tripped.

16.1 THE modules `src/markup/serialise-page.ts` and `src/markup/serialise-content.ts` SHALL export `serialisePage(page: ValidPage): string` and `serialiseContent(content: ValidContent): string`.

16.2 THE serialiser SHALL emit, before each cell, only the tags whose state changes from the previous cell (starting from the row-start state of 13.6), in the order bg, fg, conceal, separated, AND SHALL emit `{~}` or `{/~}` only before a mosaic cell.

16.3 THE serialiser SHALL omit the trailing cells of a row that are equal to the blank cell, AND SHALL keep a trailing cell that differs from it in any field (for example a red-foreground space).

16.4 THE serialiser SHALL write a text `{` as `{{`, a text `}` as `}`, a text space as U+0020, and a mosaic cell as `mosaicCodePoint(bits)`.

16.5 THE function `serialisePage` SHALL write exactly 24 lines, each followed by one LF, so that an all-blank page is 24 LFs.

16.6 THE function `serialiseContent` SHALL write rows 2 up to the last row that has a cell differing from the blank cell, each followed by one LF, AND SHALL write a single LF (`"\n"`) when all 20 rows are blank.

16.7 THE serialiser output SHALL contain no CR and no tag other than those in 14.1 and 14.2.

## Requirement 17: Round trips

**User story:** As a reviewer, I want parsing and serialising to be exact inverses, so that no tool can change a page by reading and writing it.

17.1 THE functions `parsePage` and `serialisePage` SHALL satisfy: for every ValidPage g, `parsePage(serialisePage(g))` succeeds and its value deep-equals g.

17.2 THE functions `parseContent` and `serialiseContent` SHALL satisfy: for every ValidContent c, `parseContent(serialiseContent(c))` succeeds and its value deep-equals c.

17.3 THE serialisers SHALL satisfy: for every canonical markup m, parsing m, validating the result and serialising it gives exactly m.

17.4 WHEN non-canonical markup m parses and validates (for example with repeated tags, redundant tags at row start, extra trailing default spaces or no final LF), THE serialiser SHALL produce the canonical markup of the same grid.

## Requirement 18: Module boundaries and determinism

**User story:** As a reviewer, I want the dependency direction and determinism rules checked by a test, so that they stay true as the code grows.

18.1 THE `.ts` files in `src/grid` SHALL import only other modules in `src/grid`, with no package and no `node:` built-in.

18.2 THE `.ts` files in `src/markup` SHALL import only modules in `src/markup` and `src/grid`, with no package and no `node:` built-in.

18.3 THE `.ts` files in `src/grid` and `src/markup` SHALL not contain `Date`, `Math.random`, `process` or `globalThis`, so that the same input always gives the same output.

## Requirement 19: Tests

**User story:** As a reviewer, I want each rule proved by a real test, so that the spec and the code cannot drift apart.

19.1 THE test suite SHALL contain one fast-check test for each property in `design.md`, in a `*.property.test.ts` file, with a name that starts `Property N:` for that property's number.

19.2 THE property tests SHALL run at least 100 cases each (the fast-check default) with a random seed, so that a failure prints the seed and path that reproduce it.

19.3 THE tests in `test/` SHALL call the real validators, parser, serialiser, folding function, contrast and mosaic functions, AND SHALL NOT use `vi.mock`, `vi.spyOn` or `vi.doMock`.

19.4 THE tests SHALL make no network request and read no file outside the repository.

## Requirement 20: Quality gate

**User story:** As the user, I want one gate that proves the feature is finished, so that I can commit it with confidence.

20.1 WHEN the feature is complete, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` SHALL each exit with code 0.

20.2 THE files under `src/` and `test/` SHALL contain no `any` type, no `@ts-ignore` and no `eslint-disable` comment, AND every `@ts-expect-error` SHALL carry a description naming this spec.
