import { describe, expect, it } from "vitest";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import { validateGrid } from "../../src/grid/validate-grid.js";
import type { Cell, ValidPage } from "../../src/grid/types.js";
import { serialisePage } from "../../src/markup/serialise-page.js";
import { serialiseRow } from "../../src/markup/serialise-row.js";

/** A 40-cell row: the given cells, then blanks. */
function row(...cells: Cell[]): Cell[] {
  const out = [...cells];
  while (out.length < 40) out.push(BLANK_CELL);
  return out;
}

const text = (
  ch: string,
  fg: Cell["fg"] = "white",
  bg: Cell["bg"] = "black",
  conceal = false,
): Cell => ({
  kind: "text",
  ch,
  fg,
  bg,
  conceal,
});

const mosaic = (
  bits: number,
  separated: boolean,
  fg: Cell["fg"] = "white",
  bg: Cell["bg"] = "black",
): Cell => ({
  kind: "mosaic",
  bits,
  separated,
  fg,
  bg,
  conceal: false,
});

/** Validates rows into a page, failing the test if they are not a valid page. */
function pageOf(rows: Cell[][]): ValidPage {
  const result = validateGrid(rows);
  if (!result.ok) throw new Error(`test page is invalid: ${result.violations[0].message}`);
  return result.page;
}

/** A page with the given rows at the top and blank rows after them. */
function pageWith(...rows: Cell[][]): ValidPage {
  const all = [...rows];
  while (all.length < 24) all.push(row());
  return pageOf(all);
}

describe("canonical page serialisation (requirement 16.5)", () => {
  it("writes an all-blank page as 24 LFs", () => {
    expect(serialisePage(pageWith())).toBe("\n".repeat(24));
  });

  it("writes one LF after each of the 24 lines and no CR", () => {
    const out = serialisePage(pageWith(row(text("A"))));
    expect(out.split("\n")).toHaveLength(25);
    expect(out.includes("\r")).toBe(false);
    expect(out.startsWith("A\n")).toBe(true);
  });
});

describe("row serialisation (requirements 16.2 to 16.4)", () => {
  it("keeps a trailing red-foreground space, which differs from the blank cell", () => {
    const cells = row(...Array.from({ length: 39 }, () => BLANK_CELL), text(" ", "red"));
    expect(serialiseRow(cells)).toBe(`${" ".repeat(39)}{r} `);
  });

  it("trims trailing blank cells", () => {
    expect(serialiseRow(row(text("A")))).toBe("A");
    expect(serialiseRow(row())).toBe("");
  });

  it("writes a text brace as a doubled brace", () => {
    expect(serialiseRow(row(text("{"), text("}")))).toBe("{{}");
  });

  it("writes a separated mosaic, a text cell and another separated mosaic with one {~}", () => {
    const out = serialiseRow(row(mosaic(63, true), text("A"), mosaic(63, true)));
    expect(out).toBe("{~}\u2588A\u2588");
  });

  it("writes the tags in the order bg, fg, conceal, separated", () => {
    const cells = row(mosaic(63, true, "black", "red"));
    cells[0] = { kind: "mosaic", bits: 63, separated: true, fg: "black", bg: "red", conceal: true };
    expect(serialiseRow(cells)).toBe("{R}{k}{?}{~}\u2588");
  });

  it("writes each state change once and no tag for a cell that keeps the state", () => {
    expect(serialiseRow(row(text("A", "red"), text("B", "red"), text("C", "white")))).toBe(
      "{r}AB{w}C",
    );
  });
});

describe("a full page with state tags", () => {
  it("keeps every cell of a row that differs from the blank cell", () => {
    const page = pageWith(row(text("Z", "green", "blue", true)));
    expect(serialisePage(page).split("\n")[0]).toBe("{B}{g}{?}Z");
  });
});
