import { describe, expect, it } from "vitest";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import type { MarkupError } from "../../src/markup/markup-error.js";
import { parseContent } from "../../src/markup/parse-content.js";

/** The errors of content markup, or an empty list when it parses. */
function errorsOf(text: string): MarkupError[] {
  const result = parseContent(text);
  return result.ok ? [] : [...result.errors];
}

/** `count` lines, each ended by LF, with some lines replaced. */
function content(count: number, overrides: Readonly<Record<number, string>> = {}): string {
  return Array.from({ length: count }, (_, i) => `${overrides[i] ?? ""}\n`).join("");
}

describe("content line numbering (requirement 13.4)", () => {
  it("reads line 0 as page row 2", () => {
    const result = parseContent(content(1, { 0: "A" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(20);
    expect(result.value[0]?.[0]).toMatchObject({ kind: "text", ch: "A" });
  });

  it("fills the rows the file leaves out with blank cells", () => {
    const result = parseContent(content(3, { 2: "Z" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[17]).toHaveLength(40);
    expect(result.value[17]?.every((cell) => cell === BLANK_CELL || cell.kind === "text")).toBe(
      true,
    );
    expect(result.value[19]?.[39]).toEqual(BLANK_CELL);
  });
});

describe("content line counts (requirements 13.2 and 13.4)", () => {
  it("reports the empty string as zero rows at page row 2", () => {
    expect(errorsOf("")).toEqual([
      {
        code: "row-count",
        row: 2,
        col: null,
        expected: 20,
        actual: 0,
        message: "content has 0 rows, expected 1 to 20",
      },
    ]);
  });

  it("reads a single LF as one blank row", () => {
    const result = parseContent("\n");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(20);
  });

  it("reads two LFs as two blank rows", () => {
    expect(parseContent("\n\n").ok).toBe(true);
  });

  it("accepts 20 lines and reports 21 at page row 22", () => {
    expect(parseContent(content(20)).ok).toBe(true);
    expect(errorsOf(content(21))).toEqual([
      {
        code: "row-count",
        row: 22,
        col: null,
        expected: 20,
        actual: 21,
        message: "content has 21 rows, limit 20",
      },
    ]);
  });

  it("still parses the first 20 lines when there are too many", () => {
    const errors = errorsOf(content(21, { 0: "{x}" }));
    expect(errors.map((e) => e.code)).toEqual(["tag-unknown", "row-count"]);
    expect(errors[0]).toMatchObject({ row: 2 });
  });
});

describe("errors in several rows (requirements 15.3 to 15.5)", () => {
  it("reports one error for each bad row: rows 3, 7 and 19", () => {
    const text = content(20, { 1: "A{x}", 5: "{?}{?}", 17: "B\tC" });
    const errors = errorsOf(text);
    expect(errors.map((e) => e.row)).toEqual([3, 7, 19]);
    expect(errors.map((e) => e.code)).toEqual([
      "tag-unknown",
      "mode-already-on",
      "char-not-allowed",
    ]);
  });

  it("reports the first error of a row, and no second one from that row", () => {
    const errors = errorsOf(content(1, { 0: "A{x}\tB{/?}" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "tag-unknown", row: 2, col: 1 });
  });
});

describe("messages and positions", () => {
  it("reports a tag error with its page row and column", () => {
    expect(errorsOf(content(2, { 1: "AB{x}" }))).toEqual([
      {
        code: "tag-unknown",
        row: 3,
        col: 2,
        tag: "{x}",
        message: 'row 3 col 2: unknown tag "{x}"',
      },
    ]);
  });

  it("reports a CR in a content file at its cell index", () => {
    expect(errorsOf("ABC\r\n")[0]).toMatchObject({
      code: "cr",
      row: 2,
      col: 3,
      message: "row 2 col 3: carriage return (U+000D) is not allowed; use LF line endings",
    });
  });
});

describe("contrast is checked only by the validator (requirement 15.6)", () => {
  it("parses {b}x, and validateContentRows then reports contrast", () => {
    const parsed = parseContent(content(1, { 0: "{b}x" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const checked = validateContentRows(parsed.value);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.violations.map((v) => v.code)).toEqual(["contrast"]);
    expect(checked.violations[0]).toMatchObject({ row: 2, col: 0, fg: "blue", bg: "black" });
  });
});
