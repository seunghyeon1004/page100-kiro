import { describe, expect, it } from "vitest";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import type { Cell, ValidContent } from "../../src/grid/types.js";
import { serialiseContent } from "../../src/markup/serialise-content.js";

const blankRow = (): Cell[] => Array.from({ length: 40 }, () => BLANK_CELL);

const textRow = (ch: string): Cell[] => [
  { kind: "text", ch, fg: "white", bg: "black", conceal: false },
  ...Array.from({ length: 39 }, () => BLANK_CELL),
];

/** Validates 20 rows into content, failing the test if they are not valid. */
function contentOf(rows: Cell[][]): ValidContent {
  const result = validateContentRows(rows);
  if (!result.ok) throw new Error(`test content is invalid: ${result.violations[0].message}`);
  return result.content;
}

describe("canonical content serialisation (requirement 16.6)", () => {
  it("writes all-blank content as one LF", () => {
    expect(serialiseContent(contentOf(Array.from({ length: 20 }, blankRow)))).toBe("\n");
  });

  it("writes rows only up to the last non-blank row", () => {
    const rows = Array.from({ length: 20 }, blankRow);
    rows[0] = textRow("A");
    expect(serialiseContent(contentOf(rows))).toBe("A\n");
  });

  it("writes a blank row in the middle as an empty line", () => {
    const rows = Array.from({ length: 20 }, blankRow);
    rows[0] = textRow("A");
    rows[2] = textRow("B");
    expect(serialiseContent(contentOf(rows))).toBe("A\n\nB\n");
  });

  it("writes a full 20-row content with one LF per row", () => {
    const rows = Array.from({ length: 20 }, () => textRow("X"));
    const out = serialiseContent(contentOf(rows));
    expect(out).toBe("X\n".repeat(20));
    expect(out.endsWith("\n\n")).toBe(false);
  });
});
