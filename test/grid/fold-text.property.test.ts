import fc from "fast-check";
import { describe, it } from "vitest";
import { foldText } from "../../src/grid/fold-text.js";
import { isRepertoireCodePoint, REPERTOIRE } from "../../src/grid/repertoire.js";

// Strings biased towards the cases folding must handle: Latin letters, combining marks, fixed
// replacement characters, letters with no decomposition, and characters outside the repertoire.
const biasedChar = fc.constantFrom(
  "a",
  "Z",
  "é",
  "e",
  "\u0301",
  "\u030c",
  "ř",
  "ő",
  "ş",
  "Ł",
  "Ħ",
  "‘",
  "’",
  "“",
  "”",
  "–",
  "…",
  "\u00a0",
  "×",
  "\u00ad",
  "«",
  "\u2009",
  "α",
  "\u200b",
  "😀",
  " ",
  "{",
  "}",
);
const biasedString = fc.string({ unit: biasedChar, maxLength: 24 });

// Strings of arbitrary UTF-16 code units, which include lone surrogates.
const codeUnitString = fc.string({ unit: "binary", maxLength: 24 });

// Strings of Unicode grapheme clusters, including characters outside the Basic Multilingual Plane.
const unicodeString = fc.string({ unit: "grapheme", maxLength: 24 });

const anyString = fc.oneof(unicodeString, codeUnitString, biasedString);

const repertoireString = fc
  .array(fc.constantFrom(...REPERTOIRE), { maxLength: 40 })
  .map((codePoints) => String.fromCodePoint(...codePoints));

/** The code points of a string, in order, using the string iterator. */
function codePointsOf(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    out.push(ch.codePointAt(0) ?? -1);
  }
  return out;
}

describe("foldText properties (Properties 4, 5 and 6)", () => {
  it("Property 4: folding never throws, and its result is either repertoire text or a list of unrepresentable code points", () => {
    fc.assert(
      fc.property(anyString, (s) => {
        const result = foldText(s);
        if (result.ok) {
          return codePointsOf(result.text).every((cp) => isRepertoireCodePoint(cp));
        }
        const { codePoints } = result;
        return (
          !("text" in result) &&
          codePoints.length > 0 &&
          new Set(codePoints).size === codePoints.length &&
          codePoints.every((cp) => !isRepertoireCodePoint(cp))
        );
      }),
    );
  });

  it("Property 5: folding a successful result again returns the same text", () => {
    fc.assert(
      fc.property(anyString, (s) => {
        const first = foldText(s);
        if (!first.ok) return true;
        const second = foldText(first.text);
        return second.ok && second.text === first.text;
      }),
    );
  });

  it("Property 6: a string made only of repertoire code points folds to itself", () => {
    fc.assert(
      fc.property(repertoireString, (s) => {
        const result = foldText(s);
        return result.ok && result.text === s;
      }),
    );
  });
});
