import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validContent } from "../grid/arbitraries.js";
import { parseContent } from "../../src/markup/parse-content.js";
import { ALWAYS_INVALID_TOKENS, joinGroups, noiseFor, rowGroups } from "./markup-arbitraries.js";

describe("content parser properties (Property 14)", () => {
  it("Property 14: an always-invalid token in a chosen row gives exactly one error for that row, at the cell index of the token", () => {
    const invalidToken = fc.constantFrom(...ALWAYS_INVALID_TOKENS);
    const insertion = fc.record({ boundary: fc.integer({ min: 0, max: 40 }), token: invalidToken });

    fc.assert(
      fc.property(
        validContent,
        fc.array(noiseFor(40), { minLength: 20, maxLength: 20 }),
        fc.array(fc.boolean(), { minLength: 20, maxLength: 20 }),
        fc.array(insertion, { minLength: 20, maxLength: 20 }),
        (content, noises, chosen, insertions) => {
          const lines = content.map((cells, i) => {
            const groups = rowGroups(cells, noises[i] ?? { repeatColour: [], togglePair: [] });
            const insert = insertions[i];
            if (!chosen[i] || insert === undefined) return joinGroups(groups);
            const withToken = [
              ...groups.slice(0, insert.boundary),
              [insert.token],
              ...groups.slice(insert.boundary),
            ];
            return joinGroups(withToken);
          });
          const text = lines.map((line) => `${line}\n`).join("");

          const result = parseContent(text);
          if (result.ok) return false;

          // Exactly one error per chosen row, at the boundary of its token, and no other row.
          const expected = new Map<number, number>();
          chosen.forEach((isChosen, i) => {
            const insert = insertions[i];
            if (isChosen && insert !== undefined) expected.set(i + 2, insert.boundary);
          });
          const actual = new Map<number, number | null>();
          for (const error of result.errors) {
            if (actual.has(error.row)) return false;
            actual.set(error.row, error.col);
          }
          if (actual.size !== expected.size) return false;
          for (const [row, col] of expected) {
            if (actual.get(row) !== col) return false;
          }
          return true;
        },
      ),
    );
  });

  it("Property 14 (sanity): the unchanged rows of the same content parse with no error", () => {
    fc.assert(
      fc.property(
        validContent,
        fc.array(noiseFor(40), { minLength: 20, maxLength: 20 }),
        (content, noises) => {
          const text = content
            .map(
              (cells, i) =>
                `${joinGroups(rowGroups(cells, noises[i] ?? { repeatColour: [], togglePair: [] }))}\n`,
            )
            .join("");
          const result = parseContent(text);
          expect(result.ok).toBe(true);
        },
      ),
    );
  });
});
