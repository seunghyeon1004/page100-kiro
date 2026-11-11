import fc from "fast-check";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import { COLOURS } from "../../src/grid/colours.js";
import { REPERTOIRE } from "../../src/grid/repertoire.js";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import { validateGrid } from "../../src/grid/validate-grid.js";
import type { Colour, ValidContent, ValidPage } from "../../src/grid/types.js";

// The 20 legible (fg, bg) pairs, written out by hand from grid-rules.md. Generators use this list,
// not isLegibleText, so a bug in the contrast code cannot hide from the properties.
export const LEGIBLE_PAIRS: readonly (readonly [Colour, Colour])[] = [
  ["red", "black"],
  ["green", "black"],
  ["yellow", "black"],
  ["magenta", "black"],
  ["cyan", "black"],
  ["white", "black"],
  ["black", "red"],
  ["black", "green"],
  ["blue", "green"],
  ["black", "yellow"],
  ["blue", "yellow"],
  ["green", "blue"],
  ["yellow", "blue"],
  ["cyan", "blue"],
  ["white", "blue"],
  ["black", "magenta"],
  ["black", "cyan"],
  ["blue", "cyan"],
  ["black", "white"],
  ["blue", "white"],
];

/** The 44 (fg, bg) pairs that are not in LEGIBLE_PAIRS. */
export const ILLEGIBLE_PAIRS: readonly (readonly [Colour, Colour])[] = COLOURS.flatMap((fg) =>
  COLOURS.map((bg): readonly [Colour, Colour] => [fg, bg]),
).filter(([fg, bg]) => !LEGIBLE_PAIRS.some(([lf, lb]) => lf === fg && lb === bg));

const colour = fc.constantFrom(...COLOURS);
const legiblePair = fc.constantFrom(...LEGIBLE_PAIRS);
const repertoireNonSpace = fc.constantFrom(
  ...REPERTOIRE.filter((cp) => cp !== 0x20).map((cp) => String.fromCodePoint(cp)),
);

/** A cell that every validator accepts: blanks (weighted so rows have trailing blanks), spaces, legible text, mosaics. */
export const validCell: fc.Arbitrary<unknown> = fc.oneof(
  { weight: 4, arbitrary: fc.constant({ ...BLANK_CELL }) },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant("text"),
      ch: fc.constant(" "),
      fg: colour,
      bg: colour,
      conceal: fc.boolean(),
    }),
  },
  {
    weight: 3,
    arbitrary: fc
      .tuple(repertoireNonSpace, legiblePair, fc.boolean())
      .map(([ch, [fg, bg], conceal]) => ({ kind: "text", ch, fg, bg, conceal })),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant("mosaic"),
      bits: fc.integer({ min: 1, max: 63 }),
      separated: fc.boolean(),
      fg: colour,
      bg: colour,
      conceal: fc.boolean(),
    }),
  },
);

/** 24 rows of 40 valid cells, as plain values that have not been validated yet. */
export const validRows: fc.Arbitrary<unknown[][]> = fc.array(
  fc.array(validCell, { minLength: 40, maxLength: 40 }),
  { minLength: 24, maxLength: 24 },
);

/** A grid that `validateGrid` has accepted. */
export const validGrid: fc.Arbitrary<ValidPage> = validRows.map((rows) => {
  const result = validateGrid(rows);
  if (!result.ok) throw new Error("the generator made an invalid grid");
  return result.page;
});

/** Returns a copy of `rows` with one cell replaced. The input is not changed. */
export function withCell(
  rows: readonly (readonly unknown[])[],
  r: number,
  c: number,
  value: unknown,
): unknown[][] {
  const copy: unknown[][] = rows.map((row) => [...row]);
  const target = copy[r];
  if (target === undefined) throw new Error(`no row ${String(r)}`);
  target[c] = value;
  return copy;
}

/** One row of 40 valid cells, as a plain value. */
export const validRow: fc.Arbitrary<unknown[]> = fc.array(validCell, {
  minLength: 40,
  maxLength: 40,
});

/** 20 rows of 40 valid cells that `validateContentRows` has accepted. */
export const validContent: fc.Arbitrary<ValidContent> = fc
  .array(validRow, { minLength: 20, maxLength: 20 })
  .map((rows) => {
    const result = validateContentRows(rows);
    if (!result.ok) throw new Error("the generator made invalid content");
    return result.content;
  });
