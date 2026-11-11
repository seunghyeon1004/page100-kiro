import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import { GRID_VIOLATION_CODES } from "../../src/grid/grid-violation.js";
import { validateContentRows, type ContentResult } from "../../src/grid/validate-content-rows.js";
import { validateGrid, type GridResult } from "../../src/grid/validate-grid.js";
import { ILLEGIBLE_PAIRS, validGrid, withCell } from "./arbitraries.js";

const KNOWN_CODES: ReadonlySet<string> = new Set(GRID_VIOLATION_CODES);

/** Any value at all, with the awkward kinds switched on (boxed, null prototype, sparse, typed...). */
const weirdValue = fc.anything({
  withBoxedValues: true,
  withNullPrototype: true,
  withSparseArray: true,
  withTypedArray: true,
  withMap: true,
  withSet: true,
  withBigInt: true,
  withObjectString: true,
  withDate: true,
});

const exoticNames = ["throwingGetter", "throwingProxy", "throwingArray", "revokedProxy"] as const;
type ExoticName = (typeof exoticNames)[number];

/**
 * Builds an input that throws or is revoked. These are made inside the property, not generated:
 * fast-check inspects every generated value, and that inspection throws on a revoked Proxy.
 */
function buildExotic(name: ExoticName): unknown {
  switch (name) {
    case "throwingGetter":
      return Object.defineProperty({}, "kind", {
        enumerable: true,
        get(): never {
          throw new Error("getter throws");
        },
      });
    case "throwingProxy":
      return new Proxy(
        {},
        {
          get() {
            throw new Error("get trap throws");
          },
          ownKeys() {
            throw new Error("ownKeys trap throws");
          },
          getOwnPropertyDescriptor() {
            throw new Error("descriptor trap throws");
          },
        },
      );
    case "throwingArray":
      return new Proxy([], {
        get() {
          throw new Error("length trap throws");
        },
      });
    case "revokedProxy": {
      const revocable = Proxy.revocable({}, {});
      revocable.revoke();
      return revocable.proxy;
    }
  }
}

/** One generated input: a plain value, or the name of an exotic input to build in the body. */
type Candidate =
  | { readonly kind: "value"; readonly value: unknown }
  | { readonly kind: "exotic"; readonly name: ExoticName };
const twentyFourArbitraryRows = fc.array(weirdValue, { minLength: 24, maxLength: 24 });

const validGridWithOneArbitraryValue = fc
  .tuple(validGrid, fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 39 }), weirdValue)
  .map(([grid, r, c, value]) => withCell(grid, r, c, value));

/** True when a result has the shape the requirements promise (requirements 8.1, 10.1 to 10.4). */
function isWellFormed(result: GridResult | ContentResult): boolean {
  if (result.ok) return true;
  const { violations } = result;
  if (violations.length === 0) return false;
  let previousRow = -1;
  let previousCol = -1;
  for (const violation of violations) {
    if (!KNOWN_CODES.has(violation.code)) return false;
    if (violation.message.length === 0) return false;
    const row = violation.row ?? -1;
    const col = violation.col ?? -1;
    if (violation.row !== null && (!Number.isInteger(violation.row) || row < 0 || row > 24)) {
      return false;
    }
    if (violation.col !== null && (!Number.isInteger(violation.col) || col < 0 || col > 40)) {
      return false;
    }
    // Sorted by row, then column; `null` sorts first (as -1).
    if (row < previousRow || (row === previousRow && col < previousCol)) return false;
    previousRow = row;
    previousCol = col;
  }
  return true;
}

/** An invalid cell value for each rule of requirement 9, paired with the cell it replaces. */
const invalidCell: fc.Arbitrary<unknown> = fc.oneof(
  fc.oneof(fc.integer(), fc.string(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
  fc.constant([]),
  fc.constantFrom("box", "Text", "", "TEXT", "image").map((kind) => ({
    kind,
    ch: " ",
    fg: "white",
    bg: "black",
    conceal: false,
  })),
  fc.constant({ ...BLANK_CELL, extra: 1 }),
  fc.constantFrom("", "ab", 5, "\u2588", "😀", "\t", "\uD800").map((ch) => ({
    kind: "text",
    ch,
    fg: "white",
    bg: "black",
    conceal: false,
  })),
  fc.constantFrom(0, -1, 64, 1.5, Number.NaN, "3").map((bits) => ({
    kind: "mosaic",
    bits,
    separated: false,
    fg: "white",
    bg: "black",
    conceal: false,
  })),
  fc.constant({ kind: "mosaic", bits: 1, separated: 1, fg: "white", bg: "black", conceal: false }),
  fc.constantFrom("grey", "pink", "").map((colour) => ({
    kind: "text",
    ch: "A",
    fg: colour,
    bg: "black",
    conceal: false,
  })),
  fc.constant({ kind: "text", ch: "A", fg: "white", bg: "black", conceal: "no" }),
  fc.constantFrom(...ILLEGIBLE_PAIRS).map(([fg, bg]) => ({
    kind: "text",
    ch: "x",
    fg,
    bg,
    conceal: false,
  })),
);

describe("validateGrid properties (Properties 7, 8, 9 and 12)", () => {
  it("Property 7: validateGrid and validateContentRows never throw, and their results are well formed for any input", () => {
    const candidate = fc.oneof(
      weirdValue.map((value): Candidate => ({ kind: "value", value })),
      twentyFourArbitraryRows.map((value): Candidate => ({ kind: "value", value })),
      validGridWithOneArbitraryValue.map((value): Candidate => ({ kind: "value", value })),
      fc.constantFrom(...exoticNames).map((name): Candidate => ({ kind: "exotic", name })),
    );
    fc.assert(
      fc.property(candidate, (c) => {
        const input = c.kind === "value" ? c.value : buildExotic(c.name);
        return isWellFormed(validateGrid(input)) && isWellFormed(validateContentRows(input));
      }),
    );
  });

  it("Property 8: a valid grid validates to a frozen copy that shares nothing with the input", () => {
    fc.assert(
      fc.property(validGrid, (grid) => {
        const before = structuredClone(grid);
        const result = validateGrid(grid);
        if (!result.ok) return false;
        const { page } = result;

        expect(page).toEqual(grid);
        expect(grid).toEqual(before);
        expect(page).not.toBe(grid);
        page.forEach((row, r) => {
          expect(row).not.toBe(grid[r]);
          expect(Object.isFrozen(row)).toBe(true);
          row.forEach((cell, c) => {
            expect(cell).not.toBe(grid[r]?.[c]);
            expect(Object.isFrozen(cell)).toBe(true);
          });
        });
        expect(Object.isFrozen(page)).toBe(true);
        return true;
      }),
    );
  });

  it("Property 9: one invalid cell fails validation, and every violation names that cell", () => {
    fc.assert(
      fc.property(
        validGrid,
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 39 }),
        invalidCell,
        (grid, r, c, value) => {
          const result = validateGrid(withCell(grid, r, c, value));
          if (result.ok) return false;
          return result.violations.every((v) => v.row === r && v.col === c);
        },
      ),
    );
  });

  it("Property 12: validateGrid reads no row at 24 or above and no cell at 40 or above", () => {
    const indexOf = (prop: string | symbol): number | undefined =>
      typeof prop === "string" && /^(?:0|[1-9]\d*)$/.test(prop) ? Number(prop) : undefined;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 200 }),
        (rowCount, rowLength) => {
          const rowReads: number[] = [];
          const cellReads: number[] = [];
          const rows = Array.from({ length: rowCount }, () =>
            Array.from({ length: rowLength }, () => ({ ...BLANK_CELL })),
          ).map(
            (row) =>
              new Proxy(row, {
                get(target, prop, receiver) {
                  const index = indexOf(prop);
                  if (index !== undefined) cellReads.push(index);
                  const value: unknown = Reflect.get(target, prop, receiver);
                  return value;
                },
              }),
          );
          const outer = new Proxy(rows, {
            get(target, prop, receiver) {
              const index = indexOf(prop);
              if (index !== undefined) rowReads.push(index);
              const value: unknown = Reflect.get(target, prop, receiver);
              return value;
            },
          });

          validateGrid(outer);
          return rowReads.every((i) => i < 24) && cellReads.every((i) => i < 40);
        },
      ),
    );
  });
});
