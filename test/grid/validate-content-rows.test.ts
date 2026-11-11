import { describe, expect, it } from "vitest";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import type { GridViolation } from "../../src/grid/grid-violation.js";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";

type Rows = unknown[][];

/** 20 rows of 40 fresh blank cells that a test can change. */
function blankContent(): Rows {
  return Array.from({ length: 20 }, () => Array.from({ length: 40 }, () => ({ ...BLANK_CELL })));
}

/** The violations of an input, or an empty list when the input is valid. */
function violationsOf(input: unknown): GridViolation[] {
  const result = validateContentRows(input);
  return result.ok ? [] : [...result.violations];
}

describe("validateContentRows accepts 20 valid rows (requirements 12.1, 12.6)", () => {
  it("returns a frozen copy that shares nothing with the input", () => {
    const input = blankContent();
    const result = validateContentRows(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content).toEqual(input);
    expect(result.content).not.toBe(input);
    expect(result.content[0]).not.toBe(input[0]);
    expect(Object.isFrozen(result.content)).toBe(true);
    expect(Object.isFrozen(result.content[19])).toBe(true);
  });
});

describe("content row count (requirements 12.2 and 12.4)", () => {
  it("reports 19 rows at page row 21 and 21 rows at page row 22", () => {
    expect(violationsOf(blankContent().slice(0, 19))).toEqual([
      {
        code: "row-count",
        row: 21,
        col: null,
        expected: 20,
        actual: 19,
        message: "content has 19 rows, expected 20",
      },
    ]);
    const extra = [...blankContent(), blankContent()[0]];
    expect(violationsOf(extra)).toEqual([
      {
        code: "row-count",
        row: 22,
        col: null,
        expected: 20,
        actual: 21,
        message: "content has 21 rows, expected 20",
      },
    ]);
  });

  it("reports zero rows at page row 2", () => {
    expect(violationsOf([])).toEqual([
      {
        code: "row-count",
        row: 2,
        col: null,
        expected: 20,
        actual: 0,
        message: "content has 0 rows, expected 20",
      },
    ]);
  });
});

describe("content row numbers (requirement 12.4)", () => {
  it("reports content row 0 as page row 2", () => {
    const rows = blankContent();
    rows[0] = [...(rows[0] ?? [])];
    rows[0][0] = 5;
    expect(violationsOf(rows)).toEqual([
      { code: "cell-not-object", row: 2, col: 0, message: "row 2 col 0: cell is not an object" },
    ]);
  });

  it("reports row-length and row-not-array at page rows 2 to 21", () => {
    const rows: unknown[] = blankContent();
    rows[19] = "x";
    const second = rows[1];
    if (!Array.isArray(second)) throw new Error("row 1 should be an array");
    rows[1] = second.slice(0, 12);
    expect(violationsOf(rows)).toEqual([
      {
        code: "row-length",
        row: 3,
        col: 12,
        expected: 40,
        actual: 12,
        message: "row 3: row has 12 cells, expected 40",
      },
      { code: "row-not-array", row: 21, col: null, message: "row 21: row is not an array" },
    ]);
  });
});

describe("content messages use the word content", () => {
  it("reports a non-array as content is not an array", () => {
    expect(violationsOf("x")).toEqual([
      { code: "not-array", row: null, col: null, message: "content is not an array" },
    ]);
  });

  it("reports a revoked Proxy as content could not be read", () => {
    const revocable = Proxy.revocable([], {});
    revocable.revoke();
    expect(violationsOf(revocable.proxy)).toEqual([
      { code: "unreadable", row: null, col: null, message: "content could not be read" },
    ]);
  });
});

describe("contrast and cell rules apply to content (requirement 12.3)", () => {
  it("reports blue on black at its page row", () => {
    const rows = blankContent();
    rows[5] = [...(rows[5] ?? [])];
    rows[5][7] = { kind: "text", ch: "x", fg: "blue", bg: "black", conceal: false };
    expect(violationsOf(rows)).toEqual([
      {
        code: "contrast",
        row: 7,
        col: 7,
        fg: "blue",
        bg: "black",
        ratio: expect.any(Number) as number,
        message: "row 7 col 7: blue on black is 2.44:1, below 4.5:1",
      },
    ]);
  });
});
