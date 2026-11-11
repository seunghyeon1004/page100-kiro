import fc from "fast-check";
import { describe, it } from "vitest";
import { MARKUP_ERROR_CODES, type MarkupError } from "../../src/markup/markup-error.js";
import { parseContent } from "../../src/markup/parse-content.js";
import { parsePage } from "../../src/markup/parse-page.js";

// Pieces of markup, valid and invalid, that random text is built from.
const MARKUP_PIECES = [
  "{r}",
  "{K}",
  "{?}",
  "{/?}",
  "{~}",
  "{/~}",
  "{{",
  "}",
  "{x}",
  "{}",
  "{rg}",
  "{",
  "{w}",
  "A",
  " ",
  "é",
  "\u2588",
  "\u258c",
  "\u{1fb14}",
  "\r",
  "\n",
  "\t",
  "\u{1f600}",
  "\uD800",
  "\uFEFF",
  "\u00a0",
] as const;

const piece = fc.constantFrom(...MARKUP_PIECES);

/** Text built from markup pieces, with extra line feeds so that the line counts vary. */
const markupText = fc
  .array(fc.oneof({ weight: 4, arbitrary: piece }, { weight: 1, arbitrary: fc.constant("\n") }), {
    maxLength: 400,
  })
  .map((pieces) => pieces.join(""));

/** Arbitrary text of any kind, including lone surrogates and every line count. */
const anyText = fc.oneof(
  markupText,
  fc.string({ unit: "binary", maxLength: 80 }),
  fc.string({ unit: "grapheme", maxLength: 80 }),
  fc
    .array(fc.oneof(markupText, fc.constant("\n")), { maxLength: 30 })
    .map((lines) => lines.join("\n")),
);

/** Checks the shape of parser errors (requirements 13.1, 13.3, 13.4, 15.1 to 15.4). */
function errorsWellFormed(errors: readonly MarkupError[], lowestRow: number, highestRow: number) {
  if (errors.length === 0) return false;
  const codes: readonly string[] = MARKUP_ERROR_CODES;
  const rows = errors.map((e) => e.row);
  return (
    errors.every(
      (e) =>
        codes.includes(e.code) &&
        e.message.length > 0 &&
        Number.isInteger(e.row) &&
        e.row >= lowestRow &&
        e.row <= highestRow &&
        (e.col === null || (Number.isInteger(e.col) && e.col >= 0)),
    ) &&
    new Set(rows).size === rows.length &&
    errors.filter((e) => e.code === "row-count").length <= 1 &&
    rows.every((row, i) => i === 0 || (rows[i - 1] ?? -1) <= row)
  );
}

describe("markup parser properties (Property 13)", () => {
  it("Property 13: parsePage and parseContent never throw, and every result is well formed", () => {
    fc.assert(
      fc.property(anyText, (text) => {
        const page = parsePage(text);
        const pageOk = page.ok
          ? page.value.length === 24 && page.value.every((row) => row.length === 40)
          : errorsWellFormed(page.errors, 0, 24);

        const content = parseContent(text);
        const contentOk = content.ok
          ? content.value.length === 20 && content.value.every((row) => row.length === 40)
          : errorsWellFormed(content.errors, 2, 22);

        return pageOk && contentOk;
      }),
    );
  });
});
