import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { GridViolation } from "../../src/grid/grid-violation.js";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import { validateGrid } from "../../src/grid/validate-grid.js";
import { validContent, validRow } from "./arbitraries.js";

/** Any value a row slot could hold: a valid row, a row with a bad cell, a wrong length, or a non-array. */
const anyRowValue = fc.oneof(
  validRow,
  fc.constant(null),
  fc.constant("row"),
  fc
    .tuple(
      validRow,
      fc.integer({ min: 0, max: 39 }),
      fc.constantFrom(5, "x", null, { kind: "box" }),
    )
    .map(([row, col, bad]) => {
      const copy = [...row];
      copy[col] = bad;
      return copy;
    }),
  fc.integer({ min: 0, max: 60 }).map((length) => Array.from({ length }, () => ({ kind: "text" }))),
);

/** The frame rows of a full grid. Their content does not affect the content rows, so any row will do. */
const frameRow = fc.oneof(validRow, anyRowValue);

describe("validateContentRows properties (Properties 10 and 11)", () => {
  it("Property 10: the content violations equal the page violations for rows 2 to 21, in order and field for field", () => {
    fc.assert(
      fc.property(
        fc.array(anyRowValue, { minLength: 20, maxLength: 20 }),
        frameRow,
        frameRow,
        frameRow,
        frameRow,
        (rows, f0, f1, f22, f23) => {
          const content = validateContentRows(rows);
          const grid = validateGrid([f0, f1, ...rows, f22, f23]);

          const fromContent: GridViolation[] = content.ok ? [] : [...content.violations];
          const fromGrid: GridViolation[] = grid.ok
            ? []
            : grid.violations.filter((v) => v.row !== null && v.row >= 2 && v.row <= 21);

          expect(fromGrid).toEqual(fromContent);
        },
      ),
    );
  });

  it("Property 11: a valid content set validates to a frozen copy, and a wrong row count is reported at row 2 + min(n, 20)", () => {
    fc.assert(
      fc.property(validContent, (content) => {
        const before = structuredClone(content);
        const result = validateContentRows(content);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.content).toEqual(content);
        expect(result.content).not.toBe(content);
        expect(Object.isFrozen(result.content)).toBe(true);
        result.content.forEach((row, i) => {
          expect(row).not.toBe(content[i]);
          expect(Object.isFrozen(row)).toBe(true);
        });
        expect(content).toEqual(before);
      }),
    );

    fc.assert(
      fc.property(
        fc
          .integer({ min: 0, max: 30 })
          .filter((n) => n !== 20)
          .chain((n) =>
            fc.array(validRow, { minLength: n, maxLength: n }).map((rows) => ({ n, rows })),
          ),
        ({ n, rows }) => {
          const result = validateContentRows(rows);
          if (result.ok) return false;
          const countViolations = result.violations.filter((v) => v.code === "row-count");
          return (
            countViolations.length === 1 &&
            countViolations[0]?.row === 2 + Math.min(n, 20) &&
            result.violations.length === 1
          );
        },
      ),
    );
  });
});
