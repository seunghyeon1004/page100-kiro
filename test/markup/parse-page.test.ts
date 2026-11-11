import { describe, expect, it } from "vitest";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import type { Cell } from "../../src/grid/types.js";
import type { MarkupError } from "../../src/markup/markup-error.js";
import { parsePage } from "../../src/markup/parse-page.js";
import { parseRow } from "../../src/markup/parse-row.js";

/** `count` lines, with the given overrides. Each line is listed, not joined, so blank lines survive. */
function lines(count: number, overrides: Readonly<Record<number, string>> = {}): string[] {
  return Array.from({ length: count }, (_, row) => overrides[row] ?? "");
}

/** A full page of 24 lines, each ended by LF, with some lines replaced. */
function page(overrides: Readonly<Record<number, string>> = {}): string {
  return lines(24, overrides)
    .map((line) => `${line}\n`)
    .join("");
}

/** A full page with no final LF. The last line must not be blank, or its row cannot be written. */
function pageNoFinalLf(overrides: Readonly<Record<number, string>>): string {
  return lines(24, overrides).join("\n");
}

/** The errors of a page, or an empty list when it parses. */
function errorsOf(text: string): MarkupError[] {
  const result = parsePage(text);
  return result.ok ? [] : [...result.errors];
}

/** The cells of one row of a parsed page. */
function rowOf(text: string, row: number): Cell[] {
  const result = parsePage(text);
  if (!result.ok) throw new Error(`page does not parse: ${result.errors[0].message}`);
  const cells = result.value[row];
  if (cells === undefined) throw new Error(`no row ${String(row)}`);
  return [...cells];
}

describe("page parsing: shape (requirements 13.2, 13.3 and 13.7)", () => {
  it("parses a page with no final LF", () => {
    const result = parsePage(pageNoFinalLf({ 23: "X" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(24);
    expect(result.value.every((row) => row.length === 40)).toBe(true);
  });

  it("pads short rows to 40 blank cells", () => {
    const row = rowOf(page({ 5: "AB" }), 5);
    expect(row).toHaveLength(40);
    expect(row.slice(2).every((cell) => cell.kind === "text" && cell.ch === " ")).toBe(true);
  });

  it("reports the empty string as zero lines", () => {
    expect(errorsOf("")).toEqual([
      {
        code: "row-count",
        row: 0,
        col: null,
        expected: 24,
        actual: 0,
        message: "page has 0 rows, expected 24",
      },
    ]);
  });

  it("reports 23 lines at row 23 and 25 lines at row 24", () => {
    const short = lines(23)
      .map((line) => `${line}\n`)
      .join("");
    expect(errorsOf(short)).toEqual([
      {
        code: "row-count",
        row: 23,
        col: null,
        expected: 24,
        actual: 23,
        message: "page has 23 rows, expected 24",
      },
    ]);
    const long = lines(25)
      .map((line) => `${line}\n`)
      .join("");
    expect(errorsOf(long)).toEqual([
      {
        code: "row-count",
        row: 24,
        col: null,
        expected: 24,
        actual: 25,
        message: "page has 25 rows, expected 24",
      },
    ]);
  });

  it("accepts a page with and without its final LF", () => {
    expect(parsePage(page()).ok).toBe(true);
    expect(parsePage(pageNoFinalLf({ 23: "X" })).ok).toBe(true);
  });
});

describe("colour tags (requirements 14.1 and 14.5)", () => {
  it("sets the foreground for each letter, and the background for each upper-case letter", () => {
    const letters: [string, string, "fg" | "bg"][] = [
      ["k", "black", "fg"],
      ["r", "red", "fg"],
      ["g", "green", "fg"],
      ["y", "yellow", "fg"],
      ["b", "blue", "fg"],
      ["m", "magenta", "fg"],
      ["c", "cyan", "fg"],
      ["w", "white", "fg"],
      ["K", "black", "bg"],
      ["R", "red", "bg"],
      ["G", "green", "bg"],
      ["Y", "yellow", "bg"],
      ["B", "blue", "bg"],
      ["M", "magenta", "bg"],
      ["C", "cyan", "bg"],
      ["W", "white", "bg"],
    ];
    for (const [letter, colour, side] of letters) {
      const [cell] = rowOf(page({ 0: `{${letter}}A` }), 0);
      if (cell?.kind !== "text") throw new Error("expected a text cell");
      expect(side === "fg" ? cell.fg : cell.bg).toBe(colour);
    }
  });

  it("takes no cells", () => {
    const cells = rowOf(page({ 0: "{r}{G}{?}{/?}A" }), 0);
    expect(cells[0]).toMatchObject({ kind: "text", ch: "A", fg: "red", bg: "green" });
  });

  it("resets the state at the start of every row (requirement 13.6)", () => {
    const text = page({ 0: "{r}{G}A", 1: "B" });
    expect(rowOf(text, 1)[0]).toEqual({
      kind: "text",
      ch: "B",
      fg: "white",
      bg: "black",
      conceal: false,
    });
  });
});

describe("literal braces and unknown tags (requirements 14.3 and 14.4)", () => {
  it("reads {{ as a literal brace and a lone } as an ordinary character", () => {
    const cells = rowOf(page({ 0: "{{}}" }), 0);
    expect(cells.slice(0, 3).map((c) => (c.kind === "text" ? c.ch : "?"))).toEqual(["{", "}", "}"]);
  });

  it("reports tag-unknown with the tag text for {x}, {} and {rg}", () => {
    for (const tag of ["{x}", "{}", "{rg}"]) {
      expect(errorsOf(page({ 4: `AB${tag}` }))).toEqual([
        {
          code: "tag-unknown",
          row: 4,
          col: 2,
          tag,
          message: `row 4 col 2: unknown tag "${tag}"`,
        },
      ]);
    }
  });

  it("reports tag-unterminated for a { at the end of a row", () => {
    expect(errorsOf(page({ 9: "AB{" }))).toEqual([
      {
        code: "tag-unterminated",
        row: 9,
        col: 2,
        message: "row 9 col 2: { has no closing }; write {{ for a literal {",
      },
    ]);
  });
});

describe("mode tags (requirements 14.2 and 14.3)", () => {
  it("reports mode-not-on for a closing tag that is not open", () => {
    expect(errorsOf(page({ 0: "{/?}" }))).toEqual([
      {
        code: "mode-not-on",
        row: 0,
        col: 0,
        mode: "conceal",
        message: "row 0 col 0: {/?} but conceal is not on",
      },
    ]);
    expect(errorsOf(page({ 0: "{/~}" }))[0]).toMatchObject({
      code: "mode-not-on",
      mode: "separated",
      message: "row 0 col 0: {/~} but separated mosaics are not on",
    });
  });

  it("reports mode-already-on for an opening tag that is already open", () => {
    expect(errorsOf(page({ 0: "{?}A{?}" }))).toEqual([
      {
        code: "mode-already-on",
        row: 0,
        col: 1,
        mode: "conceal",
        message: "row 0 col 1: {?} but conceal is already on",
      },
    ]);
    expect(errorsOf(page({ 0: "{~}{~}" }))[0]).toMatchObject({
      code: "mode-already-on",
      mode: "separated",
      message: "row 0 col 0: {~} but separated mosaics are already on",
    });
  });

  it("makes concealed cells and separated mosaics", () => {
    const cells = rowOf(page({ 0: "{?}A{/?}{~}\u2588" }), 0);
    expect(cells[0]).toMatchObject({ kind: "text", ch: "A", conceal: true });
    expect(cells[1]).toMatchObject({ kind: "mosaic", bits: 63, separated: true, conceal: false });
  });

  it("reads a space as a text space while separated mosaics are on", () => {
    const cells = rowOf(page({ 0: "{~} \u2588" }), 0);
    expect(cells[0]).toMatchObject({ kind: "text", ch: " " });
    expect(cells[1]).toMatchObject({ kind: "mosaic", bits: 63, separated: true });
  });
});

describe("characters (requirements 14.5 to 14.7)", () => {
  it("reads the mosaic code points as mosaic cells with their bits", () => {
    const cells = rowOf(page({ 0: "\u258c\u2590\u2588\u{1fb14}" }), 0);
    expect(cells.slice(0, 4).map((c) => (c.kind === "mosaic" ? c.bits : -1))).toEqual([
      21, 42, 63, 22,
    ]);
  });

  it("reports char-not-allowed for a tab, a BOM, a no-break space and an emoji", () => {
    expect(errorsOf(page({ 0: "A\tB" }))).toEqual([
      {
        code: "char-not-allowed",
        row: 0,
        col: 1,
        codePoint: 0x09,
        message: "row 0 col 1: U+0009 is not allowed",
      },
    ]);
    expect(errorsOf(`\uFEFF${page()}`)[0]).toMatchObject({
      code: "char-not-allowed",
      row: 0,
      col: 0,
      codePoint: 0xfeff,
    });
    expect(errorsOf(page({ 1: "A\u00a0B" }))[0]).toMatchObject({ codePoint: 0xa0 });
    expect(errorsOf(page({ 1: "\u{1f600}" }))[0]).toMatchObject({ codePoint: 0x1f600 });
  });
});

describe("carriage returns and line endings (requirement 13.5)", () => {
  it("reports cr on every row of a CRLF file", () => {
    const crlf = Array.from({ length: 24 }, () => "AB\r").join("\n");
    const errors = errorsOf(crlf);
    expect(errors).toHaveLength(24);
    expect(errors.every((e) => e.code === "cr")).toBe(true);
    expect(errors[0]).toMatchObject({
      row: 0,
      col: 2,
      message: "row 0 col 2: carriage return (U+000D) is not allowed; use LF line endings",
    });
  });
});

describe("row length (requirements 14.8 and 15.2)", () => {
  it("parses exactly 40 cells", () => {
    expect(rowOf(page({ 2: "A".repeat(40) }), 2)).toHaveLength(40);
  });

  it("reports 41 cells with the exact message", () => {
    expect(errorsOf(page({ 2: "A".repeat(41) }))).toEqual([
      {
        code: "row-too-long",
        row: 2,
        col: 40,
        cells: 41,
        message: "row 2 is 41 cells, limit 40",
      },
    ]);
  });

  it("counts a tag as no cell in the message, as in the example of the design", () => {
    expect(errorsOf(page({ 7: `{r}${"A".repeat(43)}` }))[0]).toMatchObject({
      code: "row-too-long",
      row: 7,
      cells: 43,
      message: "row 7 is 43 cells, limit 40",
    });
  });

  it("gives a bad tag before cell 40 precedence over the overflow", () => {
    const errors = errorsOf(page({ 3: `${"A".repeat(39)}{x}${"A".repeat(3)}` }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "tag-unknown", col: 39 });
  });

  it("does not let a CR after the overflow change the error", () => {
    expect(errorsOf(page({ 3: `${"A".repeat(41)}\r` }))[0]).toMatchObject({
      code: "row-too-long",
      cells: 41,
    });
  });
});

describe("the parsed cells (requirements 14.5 and 15.6)", () => {
  it("parses blue on black without any contrast error", () => {
    const cells = rowOf(page({ 0: "{b}x" }), 0);
    expect(cells[0]).toEqual({ kind: "text", ch: "x", fg: "blue", bg: "black", conceal: false });
    expect(errorsOf(page({ 0: "{b}x" }))).toEqual([]);
  });

  it("returns frozen cells, with BLANK_CELL for the padding", () => {
    const result = parsePage(page());
    if (!result.ok) throw new Error("the blank page should parse");
    expect(result.value[0]?.[39]).toEqual(BLANK_CELL);
    expect(Object.isFrozen(result.value[0])).toBe(true);
  });
});

describe("parseRow", () => {
  it("returns the first error by position and stops the row", () => {
    const result = parseRow("A\tB{x}", 6);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ code: "char-not-allowed", row: 6, col: 1 });
  });
});
