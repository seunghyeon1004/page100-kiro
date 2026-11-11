import { describe, expect, it } from "vitest";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import type { GridViolation } from "../../src/grid/grid-violation.js";
import { validateGrid } from "../../src/grid/validate-grid.js";

type Rows = unknown[][];

/** A full 24 x 40 grid of fresh blank cells that a test can change. */
function blankRows(): Rows {
  return Array.from({ length: 24 }, () => Array.from({ length: 40 }, () => ({ ...BLANK_CELL })));
}

/** Puts `value` at (row, col) of a grid and returns the grid. */
function place(rows: Rows, row: number, col: number, value: unknown): Rows {
  const target = rows[row];
  if (target === undefined) throw new Error(`no row ${String(row)} in the test grid`);
  target[col] = value;
  return rows;
}

/** A text cell with the given fields, for tests. */
function text(ch: unknown, fg: unknown = "white", bg: unknown = "black", conceal: unknown = false) {
  return { kind: "text", ch, fg, bg, conceal };
}

/** A mosaic cell with the given fields, for tests. */
function mosaic(
  bits: unknown,
  separated: unknown = false,
  fg: unknown = "white",
  bg: unknown = "black",
) {
  return { kind: "mosaic", bits, separated, fg, bg, conceal: false };
}

/** The violations of an input, or an empty list when the input is valid. */
function violationsOf(input: unknown): GridViolation[] {
  const result = validateGrid(input);
  return result.ok ? [] : [...result.violations];
}

describe("validateGrid accepts valid grids (requirements 8.1, 8.9 and 8.10)", () => {
  it("returns a frozen copy that shares no array or cell with the input", () => {
    const input = blankRows();
    const result = validateGrid(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.isFrozen(result.page)).toBe(true);
    expect(Object.isFrozen(result.page[0])).toBe(true);
    expect(Object.isFrozen(result.page[0]?.[0])).toBe(true);
    expect(result.page[0]).not.toBe(input[0]);
    expect(result.page[0]?.[0]).not.toBe(input[0]?.[0]);
    expect(result.page).toEqual(input);
  });

  it("accepts any repertoire text in the frame rows 0, 1, 22 and 23", () => {
    const rows = blankRows();
    for (const r of [0, 1, 22, 23]) {
      for (let c = 0; c < 40; c++) {
        place(rows, r, c, text("Z"));
      }
    }
    expect(violationsOf(rows)).toEqual([]);
  });

  it("accepts blue on black when the cell is a text space or a mosaic", () => {
    const rows = blankRows();
    place(rows, 4, 0, text(" ", "blue", "black"));
    place(rows, 4, 1, mosaic(63, false, "blue", "black"));
    expect(violationsOf(rows)).toEqual([]);
  });
});

describe("grid-level violations (requirements 8.4 to 8.6)", () => {
  it.each([null, undefined, "x", {}, 0, true, Symbol("s"), 1n, () => 0])(
    "reports one not-array violation for %s",
    (input: unknown) => {
      expect(violationsOf(input)).toEqual([
        { code: "not-array", row: null, col: null, message: "grid is not an array" },
      ]);
    },
  );

  it("reports row-count for 0, 23 and 25 rows at the first missing or first extra row", () => {
    const expectCount = (rows: unknown[], row: number, actual: number) => {
      expect(violationsOf(rows)).toEqual([
        {
          code: "row-count",
          row,
          col: null,
          expected: 24,
          actual,
          message: `grid has ${String(actual)} rows, expected 24`,
        },
      ]);
    };
    expectCount([], 0, 0);
    expectCount(blankRows().slice(0, 23), 23, 23);
    expectCount([...blankRows(), blankRows()[0]], 24, 25);
  });

  it("reports row-not-array with the row and no column", () => {
    const rows: unknown[] = blankRows();
    rows[3] = "x";
    expect(violationsOf(rows)).toEqual([
      { code: "row-not-array", row: 3, col: null, message: "row 3: row is not an array" },
    ]);
  });

  it("reports row-length at the first missing cell (39 cells) or the first extra cell (41 cells)", () => {
    const short = blankRows();
    short[5] = (short[5] ?? []).slice(0, 39);
    expect(violationsOf(short)).toEqual([
      {
        code: "row-length",
        row: 5,
        col: 39,
        expected: 40,
        actual: 39,
        message: "row 5: row has 39 cells, expected 40",
      },
    ]);

    const long = blankRows();
    long[5] = [...(long[5] ?? []), { ...BLANK_CELL }];
    expect(violationsOf(long)).toEqual([
      {
        code: "row-length",
        row: 5,
        col: 40,
        expected: 40,
        actual: 41,
        message: "row 5: row has 41 cells, expected 40",
      },
    ]);
  });

  it("checks a sparse row of one million holes as 40 cell errors, then reports its length", () => {
    const rows = blankRows();
    rows[0] = new Array<unknown>(1_000_000);
    const violations = violationsOf(rows);
    expect(violations).toHaveLength(41);
    expect(violations.slice(0, 40).every((v) => v.code === "cell-not-object")).toBe(true);
    expect(violations[40]).toEqual({
      code: "row-length",
      row: 0,
      col: 40,
      expected: 40,
      actual: 1_000_000,
      message: "row 0: row has 1000000 cells, expected 40",
    });
  });
});

describe("unreadable input (requirement 8.3)", () => {
  it("reports a revoked Proxy as an unreadable grid", () => {
    const revocable = Proxy.revocable([], {});
    revocable.revoke();
    expect(violationsOf(revocable.proxy)).toEqual([
      { code: "unreadable", row: null, col: null, message: "grid could not be read" },
    ]);
  });

  it("reports a length that throws as an unreadable grid", () => {
    const proxy = new Proxy([], {
      get() {
        throw new Error("length is not readable");
      },
    });
    expect(violationsOf(proxy)).toEqual([
      { code: "unreadable", row: null, col: null, message: "grid could not be read" },
    ]);
  });

  it("reports a row whose getter throws as unreadable, with no other violation for that row", () => {
    const rows = blankRows();
    Object.defineProperty(rows, 4, {
      enumerable: true,
      get() {
        throw new Error("boom");
      },
    });
    expect(violationsOf(rows)).toEqual([
      { code: "unreadable", row: 4, col: null, message: "row 4: row could not be read" },
    ]);
  });

  it("reports a cell whose getter throws as unreadable at that cell only", () => {
    const rows = blankRows();
    const row = rows[2] ?? [];
    Object.defineProperty(row, 7, {
      enumerable: true,
      get() {
        throw new Error("boom");
      },
    });
    expect(violationsOf(rows)).toEqual([
      { code: "unreadable", row: 2, col: 7, message: "row 2 col 7: cell could not be read" },
    ]);
  });

  it("reports a cell whose field getter throws as unreadable at that cell", () => {
    const rows = blankRows();
    place(
      rows,
      0,
      0,
      Object.defineProperty(text("A"), "fg", {
        enumerable: true,
        get() {
          throw new Error("boom");
        },
      }),
    );
    expect(violationsOf(rows)).toEqual([
      { code: "unreadable", row: 0, col: 0, message: "row 0 col 0: cell could not be read" },
    ]);
  });
});

describe("cell violations (requirements 9.1 to 9.9)", () => {
  it("reports cell-not-object for a number, an array and a function", () => {
    for (const bad of [5, [], () => 0]) {
      const rows = place(blankRows(), 0, 0, bad);
      expect(violationsOf(rows)).toEqual([
        { code: "cell-not-object", row: 0, col: 0, message: "row 0 col 0: cell is not an object" },
      ]);
    }
  });

  it("reports cell-kind and checks nothing else in the cell", () => {
    const rows = place(blankRows(), 1, 2, { kind: "box", ch: "\u2588", fg: "grey", extra: 1 });
    expect(violationsOf(rows)).toEqual([
      {
        code: "cell-kind",
        row: 1,
        col: 2,
        message: 'row 1 col 2: kind must be "text" or "mosaic"',
      },
    ]);
  });

  it("reports one cell-field-unknown per extra key, in ascending order", () => {
    const rows = place(blankRows(), 0, 0, { ...text("A"), zeta: 1, alpha: 2 });
    expect(violationsOf(rows)).toEqual([
      {
        code: "cell-field-unknown",
        row: 0,
        col: 0,
        field: "alpha",
        message: 'row 0 col 0: unknown field "alpha"',
      },
      {
        code: "cell-field-unknown",
        row: 0,
        col: 0,
        field: "zeta",
        message: 'row 0 col 0: unknown field "zeta"',
      },
    ]);
  });

  it("leaves a field name out of the message when it is not printable ASCII or too long", () => {
    const control = place(blankRows(), 0, 0, { ...text("A"), "a\u0001b": 1 });
    expect(violationsOf(control)).toEqual([
      {
        code: "cell-field-unknown",
        row: 0,
        col: 0,
        field: "a\u0001b",
        message: "row 0 col 0: unknown field",
      },
    ]);
    const long = place(blankRows(), 0, 0, { ...text("A"), ["x".repeat(33)]: 1 });
    expect(violationsOf(long)).toEqual([
      {
        code: "cell-field-unknown",
        row: 0,
        col: 0,
        field: "x".repeat(33),
        message: "row 0 col 0: unknown field",
      },
    ]);
  });

  it("reports an extra mosaic field the same way", () => {
    const rows = place(blankRows(), 0, 0, { ...mosaic(1), ch: " " });
    expect(violationsOf(rows)).toEqual([
      {
        code: "cell-field-unknown",
        row: 0,
        col: 0,
        field: "ch",
        message: 'row 0 col 0: unknown field "ch"',
      },
    ]);
  });

  it("reports text-ch for an empty string, two characters and a number", () => {
    for (const bad of ["", "ab", 5]) {
      expect(violationsOf(place(blankRows(), 0, 0, text(bad)))).toEqual([
        {
          code: "text-ch",
          row: 0,
          col: 0,
          message: "row 0 col 0: ch must be exactly one code point",
        },
      ]);
    }
  });

  it("reports text-repertoire with the code point for mosaics, emoji, controls and lone surrogates", () => {
    const cases: [string, number][] = [
      ["\u2588", 0x2588],
      ["😀", 0x1f600],
      ["\t", 0x9],
      ["\uD800", 0xd800],
    ];
    for (const [ch, codePoint] of cases) {
      const violations = violationsOf(place(blankRows(), 0, 0, text(ch)));
      expect(violations).toEqual([
        {
          code: "text-repertoire",
          row: 0,
          col: 0,
          codePoint,
          message: `row 0 col 0: U+${codePoint.toString(16).toUpperCase().padStart(4, "0")} is not in the repertoire`,
        },
      ]);
    }
  });

  it("reports mosaic-bits for 0, -1, 64, 1.5, NaN and the string '3'", () => {
    for (const bits of [0, -1, 64, 1.5, Number.NaN, "3"]) {
      expect(violationsOf(place(blankRows(), 0, 0, mosaic(bits)))).toEqual([
        {
          code: "mosaic-bits",
          row: 0,
          col: 0,
          message:
            "row 0 col 0: bits must be an integer from 1 to 63; a blank cell is a text space",
        },
      ]);
    }
  });

  it("reports mosaic-separated for a non-boolean", () => {
    expect(violationsOf(place(blankRows(), 0, 0, mosaic(1, 1)))).toEqual([
      {
        code: "mosaic-separated",
        row: 0,
        col: 0,
        message: "row 0 col 0: separated must be true or false",
      },
    ]);
  });

  it("reports colour once for fg and once for bg", () => {
    expect(violationsOf(place(blankRows(), 0, 0, text("A", "grey", "pink")))).toEqual([
      {
        code: "colour",
        row: 0,
        col: 0,
        field: "fg",
        message: "row 0 col 0: fg is not one of the eight colours",
      },
      {
        code: "colour",
        row: 0,
        col: 0,
        field: "bg",
        message: "row 0 col 0: bg is not one of the eight colours",
      },
    ]);
  });

  it("reports conceal for a non-boolean", () => {
    expect(violationsOf(place(blankRows(), 0, 0, text("A", "white", "black", 1)))).toEqual([
      { code: "conceal", row: 0, col: 0, message: "row 0 col 0: conceal must be true or false" },
    ]);
  });
});

describe("contrast (requirement 9.10)", () => {
  it("reports blue on black with the unrounded ratio", () => {
    const violations = violationsOf(place(blankRows(), 0, 0, text("x", "blue", "black")));
    expect(violations).toHaveLength(1);
    const [violation] = violations;
    expect(violation).toMatchObject({
      code: "contrast",
      row: 0,
      col: 0,
      fg: "blue",
      bg: "black",
      message: "row 0 col 0: blue on black is 2.44:1, below 4.5:1",
    });
    if (violation?.code !== "contrast") throw new Error("expected a contrast violation");
    expect(violation.ratio).toBeCloseTo(2.444, 3);
  });

  it("reports concealed illegible text as well", () => {
    const violations = violationsOf(place(blankRows(), 0, 0, text("x", "blue", "black", true)));
    expect(violations.map((v) => v.code)).toEqual(["contrast"]);
  });

  it("reports white on red as 4.00:1", () => {
    expect(violationsOf(place(blankRows(), 0, 0, text("x", "white", "red")))).toEqual([
      {
        code: "contrast",
        row: 0,
        col: 0,
        fg: "white",
        bg: "red",
        ratio: expect.any(Number) as number,
        message: "row 0 col 0: white on red is 4.00:1, below 4.5:1",
      },
    ]);
  });
});

describe("ordering and partial checks (requirements 8.8 and 10.4)", () => {
  it("orders the problems of one cell as requirement 9 lists them", () => {
    const rows = place(blankRows(), 6, 9, {
      kind: "text",
      ch: "\u2588",
      fg: "grey",
      bg: "black",
      conceal: "x",
      extra: 1,
    });
    expect(violationsOf(rows).map((v) => v.code)).toEqual([
      "cell-field-unknown",
      "text-repertoire",
      "colour",
      "conceal",
    ]);
  });

  it("still checks the rows it can reach when the row count is wrong", () => {
    const rows = place(blankRows().slice(0, 23), 3, 4, text(5));
    expect(violationsOf(rows)).toEqual([
      {
        code: "text-ch",
        row: 3,
        col: 4,
        message: "row 3 col 4: ch must be exactly one code point",
      },
      {
        code: "row-count",
        row: 23,
        col: null,
        expected: 24,
        actual: 23,
        message: "grid has 23 rows, expected 24",
      },
    ]);
  });

  it("returns violations sorted by row and then column", () => {
    const rows = blankRows();
    place(rows, 9, 1, text(5));
    place(rows, 2, 8, text(5));
    place(rows, 2, 3, text(5));
    const violations = violationsOf(rows);
    const positions = violations.map((v) => [v.row, v.col]);
    expect(positions).toEqual([
      [2, 3],
      [2, 8],
      [9, 1],
    ]);
  });
});

describe("validateGrid never throws (requirement 8.2)", () => {
  it("returns a violation for every odd input", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const inputs: unknown[] = [cyclic, new Map(), new Set(), Symbol("x"), new Uint8Array(3)];
    for (const input of inputs) {
      const result = validateGrid(input);
      expect(result.ok).toBe(false);
    }
  });
});
