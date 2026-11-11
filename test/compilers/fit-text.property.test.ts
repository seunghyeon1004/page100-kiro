import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  NUMBER_WORDS,
  UNIT_WORDS,
  fitBody,
  fitHeadline,
  wrapWords,
} from "../../src/compilers/fit-text.js";
import type { FitResult } from "../../src/compilers/fit-text.js";

// Property 4 (design.md). Words are built from letters and digits, joined by single inner hyphens;
// none starts or ends with a hyphen or contains two full stops in a row, so a row that ends in a
// hyphen is always a split inside a word.

const segment = fc.stringMatching(/^[A-Za-z0-9]{1,12}$/);
const hyphenated = fc
  .array(segment, { minLength: 1, maxLength: 3 })
  .map((segments) => segments.join("-"));
const plainWord = fc.oneof(
  hyphenated,
  fc.constantFrom(
    "km",
    "km/h",
    "mm",
    "per",
    "cent",
    "percent",
    "one",
    "two",
    "twenty",
    "dozen",
    "million",
    "40",
    "2",
    "3,500",
    "U.S.",
    "Mr.",
    "J.",
    "the",
    "A",
    "An",
    "The",
  ),
);
const word = fc.oneof(
  { weight: 5, arbitrary: plainWord },
  { weight: 1, arbitrary: hyphenated.map((w) => `${w}.`) },
  { weight: 1, arbitrary: hyphenated.map((w) => `${w}?`) },
  { weight: 1, arbitrary: hyphenated.map((w) => `${w},`) },
);
const words = fc.array(word, { minLength: 0, maxLength: 40 });
const spaces = fc.constantFrom(" ", "  ", "   ");

const text = fc
  .tuple(words, fc.array(spaces, { minLength: 41, maxLength: 41 }), spaces, spaces)
  .map(
    ([ws, gaps, lead, trail]) =>
      `${lead}${ws.map((w, i) => w + (gaps[i] ?? " ")).join("")}${trail}`,
  );

const widths = fc.integer({ min: 1, max: 40 });
const rowLimits = fc.integer({ min: 1, max: 20 });

function len(s: string): number {
  return Array.from(s).length;
}

/** The parts of a word: after every inner hyphen, each part keeping its hyphen. */
function parts(w: string): string[] {
  return w.split("-").map((p, i, all) => (i < all.length - 1 ? `${p}-` : p));
}

function inputWords(t: string): string[] {
  return t.split(" ").filter((w) => w !== "");
}

/** Rows back to words: a row ending in a hyphen continues in the next row without a space. */
function rejoin(rows: readonly string[]): string[] {
  let joined = "";
  rows.forEach((row, i) => {
    joined += row;
    if (i < rows.length - 1 && !row.endsWith("-")) joined += " ";
  });
  return joined.split(" ");
}

function checkRows(result: FitResult, width: number, maxRows: number): void {
  if (!result.ok) return;
  expect(result.rows.length).toBeGreaterThanOrEqual(1);
  expect(result.rows.length).toBeLessThanOrEqual(maxRows);
  for (const row of result.rows) {
    expect(len(row)).toBeLessThanOrEqual(width);
    expect(row.startsWith(" ")).toBe(false);
    expect(row.endsWith(" ")).toBe(false);
    expect(row).not.toBe("");
    expect(row.includes("  ")).toBe(false);
  }
}

function anyPartWider(ws: readonly string[], width: number): boolean {
  return ws.some((w) => parts(w).some((p) => len(p) > width));
}

describe("fit-text properties", () => {
  it("Property 4: rows obey the width rules, words are a prefix of the input, only fitBody adds an ellipsis after a non-number, and word-too-long is exact", () => {
    fc.assert(
      fc.property(text, widths, rowLimits, (t, width, maxRows) => {
        const ws = inputWords(t);

        // wrapWords: all words, nothing changed.
        const wrapped = wrapWords(t, width, maxRows);
        checkRows(wrapped, width, maxRows);
        if (ws.length === 0) expect(wrapped).toEqual({ ok: false, reason: "empty" });
        else if (anyPartWider(ws, width))
          expect(wrapped).toEqual({ ok: false, reason: "word-too-long" });
        else if (wrapped.ok) {
          expect(rejoin(wrapped.rows)).toEqual(ws);
          expect(wrapped.rows.join("")).not.toContain("...");
        } else expect(wrapped.reason).toBe("too-long");

        // fitHeadline: the words after requirement 3.5; the first letter is upper case.
        let expected = [...ws];
        if (expected[0] === "A" || expected[0] === "An" || expected[0] === "The")
          expected = expected.slice(1);
        const lastWord = expected[expected.length - 1];
        if (lastWord?.endsWith("."))
          expected = [...expected.slice(0, -1), lastWord.slice(0, -1)].filter((w) => w !== "");
        const headline = fitHeadline(t, width, maxRows);
        checkRows(headline, width, maxRows);
        if (expected.length === 0) expect(headline).toEqual({ ok: false, reason: "empty" });
        else if (anyPartWider(expected, width))
          expect(headline).toEqual({ ok: false, reason: "word-too-long" });
        else if (headline.ok) {
          const got = rejoin(headline.rows);
          expect(got.map((w) => w.toLowerCase())).toEqual(expected.map((w) => w.toLowerCase()));
          expect(headline.rows.join("")).not.toContain("...");
        } else expect(headline.reason).toBe("too-long");

        // fitBody: whole words, or a prefix with "..." after a word that is no number or unit.
        const body = fitBody(t, width, maxRows);
        checkRows(body, width, maxRows);
        if (ws.length === 0) expect(body).toEqual({ ok: false, reason: "empty" });
        else if (body.ok) {
          const got = rejoin(body.rows);
          const last = got[got.length - 1] ?? "";
          if (last.endsWith("...")) {
            const stem = last.slice(0, -3);
            const k = got.length;
            expect(got.slice(0, -1)).toEqual(ws.slice(0, k - 1));
            expect((ws[k - 1] ?? "").startsWith(stem)).toBe(true);
            expect(stem).not.toBe("");
            expect(stem).not.toMatch(/\d/);
            const bare = stem.toLowerCase();
            expect(UNIT_WORDS).not.toContain(bare);
            expect(NUMBER_WORDS).not.toContain(bare);
          } else {
            expect(got).toEqual(ws.slice(0, got.length));
          }
        } else if (body.reason === "word-too-long") {
          expect(anyPartWider(ws, width)).toBe(true);
        }
      }),
    );
  });
});
