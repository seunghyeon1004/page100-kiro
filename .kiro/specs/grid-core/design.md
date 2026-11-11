# grid-core: design

Requirements: `.kiro/specs/grid-core/requirements.md`. Contract: `.kiro/steering/grid-rules.md`.

## Overview

grid-core is pure code with no I/O: types, tables and total functions. Nothing in `src/grid` or `src/markup` reads the clock, the environment, the file system or the network.

```
compiler output (later spec) ─┐
                              ├─> ContentRows ─> validateContentRows ─> ValidContent ─┐
pages/<n>.page ─> parseContent┘                                                       │
                                                       frame builder (page-frame spec)┘
                                                                      │
                                                     24-row array ─> validateGrid ─> ValidPage ─> store, renderers (later specs)
                                                                                         │
                                                                                         └─> serialisePage ─> markup (MCP preview, tests)
source text ─> foldText ─> repertoire-only text, or skip the item
```

The parser only turns text into cells. Contrast is decided only by the validators, so a parsed grid is always validated before it is used.

## Toolchain

Versions were read from the npm registry on 2026-11-11 (`npm view <pkg> version engines peerDependencies`). Nothing was installed.

| Package | Pinned | Latest | Why this version |
|---|---|---|---|
| `typescript` | 6.0.3 | 7.0.2 | `typescript-eslint` 8.72.2 declares the peer range `typescript >=4.8.4 <6.1.0`, so 7.x is not supported for type-aware linting. |
| `vitest` | 4.1.12 | 5.1.0 | vitest 5.1.0 needs Node `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` and lists `vite` as a peer only, which would add a dev dependency `tech.md` does not list. 4.1.12 supports Node `^20.0.0` and depends on `vite` directly. |
| `fast-check` | 4.10.2 | 4.10.2 | |
| `eslint` | 10.14.0 | 10.14.0 | Needs Node `^20.19.0 \|\| ^22.13.0 \|\| >=24` (see the open question on `engines`). |
| `typescript-eslint` | 8.72.2 | 8.72.2 | Peer `eslint ^10.0.0` is satisfied. |
| `prettier` | 3.9.10 | 3.9.10 | |
| `@types/node` | 20.19.43 | 26.6.6 | Matches the lowest supported Node, so code cannot use a newer Node API by accident. Satisfies vitest 4's peer `^20.0.0`. |

Install command (task 1.1; it uses the network, so Kiro asks the user before running it):

```
npm install --save-dev --save-exact typescript@6.0.3 vitest@4.1.12 fast-check@4.10.2 eslint@10.14.0 typescript-eslint@8.72.2 prettier@3.9.10 @types/node@20.19.43
```

## Files

### Scaffold

| File | Content |
|---|---|
| `package.json` | Fields of requirement 1.1 to 1.4. |
| `package-lock.json` | Written by npm. Committed. |
| `tsconfig.json` | Plain JSON (no comments, so `test/scaffold.test.ts` can `JSON.parse` it). `compilerOptions`: `target` `ES2023`, `lib` `["ES2023"]`, `module` and `moduleResolution` `NodeNext`, `types` `["node"]`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `forceConsistentCasingInFileNames`, `skipLibCheck`, `noEmit`. `include`: `["src", "test", "vitest.config.ts"]`. |
| `tsconfig.build.json` | `extends: "./tsconfig.json"`, `include: ["src"]`, `compilerOptions`: `noEmit: false`, `rootDir: "src"`, `outDir: "dist"`, `sourceMap: true`. |
| `eslint.config.js` | See below. |
| `.prettierrc.json` | `{ "printWidth": 100 }` |
| `.prettierignore` | `dist/`, `coverage/`, `package-lock.json`, `.kiro/`, `docs/`, `test/fixtures/` |
| `vitest.config.ts` | `defineConfig` from `vitest/config`; `test.include: ["test/**/*.test.ts"]`, `test.exclude: ["test/e2e/**", "node_modules/**"]`, `test.environment: "node"`. |
| `.editorconfig` | Requirement 1.11. |

`.prettierignore` is not in the user's scaffold list. Without it, `npm run lint` checks, and `npm run format` rewrites, the steering files, the specs and the transcripts in `docs/kiro-evidence/`, which `kiro-workflow.md` says are never edited.

`eslint.config.js`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist/", "coverage/"]),
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", "ts-ignore": true, "ts-nocheck": true, minimumDescriptionLength: 10 },
      ],
    },
  },
);
```

`.js` files get ESLint's default parsing with no type-aware rules. No `@eslint/js` or `eslint-config-prettier` is needed: typescript-eslint 8's shared configs contain no formatting rules.

### src/grid

Every file exports one main thing; small helpers that belong to it are exported beside it. Relative imports use the `.js` extension (`NodeNext`).

| File | Exports |
|---|---|
| `dimensions.ts` | `GRID_ROWS`, `GRID_COLS`, `CONTENT_FIRST_ROW`, `CONTENT_ROW_COUNT` |
| `types.ts` | `Colour`, `TextCell`, `MosaicCell`, `Cell`, `Rows`, `Grid`, `ContentRows`, `ValidPage`, `ValidContent`, `NonEmpty` (types only) |
| `colours.ts` | `COLOURS`, `COLOUR_RGB`, `COLOUR_LETTER` (fg letter; bg is its upper case), `isColour` |
| `contrast.ts` | `contrastRatio`, `isLegibleText`, `relativeLuminance` |
| `mosaic-code-point.ts` | `mosaicCodePoint`, `mosaicBitsOf` |
| `repertoire.ts` | `REPERTOIRE`, `isRepertoireCodePoint` |
| `fold-text.ts` | `foldText`, `FoldResult` |
| `blank-cell.ts` | `BLANK_CELL`, `isBlankCell` |
| `grid-violation.ts` | `GridViolation`, `GRID_VIOLATION_CODES`, message helpers (`formatCodePoint`, `quoteIfSafe`) |
| `check-cell.ts` | `checkCell` (the shared cell rules, requirement 9) |
| `check-rows.ts` | `checkRows` (the shared shape walk and copy, requirements 8.3 to 8.9) |
| `validate-grid.ts` | `validateGrid`, `GridResult` |
| `validate-content-rows.ts` | `validateContentRows`, `ContentResult` |

### src/markup

| File | Exports |
|---|---|
| `markup-error.ts` | `MarkupError`, `MARKUP_ERROR_CODES`, `ParseResult` |
| `split-lines.ts` | `splitLines` (requirement 13.2) |
| `parse-row.ts` | `parseRow` (one line to 40 cells or one error) |
| `parse-page.ts` | `parsePage` |
| `parse-content.ts` | `parseContent` |
| `serialise-row.ts` | `serialiseRow` |
| `serialise-page.ts` | `serialisePage` |
| `serialise-content.ts` | `serialiseContent` |

## Types

```ts
// src/grid/types.ts
export type Colour = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white";
export interface TextCell {
  readonly kind: "text"; readonly ch: string; readonly fg: Colour; readonly bg: Colour; readonly conceal: boolean;
}
export interface MosaicCell {
  readonly kind: "mosaic"; readonly bits: number; readonly separated: boolean;
  readonly fg: Colour; readonly bg: Colour; readonly conceal: boolean;
}
export type Cell = TextCell | MosaicCell;
export type Rows = readonly (readonly Cell[])[];
export type Grid = Rows;        // 24 x 40 by contract
export type ContentRows = Rows; // 20 x 40 by contract, page rows 2-21

declare const validPageBrand: unique symbol;
declare const validContentBrand: unique symbol;
export type ValidPage = Grid & { readonly [validPageBrand]: true };
export type ValidContent = ContentRows & { readonly [validContentBrand]: true };

export type NonEmpty<T> = readonly [T, ...T[]];
```

The brands exist only in the type system. At run time a `ValidPage` is a frozen array of frozen arrays of frozen cells.

```ts
// src/grid/validate-grid.ts
export type GridResult =
  | { readonly ok: true; readonly page: ValidPage }
  | { readonly ok: false; readonly violations: NonEmpty<GridViolation> };
// src/grid/validate-content-rows.ts
export type ContentResult =
  | { readonly ok: true; readonly content: ValidContent }
  | { readonly ok: false; readonly violations: NonEmpty<GridViolation> };
// src/grid/fold-text.ts
export type FoldResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly code: "fold-unrepresentable"; readonly codePoints: NonEmpty<number> };
// src/markup/markup-error.ts
export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: NonEmpty<MarkupError> };
```

### GridViolation

Every member has `code`, `row: number | null`, `col: number | null` and `message: string`. Extra fields:

| Code | row | col | Extra fields |
|---|---|---|---|
| `not-array` | `null` | `null` | |
| `row-count` | first missing or first extra row | `null` | `expected`, `actual` |
| `row-not-array` | row | `null` | |
| `row-length` | row | first missing or first extra cell | `expected: 40`, `actual` |
| `unreadable` | row or `null` | col or `null` | |
| `cell-not-object` | row | col | |
| `cell-kind` | row | col | |
| `cell-field-unknown` | row | col | `field: string` |
| `text-ch` | row | col | |
| `text-repertoire` | row | col | `codePoint: number` |
| `mosaic-bits` | row | col | |
| `mosaic-separated` | row | col | |
| `colour` | row | col | `field: "fg" \| "bg"` |
| `conceal` | row | col | |
| `contrast` | row | col | `fg: Colour`, `bg: Colour`, `ratio: number` |

### MarkupError

| Code | row | col | Extra fields |
|---|---|---|---|
| `row-count` | first missing or first extra row | `null` | `expected` (24, or 20 for content), `actual` |
| `cr` | row | cell index | |
| `row-too-long` | row | 40 | `cells: number` |
| `tag-unknown` | row | cell index | `tag: string` (raw text from `{` to `}`) |
| `tag-unterminated` | row | cell index | |
| `mode-already-on` | row | cell index | `mode: "conceal" \| "separated"` |
| `mode-not-on` | row | cell index | `mode: "conceal" \| "separated"` |
| `char-not-allowed` | row | cell index | `codePoint: number` |

## Messages

`R` is the row, `C` the column, `N` a count. Code points are written by `formatCodePoint`: `U+` plus upper-case hex, at least four digits (`U+0009`, `U+1F600`). `quoteIfSafe(s)` returns `"s"` with quotes when s is 1 to 32 characters of U+0020 to U+007E, and `undefined` otherwise. A template part in `[...]` is left out when `quoteIfSafe` returns `undefined`. Ratios are shown with `toFixed(2)`, for display only; the comparison uses the unrounded value.

Validator templates (`grid` is `content` in `validateContentRows`):

| Code | Message |
|---|---|
| `not-array` | `grid is not an array` |
| `row-count` | `grid has N rows, expected 24` (content: `content has N rows, expected 20`) |
| `row-not-array` | `row R: row is not an array` |
| `row-length` | `row R: row has N cells, expected 40` |
| `unreadable` | `grid could not be read`, `row R: row could not be read` or `row R col C: cell could not be read` |
| `cell-not-object` | `row R col C: cell is not an object` |
| `cell-kind` | `row R col C: kind must be "text" or "mosaic"` |
| `cell-field-unknown` | `row R col C: unknown field[ "F"]` |
| `text-ch` | `row R col C: ch must be exactly one code point` |
| `text-repertoire` | `row R col C: U+XXXX is not in the repertoire` |
| `mosaic-bits` | `row R col C: bits must be an integer from 1 to 63; a blank cell is a text space` |
| `mosaic-separated` | `row R col C: separated must be true or false` |
| `colour` | `row R col C: fg is not one of the eight colours` (or `bg`) |
| `conceal` | `row R col C: conceal must be true or false` |
| `contrast` | `row R col C: red on white is 4.00:1, below 4.5:1` |

Parser templates:

| Code | Message |
|---|---|
| `row-count` | `page has N rows, expected 24`; `content has 0 rows, expected 1 to 20`; `content has N rows, limit 20` |
| `cr` | `row R col C: carriage return (U+000D) is not allowed; use LF line endings` |
| `row-too-long` | `row R is N cells, limit 40` |
| `tag-unknown` | `row R col C: unknown tag[ "{x}"]` |
| `tag-unterminated` | `row R col C: { has no closing }; write {{ for a literal {` |
| `mode-already-on` | `row R col C: {?} but conceal is already on` / `row R col C: {~} but separated mosaics are already on` |
| `mode-not-on` | `row R col C: {/?} but conceal is not on` / `row R col C: {/~} but separated mosaics are not on` |
| `char-not-allowed` | `row R col C: U+XXXX is not allowed` |

## Algorithms

### Colours and contrast

`COLOUR_RGB` holds the eight RGB triples from `grid-rules.md`. `relativeLuminance` linearises each channel `c / 255` as `c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4` and returns `0.2126 R + 0.7152 G + 0.0722 B`. `contrastRatio(a, b)` takes `Math.max` and `Math.min` of the two luminances, so swapping the arguments gives the identical number. `isLegibleText(fg, bg)` is `contrastRatio(fg, bg) >= 4.5`. The function is cheap enough that no table is cached.

### Mosaic mapping

`mosaicCodePoint(v)` returns `undefined` unless `Number.isInteger(v) && v >= 0 && v <= 63`, then applies the rule of requirement 5.1. `mosaicBitsOf(cp)` handles U+0020, U+258C, U+2590 and U+2588 directly. For `0x1FB00 <= cp <= 0x1FB3B` it computes `k = cp - 0x1FB00 + 1` (1 to 60) and returns `k + (k >= 21 ? 1 : 0) + (k >= 41 ? 1 : 0)`, which skips 21 and 42. Any other value gives `undefined`.

### Repertoire

`REPERTOIRE` is built once from the three ranges and frozen. `isRepertoireCodePoint(cp)` is a range test (`0x20..0x7E`, `0xA3`, `0xB0`, `0x20AC`, `0xC0..0xFF` except `0xD7` and `0xF7`), and returns `false` for anything that is not an integer. A test checks that the range test and the array agree on every value from -1 to 0x110000.

### foldText

1. `s.normalize("NFC")`.
2. Replace each fixed source code point with its target (one pass over the code points, a lookup in a frozen `Map`).
3. For each code point (iterated with `for...of`, so a lone surrogate is one item): keep it when `isRepertoireCodePoint` is true; otherwise append `ch.normalize("NFD").replace(/\p{M}/gu, "")`.
4. `normalize("NFC")` on the result.
5. Collect the code points still outside the repertoire, each once, in order of first appearance. None: `{ ok: true, text }`. Some: `{ ok: false, code: "fold-unrepresentable", codePoints }`.

Why it is idempotent: a successful output contains only repertoire code points. A repertoire-only string is unchanged by every step. Step 1 leaves it alone because the Latin-1 letters are already NFC, which was checked for U+00C0 to U+00FF in Node 24.5, and no repertoire code point is a combining mark. Step 2 has no repertoire code point as a source. Steps 3 to 5 keep repertoire code points as they are.

`String.prototype.normalize` does not throw on lone surrogates (checked in Node 24.5: `"\uD800".normalize()` returns `"\uD800"`), so `foldText` contains no `try`.

### checkCell and checkRows

`checkRows(input, { expectedRows, firstRow, label })` does the walk for both validators. `validateGrid` calls it with `(24, 0, "grid")` and `validateContentRows` with `(20, 2, "content")`. It returns the violations, and on success the frozen copy, which only the two validator files cast to their brand.

Walk order. The violations come out in the sort order of requirement 10.4, so no sort step is needed:

1. In a `try`: `Array.isArray(input)` and read `length`. A throw gives `unreadable` (`null`, `null`) and stops. Not an array gives `not-array` and stops.
2. For `i` in `0 .. min(length, expectedRows) - 1`, page row `r = firstRow + i`:
   1. In a `try`, read `input[i]`. A throw gives `unreadable` (`r`, `null`), then go to the next row.
   2. Not an array gives `row-not-array`, then go to the next row. In a `try`, read its `length`; a throw gives `unreadable` (`r`, `null`).
   3. For `c` in `0 .. min(rowLength, 40) - 1`: read the cell in a `try` (a throw gives `unreadable` (`r`, `c`)), then call `checkCell(cell, r, c)`.
   4. If `rowLength !== 40`, add `row-length` with `col = rowLength < 40 ? rowLength : 40`.
3. If `length !== expectedRows`, add `row-count` with `row = firstRow + (length < expectedRows ? length : expectedRows)`.

`checkCell(value, r, c)` runs inside one `try`. A throw from a getter or a Proxy trap discards that cell's partial violations and records one `unreadable` (`r`, `c`). Each field is read once into a local, so a getter cannot return different values to two checks. The order of checks:

1. `typeof value !== "object" || value === null || Array.isArray(value)` gives `cell-not-object`, then stop.
2. `kind` is not `"text"` or `"mosaic"`: `cell-kind`, then stop.
3. `Object.keys(value)`, filtered to keys outside the kind's field set and sorted by UTF-16 code units, gives one `cell-field-unknown` per key.
4. Text: `ch` must be a string with exactly one code point (`[...ch].length === 1`), otherwise `text-ch`. If it has one, the code point must be in the repertoire, otherwise `text-repertoire`. Mosaic: `bits` must be `Number.isInteger` and in 1 to 63, otherwise `mosaic-bits`. `separated` must be a boolean, otherwise `mosaic-separated`.
5. `fg`, then `bg`: each must pass `isColour`, otherwise `colour`.
6. `conceal` must be a boolean, otherwise `conceal`.
7. Text only: when `ch` passed both checks in step 4, is not `" "`, and both colours are valid, `!isLegibleText(fg, bg)` gives `contrast`.

When a cell has no violations, `checkCell` returns a new frozen object with exactly the kind's fields. `checkRows` collects these into new frozen rows and a new frozen outer array. The input is only read, never written.

### parseRow

`parseRow(line, row)` returns `{ ok: true, cells }` (exactly 40, padded with `BLANK_CELL`) or `{ ok: false, error }`. State: `fg = "white"`, `bg = "black"`, `conceal = false`, `separated = false`, `cells = []`. It walks the line by code point with a code-unit index `i`:

- U+000D: `cr` at `col = cells.length`.
- `{` followed by `{`: emit the text cell `{` and advance two code units.
- `{` otherwise: find the next `}` after `i`. If there is none, `tag-unterminated`. Otherwise the body is the text between them: one of `k r g y b m c w` sets fg, one of `K R G Y B M C W` sets bg, `?` `/?` `~` `/~` toggle modes (a no-op toggle gives `mode-already-on` or `mode-not-on`), and anything else gives `tag-unknown` with `tag` = `{` + body + `}`. Tags emit no cell.
- A repertoire code point: emit a text cell with the current fg, bg and conceal.
- A code point where `mosaicBitsOf(cp)` is 1 to 63: emit a mosaic cell with the current fg, bg, conceal and separated.
- Anything else: `char-not-allowed`.

"Emit" first checks `cells.length === 40`. If it is, the row's error is `row-too-long` at col 40, and `cells` is found with the counting rule below. The first error ends the row.

**Counting rule for `row-too-long`.** Scan the whole line from the start. `{{` counts 1. A `{` with a later `}` on the line counts 0 for the whole `{...}`, whatever is inside. A `{` with no later `}` counts 1. U+000D counts 0. Every other code point counts 1. So `"{r}" + "A".repeat(43)` is 43 cells, and 41 cells followed by `{zz}` and `\r` is 41 cells.

### parsePage and parseContent

`splitLines(text)` splits on LF, and drops the last element when it is empty and the text is non-empty, so `""` gives `[]`, `"\n"` gives `[""]` and `"a"` gives `["a"]`. `parsePage` parses lines 0 to 23 as rows 0 to 23. `parseContent` parses lines 0 to 19 as rows 2 to 21 and fills rows that are missing with blank rows. Each collects one error per failed row, then appends `row-count` when the line count is wrong (requirements 13.3 and 13.4). Rows are visited in order and `row-count` has the highest row number, so the errors are sorted.

### Serialisers

`serialiseRow(cells)`:

1. `last` = index of the last cell for which `isBlankCell` is false. If there is none, return `""`.
2. Start from the row-start state. For each cell `0..last`, emit `{B}`-style when bg changes, then `{b}`-style when fg changes, then `{?}` or `{/?}` when conceal changes, then (mosaic cells only) `{~}` or `{/~}` when separated changes. Then emit the character: text `{` as `{{`, other text as `ch`, mosaic as `String.fromCodePoint(mosaicCodePoint(bits))`.

The separated state persists across text cells, because text cells carry no `separated` value. `serialisePage` joins 24 rows, each followed by `"\n"`. `serialiseContent` writes rows up to the last row that has a non-blank cell, each followed by `"\n"`, and returns `"\n"` when every row is blank.

## Error handling

- No function in `src/grid` or `src/markup` throws on purpose, and none needs to catch its own errors except `checkRows` and `checkCell`, which catch what hostile input raises.
- Exhaustive `switch` statements end in a `default` branch that assigns to `never`, so adding a code without handling it fails `npm run typecheck`.
- Results are plain discriminated unions; callers branch on `ok`. The failure arrays are typed `NonEmpty` and are never empty at run time.

## Correctness properties

Each property is one fast-check test, named `Property N: ...`, in the file shown. Grid arbitraries live in `test/grid/arbitraries.ts`. The noisy markup writer used by Properties 14 and 18 lives in `test/markup/markup-arbitraries.ts` and returns each row as a list of tokens, so a test can insert a token at a token boundary.

Property 1: for all colours fg and bg, `contrastRatio(fg, bg) === contrastRatio(bg, fg)`, and `isLegibleText(fg, bg)` is true exactly when (fg, bg) is one of the 20 allowed pairs in `grid-rules.md`. Validates: 4.3, 4.4. (`test/grid/contrast.property.test.ts`)

Property 2: for all integers v from 0 to 63, `mosaicBitsOf(mosaicCodePoint(v)) === v`; for all integers cp from 0 to 0x10FFFF, when `mosaicBitsOf(cp)` is defined, `mosaicCodePoint(mosaicBitsOf(cp)) === cp`; for all numbers x that are not an integer from 0 to 63, `mosaicCodePoint(x)` is `undefined`. Validates: 5.1, 5.3, 5.4. (`test/grid/mosaic-code-point.property.test.ts`)

Property 3: for all numbers n (integers from -16 to 0x110010, and arbitrary doubles), `isRepertoireCodePoint(n) === REPERTOIRE.includes(n)`. Validates: 6.1, 6.2. (`test/grid/repertoire.property.test.ts`)

Property 4: for all strings s (full Unicode, lone surrogates, and strings biased towards Latin letters, combining marks and the fixed replacement characters), `foldText(s)` returns without throwing; on success every code point of `text` is in the repertoire; on failure `codePoints` is non-empty, has no duplicates and contains only code points outside the repertoire. Validates: 7.1, 7.9, 7.10, 7.12. (`test/grid/fold-text.property.test.ts`)

Property 5: for all strings s, when `foldText(s)` succeeds with text t, `foldText(t)` succeeds with text t. Validates: 7.11. (`test/grid/fold-text.property.test.ts`)

Property 6: for all strings s made only of repertoire code points, `foldText(s)` succeeds with text s. Validates: 7.3, 7.4. (`test/grid/fold-text.property.test.ts`)

Property 7: for all values x (`fc.anything` with every option on, including null prototypes, boxed values, sparse arrays, typed arrays, Maps, Sets and bigints; 24-element arrays of arbitrary rows; valid grids with arbitrary values swapped in at any depth; objects with throwing getters; Proxies whose traps throw; revoked Proxies), `validateGrid(x)` and `validateContentRows(x)` return without throwing; `ok` is true or `violations` is non-empty; every code is in `GRID_VIOLATION_CODES`; every `row` is `null` or an integer from 0 to 24 and every `col` is `null` or an integer from 0 to 40; every message is a non-empty string; and the violations are in the order of 10.4. Validates: 8.1, 8.2, 8.3, 10.1, 10.2, 10.4, 12.1, 12.6. (`test/grid/validate-grid.property.test.ts`)

Property 8: for all generated valid grids g, `validateGrid(g)` succeeds; the page deep-equals g; no array or cell of the page is the same object as in g; every level of the page is frozen; and g deep-equals a `structuredClone` of g taken before the call. Validates: 8.9, 8.10, 9.10. (`test/grid/validate-grid.property.test.ts`)

Property 9: for all valid grids g, row r from 0 to 23, column c from 0 to 39 and invalid cell values x (non-objects, arrays, wrong `kind`, an extra field, a broken `ch`, `bits`, `separated`, `fg`, `bg` or `conceal`, a mosaic code point or emoji as `ch`, bits 0, and a non-space text cell with an illegible colour pair), replacing cell (r, c) of g with x makes `validateGrid` fail, and every violation has row r and col c. Validates: 9.1 to 9.11, 10.2. (`test/grid/validate-grid.property.test.ts`)

Property 10: for all arrays r of 20 values (valid rows, rows with invalid cells, wrong lengths and non-arrays) and any frame rows f0, f1, f22 and f23, the violations of `validateGrid([f0, f1, ...r, f22, f23])` with a row from 2 to 21 equal the violations of `validateContentRows(r)`, in order and field for field. Validates: 12.3, 12.4, 12.5. (`test/grid/validate-content-rows.property.test.ts`)

Property 11: for all generated valid content c (20 x 40), `validateContentRows(c)` succeeds and its content deep-equals c, shares no object with c and is frozen at every level; and for all arrays of n valid rows with n from 0 to 30 except 20, the `row-count` violation has row `2 + min(n, 20)`. Validates: 12.1, 12.2, 12.4, 12.6. (`test/grid/validate-content-rows.property.test.ts`)

Property 12: for all row counts from 0 to 200 and row lengths from 0 to 200, a Proxy-wrapped input that records every index read is never read at a row index of 24 or more (20 for content) or a cell index of 40 or more. Validates: 8.8, 12.2. (`test/grid/validate-grid.property.test.ts`)

Property 13: for all strings s (built from markup tokens, valid and invalid tags, repertoire and mosaic characters, CR, LF, tabs, emoji and lone surrogates, and arbitrary Unicode), `parsePage(s)` and `parseContent(s)` return without throwing; `ok` is true or `errors` is non-empty; every code is in `MARKUP_ERROR_CODES`; no row has more than one error; there is at most one `row-count`; errors are sorted by row; every `row` is in range (0 to 24 for pages, 2 to 22 for content); and on success the value has 24 (or 20) rows of exactly 40 cells. Validates: 13.1, 13.3, 13.4, 13.7, 13.8, 15.1 to 15.4. (`test/markup/parse-page.property.test.ts`)

Property 14: for all valid content c, written as noisy markup with every one of the 20 rows present, any set S of content rows, and any always-invalid token (`{x}`, `{}`, a tab, a CR, U+1F600) inserted at a token boundary in each row of S, `parseContent` of the result fails with exactly one error for each row in S and none for any other row, and each error's `col` is the number of cells before the inserted token. Validates: 13.5, 14.4, 14.7, 15.3, 15.5. (`test/markup/parse-content.property.test.ts`)

Property 15: for all valid pages g, `parsePage(serialisePage(g))` succeeds and its value deep-equals g. Validates: 14.1 to 14.6, 16.2 to 16.5, 17.1. (`test/markup/serialise-page.property.test.ts`)

Property 16: for all valid content c, `parseContent(serialiseContent(c))` succeeds and its value deep-equals c. Validates: 13.4, 16.6, 17.2. (`test/markup/serialise-content.property.test.ts`)

Property 17: for all valid pages g and valid content c, with m = `serialisePage(g)` and n = `serialiseContent(c)`, parsing m, validating it and serialising it gives exactly m, and likewise for n. Validates: 17.3. (`test/markup/serialise-page.property.test.ts`)

Property 18: for all valid pages g and noisy markup m of g (redundant tags such as `{w}` at row start, repeated colour tags, `{?}{/?}` and `{~}{/~}` pairs between cells, tags for every cell, extra trailing blank spaces up to 40 cells, a missing final LF), `parsePage(m)` succeeds with a value that deep-equals g, and serialising its validated value gives exactly `serialisePage(g)`. Validates: 13.2, 14.1, 14.2, 17.4. (`test/markup/serialise-page.property.test.ts`)

Property 19: for all valid pages g, `serialisePage(g)` contains exactly 24 LFs and no CR; every `{...}` in it is `{{` or one of the 20 tags of 14.1 and 14.2; and for all valid content c, `serialiseContent(c)` has 1 to 20 lines, ends with exactly one LF, and its last line is non-empty unless it is the only line. Validates: 16.5, 16.6, 16.7. (`test/markup/serialise-page.property.test.ts`)

Property 20: for all valid pages g, in each line of `serialisePage(g)`, no tag sets a state to the value it already has; the tags before each cell appear in the order bg, fg, conceal, separated; `{~}` and `{/~}` appear only in the tag run directly before a mosaic character; and the line does not end with a blank cell. A small tag scanner in the test checks this from the text alone. Validates: 16.2, 16.3. (`test/markup/serialise-page.property.test.ts`)

### Generators

- Colours: `fc.constantFrom(...COLOURS)`. Legible text pairs: `fc.constantFrom` over the 20 pairs, written out by hand in the test from `grid-rules.md`, not derived from `isLegibleText`.
- Valid cell: a weighted choice of the blank cell (weight 4, so rows have trailing blanks to trim), a text space with any colours and conceal, a non-space repertoire character with a legible pair, and a mosaic cell with bits 1 to 63, any colours, any separated and any conceal.
- Valid grid: 24 arrays of 40 valid cells, passed through `validateGrid` to get a `ValidPage`. Valid content: 20 rows, through `validateContentRows`.
- Noisy markup (Property 18): built per cell from the cell's state, with fast-check choosing which redundant tags to add. It is a second, independent writer, so the property also checks the parser against a different encoder.

## Example tests

These cover cases a property does not pin to exact values.

- `test/scaffold.test.ts`: the fields of `package.json` (1.1 to 1.5); the scripts, exactly; `tsconfig.json` and `tsconfig.build.json` options (1.6, 1.7); `.prettierignore` entries and `.prettierrc.json` (1.9); `.editorconfig` lines (1.11).
- `test/grid/colours.test.ts`: `COLOURS` order, RGB values, letters, luminances to 4 decimals (3.1 to 3.4).
- `test/grid/contrast.test.ts`: all 64 ratios to 2 decimals against the matrix in `grid-rules.md`, written out in the test; 4.00 and 5.25 (4.2, 4.5); no matrix value other than 1.00 appears as a numeric literal in `src/grid/contrast.ts` (4.1).
- `test/grid/mosaic-code-point.test.ts`: the four anchors and three blocks (5.2), and strictly increasing over the 60 sextants (5.5).
- `test/grid/repertoire.test.ts`: length 160, ascending, the excluded points in 6.2.
- `test/grid/fold-text.test.ts`: every example in 7.3 to 7.9, including the exact failure `codePoints` for `"Łódź"` (`[0x141]`), `"a\tb"` (`[0x9]`), `"\uD800"` (`[0xD800]`) and a string with a repeated bad code point.
- `test/grid/validate-grid.test.ts`: one minimal input per violation code, with its exact message; `null`, `undefined`, `"x"`, `{}` give only `not-array`; 0, 23 and 25 rows; rows of 39 and 41 cells (`col` 39 and 40); a sparse row `new Array(1_000_000)` gives 40 `cell-not-object` then `row-length` with `actual: 1000000`; a getter that throws, and a revoked Proxy, give `unreadable`; `cell-field-unknown` sorted by key, and a field name with a control character left out of the message; concealed blue-on-black text gives `contrast`; blue-on-black text spaces and mosaics are valid; arbitrary text in row 0 is valid (8.10); a cell with three problems gives them in the order of 9.1 to 9.10.
- `test/grid/validate-content-rows.test.ts`: 19 and 21 rows (`row-count` at rows 21 and 22); content row 0 is reported as row 2; messages use `content`.
- `test/grid/types.test.ts`: `@ts-expect-error` lines proving that `Grid` and `ContentRows` are not assignable to `ValidPage` or `ValidContent`, and that the two brands are not assignable to each other (2.4). The lines sit inside a function that is never called, and each comment names this spec.
- `test/markup/parse-page.test.ts` and `test/markup/parse-content.test.ts`: every tag; `{{` and lone `}`; `{` at the end of a row; `{x}`, `{}` and `{rg}`; each mode error; a CRLF file gives a `cr` error on every row; a BOM at the start; tabs; exactly 40 cells parses; 41 gives `row 2 is 41 cells, limit 40`; the 43-cell example; a bad tag before cell 40 wins over the overflow; a CR after the overflow does not change the error; final LF optional; `""` (0 lines), `"\n"` (one blank row) and `"\n\n"` (two); a 21-line content file; a 23-line and a 25-line page; separated mosaics, a space while separated is on (a text space), conceal on mosaics; state reset at row start; `{b}x` parses, then `validateContentRows` reports `contrast` (15.6); errors in rows 3, 7 and 19 all reported (15.5).
- `test/markup/serialise-page.test.ts` and `test/markup/serialise-content.test.ts`: an all-blank page is 24 LFs; all-blank content is `"\n"`; a trailing red-foreground space is kept; `{` is written `{{`; separated mosaic, text, separated mosaic gives `{~}` once; tag order `{R}{k}{?}{~}█` for one cell that changes all four.
- `test/boundaries.test.ts`: imports in `src/grid` and `src/markup` (18.1, 18.2); no `Date`, `Math.random`, `process` or `globalThis` there (18.3); `as ValidPage` and `as ValidContent` only in their validator files (11.1); no `vi.mock`, `vi.spyOn` or `vi.doMock` in `test/` (19.3); test imports limited to `vitest`, `fast-check`, `node:fs`, `node:path`, `node:url` and relative paths (19.4); no `@ts-ignore` or `eslint-disable` in `src/` or `test/`, and every `@ts-expect-error` names `grid-core` (20.2). The regexes are written so they do not match their own source text (for example `/@ts-(?:ignore)/`).

## Test plan

| Command | Covers |
|---|---|
| `npm test -- test/scaffold.test.ts` | Requirement 1 |
| `npm test -- test/grid` | Requirements 2 to 12; Properties 1 to 12 |
| `npm test -- test/markup` | Requirements 13 to 17; Properties 13 to 20 |
| `npm test -- test/boundaries.test.ts` | Requirements 11, 18, 19.3, 19.4, 20.2 |
| `npm run typecheck` | 2.4 (the `@ts-expect-error` lines), 20.2 |
| `npm run lint` | 1.8, 1.9, 20.2 |
| `npm run build` | 1.7 |

All tests run offline with no fixtures. Property tests use fast-check's default of 100 runs and a random seed. On failure fast-check prints the seed and path, and the test can be re-run with them.
