import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { NUMBER_WORDS } from "../../src/compilers/fit-text.js";
import { checkNumericFidelity, numberTokensOf } from "../../src/editor/numeric-fidelity.js";
import { inputTexts } from "./editor-arbitraries.js";

// Property 4 (ai-editor design.md).

function wordsOf(texts: readonly string[]): string[] {
  return texts.flatMap((t) => t.split(" ").filter((w) => w !== ""));
}

const picks = fc.array(fc.nat(), { minLength: 1, maxLength: 40 });

describe("numeric fidelity properties", () => {
  it("Property 4: a draft of input words has no violation, and one added number or number word gives exactly one naming it", () => {
    fc.assert(
      fc.property(
        inputTexts,
        picks,
        fc.integer({ min: 0, max: 10_000_000 }),
        (texts, indexes, n) => {
          const pool = wordsOf(texts);
          const draft = indexes.map((i) => pool[i % pool.length] ?? "").join(" ");
          expect(checkNumericFidelity(texts, [draft])).toEqual([]);

          const known = new Set(texts.flatMap(numberTokensOf));
          const absent = String(n + 1_000_000_000);
          fc.pre(!known.has(absent));
          expect(checkNumericFidelity(texts, [`${draft} ${absent}`])).toEqual([
            `number "${absent}" not in input`,
          ]);

          const inputWords = new Set(
            texts.flatMap((t) => t.toLowerCase().match(/[a-zà-ÿ]+/g) ?? []),
          );
          const missing = NUMBER_WORDS.filter((w) => !inputWords.has(w));
          const word = missing[n % Math.max(missing.length, 1)];
          if (word !== undefined) {
            expect(checkNumericFidelity(texts, [`${draft} ${word}`])).toEqual([
              `number word "${word}" not in input`,
            ]);
          }
        },
      ),
    );
  });
});
