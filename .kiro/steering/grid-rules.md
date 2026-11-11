---
inclusion: always
---

# Page 100: grid rules

These rules are the contract for `src/grid` and `src/markup`. Each one is meant to be checked by a test. Rows and columns are numbered from 0.

## Dimensions

- A page is exactly 24 rows of exactly 40 cells. No other size is valid at any stage: compiled, stored, cached or served.
- Every cell has a single fixed width. Nothing spans cells and there is no double height. No attribute makes anything flash.

## Row roles

Only the frame builder in `src/pages` writes rows 0, 1, 22 and 23. Compilers, the AI editor and the files in `pages/` supply rows 2-21 only.

| Row | Role | Layout |
|---|---|---|
| 0 | Header | Cols 0-3: `P` plus the page number as typed, with `-` for digits not yet entered (`P1--`). Col 4: space. Cols 5-12: `Page 100`. Cols 21-39: UTC date and clock, `Ddd DD Mon HH:MM:SS` (`Wed 11 Nov 14:05:09`). |
| 1 | Section banner | Cols 0-34: the banner text in upper case. Cols 35-39: subpage indicator `n/m`, right-aligned, shown only when the page has more than one subpage. |
| 2-21 | Content | 20 rows that belong to the page's compiler, editor or hand-written file. |
| 22 | Source and status | Normal: cols 0-29 hold the attribution line (at most 30 characters, from `sources.md`), col 30 is a space, cols 31-39 hold `HH:MM UTC`, the time of the last good fetch. Stale: the row reads `Data delayed: last good HH:MM UTC`, yellow on black. |
| 23 | Quick links | Four 10-cell blocks: cols 0-9 red, 10-19 green, 20-29 yellow, 30-39 blue. Each label is at most 8 characters and starts at the block's second cell. Text is black on red, black on green and black on yellow, and white on blue. White on red fails the contrast rule (4.00:1). |

## Cell model

```ts
type Colour = "black" | "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white";
type TextCell   = { kind: "text";   ch: string; fg: Colour; bg: Colour; conceal: boolean };
type MosaicCell = { kind: "mosaic"; bits: number; separated: boolean; fg: Colour; bg: Colour; conceal: boolean };
type Cell = TextCell | MosaicCell;
type Grid = readonly (readonly Cell[])[]; // 24 x 40
```

- `TextCell.ch` is exactly one Unicode code point from the repertoire.
- `MosaicCell.bits` is an integer from 1 to 63. An empty mosaic does not exist: a blank cell is always a text space. This keeps each visible cell to one form, so round trips are exact.
- `fg` on a mosaic cell is the colour of its lit blocks. `separated` exists only on mosaic cells.
- `conceal` hides the cell's content until Reveal. A concealed cell still takes its cell and its background.

## Colours

| Name | Markup fg / bg | RGB | Relative luminance |
|---|---|---|---|
| black | `{k}` / `{K}` | 0, 0, 0 (#000000) | 0.0000 |
| red | `{r}` / `{R}` | 255, 0, 0 (#FF0000) | 0.2126 |
| green | `{g}` / `{G}` | 0, 255, 0 (#00FF00) | 0.7152 |
| yellow | `{y}` / `{Y}` | 255, 255, 0 (#FFFF00) | 0.9278 |
| blue | `{b}` / `{B}` | 0, 0, 255 (#0000FF) | 0.0722 |
| magenta | `{m}` / `{M}` | 255, 0, 255 (#FF00FF) | 0.2848 |
| cyan | `{c}` / `{C}` | 0, 255, 255 (#00FFFF) | 0.7874 |
| white | `{w}` / `{W}` | 255, 255, 255 (#FFFFFF) | 1.0000 |

The CSS, ANSI and JSON renderers use these exact values.

## Text contrast (4.5:1)

- Relative luminance L follows WCAG 2.x: each channel c/255 is linearised as `c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`, then `L = 0.2126 R + 0.7152 G + 0.0722 B`. Contrast is `(Lmax + 0.05) / (Lmin + 0.05)`.
- The validator rejects a text cell whose character is not a space when its fg/bg contrast is below 4.5, compared unrounded. Concealed text is checked too. Text spaces and mosaic cells are exempt.
- The table is computed in code from the RGB values and checked by a test against the list below. The closest values to the threshold are 4.00 and 5.25, so rounding cannot change the result.

Allowed text pairs (20 in total), grouped by background:

| Background | Allowed foregrounds (ratio) |
|---|---|
| black | red 5.25, green 15.30, yellow 19.56, magenta 6.70, cyan 16.75, white 21.00 |
| red | black 5.25 |
| green | black 15.30, blue 6.26 |
| yellow | black 19.56, blue 8.00 |
| blue | green 6.26, yellow 8.00, cyan 6.85, white 8.59 |
| magenta | black 6.70 |
| cyan | black 16.75, blue 6.85 |
| white | black 21.00, blue 8.59 |

Full matrix, rows are fg and columns are bg in the order k r g y b m c w:

```
k  1.00  5.25 15.30 19.56  2.44  6.70 16.75 21.00
r  5.25  1.00  2.91  3.72  2.15  1.27  3.19  4.00
g 15.30  2.91  1.00  1.28  6.26  2.29  1.09  1.37
y 19.56  3.72  1.28  1.00  8.00  2.92  1.17  1.07
b  2.44  2.15  6.26  8.00  1.00  2.74  6.85  8.59
m  6.70  1.27  2.29  2.92  2.74  1.00  2.50  3.14
c 16.75  3.19  1.09  1.17  6.85  2.50  1.00  1.25
w 21.00  4.00  1.37  1.07  8.59  3.14  1.25  1.00
```

## Mosaics

Bit numbering for the 2x3 cell (bit value in brackets):

```
          left         right
top       bit 0 (1)    bit 1 (2)
middle    bit 2 (4)    bit 3 (8)
bottom    bit 4 (16)   bit 5 (32)
```

Bit k corresponds to Unicode sextant position k+1, so `BLOCK SEXTANT-135` has bits 0, 2 and 4.

Mapping from pattern value v (0-63) to a code point:

| v | Code point |
|---|---|
| 0 | U+0020 SPACE (stored as a text space, see the cell model) |
| 21 (left column, bits 0+2+4) | U+258C LEFT HALF BLOCK |
| 42 (right column, bits 1+3+5) | U+2590 RIGHT HALF BLOCK |
| 63 (all six) | U+2588 FULL BLOCK |
| any other v | U+1FB00 + v - 1 - (v > 21 ? 1 : 0) - (v > 42 ? 1 : 0) |

That gives 60 sextant code points, U+1FB00 to U+1FB3B, in order: v=1 is U+1FB00, v=22 is U+1FB14 (`SEXTANT-235`), v=43 is U+1FB28 (`SEXTANT-1246`), v=62 is U+1FB3B. The mapping is a bijection over all 64 values. It was checked against the Unicode 15.0 character names and a test checks it again. Separated mosaics use the same code points; the `separated` flag is stored separately and drawn with gaps by the renderer.

## Character repertoire

A text cell may hold exactly these code points:

- U+0020 to U+007E (printable ASCII, including space, `{` and `}`)
- U+00A3 `£`, U+00B0 `°`, U+20AC `€`
- U+00C0 to U+00FF, except U+00D7 `×` and U+00F7 `÷`

Nothing else is allowed: no control characters, tabs or emoji, and no mosaic code points inside text cells. The repertoire is defined once, in `src/grid/repertoire.ts`. The font subset is built from that file, and `grid:check` fails if the font lacks a glyph for any code point in it.

Source text is folded into the repertoire by one function, applied in this order: NFC; fixed replacements (`‘ ’` to `'`, `“ ”` to `"`, `– —` to `-`, `…` to `...`, U+00A0 to space, `×` to `x`); NFD with combining marks stripped; NFC again. If any code point is still outside the repertoire, folding fails for that item and the compiler skips the item. It never prints a substitute character.

## Page markup

- UTF-8 with LF line endings. One line per row. A full page has exactly 24 lines. A file in `pages/` holds rows 2-21 and has 1 to 20 lines; missing rows become blank. One final LF is optional. A CR anywhere is an error.
- At the start of every row the state resets to fg white, bg black, conceal off, separated off.
- Tags take no cells:
  - `{r} {g} {y} {b} {m} {c} {w} {k}` set the foreground. `{R} {G} {Y} {B} {M} {C} {W} {K}` set the background.
  - `{?}` starts concealed cells and `{/?}` ends them. `{~}` switches mosaics to separated and `{/~}` switches back. Opening a mode that is already on, or closing one that is off, is an error.
  - `{{` is a literal `{` text cell. A lone `}` is an ordinary text cell.
  - Any other `{...}`, or a `{` at the end of a row, is an error.
- A repertoire character becomes a text cell. Space becomes a text space. `▌ ▐ █` and U+1FB00 to U+1FB3B become mosaic cells with the current separated mode. Any other code point is an error.
- A row may be shorter than 40 cells; it is padded with white-on-black text spaces. A row longer than 40 cells is an error. Rows are never truncated.
- Every parse error reports row, column (cell index) and a fixed code, for example `row 7 is 43 cells, limit 40`.
- Canonical serialisation: before each cell, emit only the tags whose state changes, in the order bg, fg, conceal, separated. Separated tags are emitted only before mosaic cells. Trailing default cells (white-on-black, unconcealed text spaces) are trimmed. A literal `{` is written `{{`. A full page ends with exactly one LF.

## Invariants every change must keep

1. **Shape.** Every grid that leaves `src/grid` is 24 x 40.
2. **One gate.** `validateGrid` is the only way to get a `ValidPage` (a branded type). The store, the cache and every renderer accept only `ValidPage`. Nothing invalid is ever stored or served. If the newest compile fails, the last valid page stays in place.
3. **Validator is total.** It never throws. It returns either `ok` or a non-empty list of violations, each with row, column, code and message.
4. **Cell rules.** Text characters are in the repertoire. Mosaic bits are 1-63. Colours are the eight above. Non-space text meets 4.5:1.
5. **Round trip.** For every valid grid g, `parse(serialise(g))` deep-equals g. For every canonical markup m, `serialise(parse(m)) === m`.
6. **Deterministic.** The same source data and the same compile time always give the same grid. Compilers take the time as an argument and never read the clock.
7. **Frame ownership.** Rows 0, 1, 22 and 23 come only from the frame builder.

Required fast-check properties (in `test/grid` and `test/markup`): both round trips; the validator never throws on arbitrary input, including wrong shapes and wrong types; every generated valid grid validates; changing any single cell to an invalid value produces a violation at that row and column; the mosaic mapping is a bijection and inverts exactly; the contrast table is symmetric and matches the allowed pairs listed above.
