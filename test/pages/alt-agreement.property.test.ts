import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkAltAgreement, wordsOf } from "../../src/pages/alt-agreement.js";
import type { AltBlock } from "../../src/pages/alt-block.js";
import { validContent } from "../grid/arbitraries.js";

/** One alt paragraph per content row: text cells as they are, mosaic cells as spaces. */
function altOf(content: readonly (readonly { kind: string; ch?: string }[])[]): AltBlock[] {
  return content.map((row) => ({
    kind: "paragraph",
    text: row.map((cell) => (cell.kind === "text" ? (cell.ch ?? " ") : " ")).join(""),
  }));
}

describe("alt agreement properties", () => {
  it("Property 6: an alt that mirrors the grid agrees, and removing any grid word from it fails with that word", () => {
    fc.assert(
      fc.property(validContent, fc.nat(), (content, pick) => {
        const alt = altOf(content);
        expect(checkAltAgreement(content, alt)).toEqual({ ok: true });

        const words = [
          ...new Set(alt.flatMap((b) => (b.kind === "paragraph" ? wordsOf(b.text) : []))),
        ];
        const word = words[pick % Math.max(words.length, 1)];
        if (word === undefined) return;
        const stripped: AltBlock[] = alt.map((b) =>
          b.kind === "paragraph"
            ? {
                kind: "paragraph",
                text: b.text.replace(/[\p{L}\p{N}]+/gu, (m) =>
                  m.toLowerCase() === word ? " " : m,
                ),
              }
            : b,
        );
        const result = checkAltAgreement(content, stripped);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.missing).toContain(word);
      }),
    );
  });
});
