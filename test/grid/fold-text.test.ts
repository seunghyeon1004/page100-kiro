import { describe, expect, it } from "vitest";
import { foldText } from "../../src/grid/fold-text.js";

/** Expects a successful fold of `input` to `text`. */
function expectText(input: string, text: string): void {
  expect(foldText(input)).toEqual({ ok: true, text });
}

/** Expects a failed fold of `input` with exactly these code points. */
function expectFailure(input: string, codePoints: number[]): void {
  expect(foldText(input)).toEqual({
    ok: false,
    code: "fold-unrepresentable",
    codePoints,
  });
}

describe("foldText successes (requirements 7.3 to 7.8)", () => {
  it("returns the empty string unchanged (7.3)", () => {
    expectText("", "");
  });

  it("returns a repertoire-only string unchanged (7.4)", () => {
    expectText("Zürich: 14°C, £5, €3, café", "Zürich: 14°C, £5, €3, café");
  });

  it("applies the fixed replacements of the original six (7.5)", () => {
    expectText("‘Hi’ – “no” … 3×4", "'Hi' - \"no\" ... 3x4");
  });

  it("composes a decomposed sequence whose NFC form is in the repertoire (7.6)", () => {
    expectText("e\u0301", "é");
  });

  it("strips the marks of a letter outside the repertoire (7.7)", () => {
    expectText("Dvořák", "Dvorák");
    expectText("Şişli", "Sisli");
    expectText("ő", "o");
  });

  it("removes a combining mark that does not compose with the code point before it (7.8)", () => {
    expectText("x\u0301", "x");
  });

  it("keeps the accents of repertoire letters when other letters are stripped", () => {
    expectText("café Dvořák", "café Dvorák");
  });
});

describe("foldText fixed replacements (requirements 7.13 and 7.14)", () => {
  it("replaces every entry of the table", () => {
    const table: [string, string][] = [
      ["\u2018\u2019", "''"],
      ["\u201c\u201d", '""'],
      ["\u2013\u2014", "--"],
      ["\u2026", "..."],
      ["\u00a0", " "],
      ["\u00d7", "x"],
      ["\u0141\u0142", "Ll"],
      ["\u0110\u0111", "Dd"],
      ["\u0152\u0153", "OEoe"],
      ["\u0131", "i"],
      ["\u00ab\u00bb", '""'],
      ["\u2002\u2003\u2009\u202f", "    "],
      ["\u00ad", ""],
      ["\u2010\u2011\u2212", "---"],
      ["\u2032", "'"],
      ["\u2033", '"'],
    ];
    for (const [input, output] of table) {
      expectText(input, output);
    }
  });

  it("folds the worked examples of requirement 7.14", () => {
    expectText("Łódź", "Lódz");
    expectText("Œuvre", "OEuvre");
    expectText("1\u202f000", "1 000");
    expectText("a\u00adb", "ab");
    expectText("5\u2212 3", "5- 3");
  });
});

describe("foldText failures (requirements 7.1 and 7.9)", () => {
  it("returns no text when it fails", () => {
    const result = foldText("Ħ");
    expect(result.ok).toBe(false);
    expect("text" in result).toBe(false);
  });

  it("reports letters with no decomposition that are not in the table", () => {
    expectFailure("Ħ", [0x126]);
    expectFailure("Ŧ", [0x166]);
  });

  it("reports other scripts, symbols and control characters", () => {
    expectFailure("α", [0x3b1]);
    expectFailure("д", [0x434]);
    expectFailure("中", [0x4e2d]);
    expectFailure("÷", [0xf7]);
    expectFailure("©", [0xa9]);
    expectFailure("¶", [0xb6]);
    expectFailure("½", [0xbd]);
    expectFailure("¥", [0xa5]);
    expectFailure("a\tb", [0x9]);
    expectFailure("a\nb", [0xa]);
    expectFailure("a\rb", [0xd]);
    expectFailure("\u007f", [0x7f]);
    expectFailure("\u200b", [0x200b]);
    expectFailure("😀", [0x1f600]);
    expectFailure("\u2588", [0x2588]);
    expectFailure("\u{1fb00}", [0x1fb00]);
    expectFailure("\ue000", [0xe000]);
  });

  it("reports a lone surrogate as its code unit", () => {
    expectFailure("\uD800", [0xd800]);
  });

  it("lists each bad code point once, in order of first appearance", () => {
    expectFailure("ααβα", [0x3b1, 0x3b2]);
    expectFailure("β a α ✓ β", [0x3b2, 0x3b1, 0x2713]);
  });
});
