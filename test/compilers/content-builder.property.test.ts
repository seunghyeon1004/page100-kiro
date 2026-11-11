import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createContentBuilder } from "../../src/compilers/content-builder.js";
import { COLOURS } from "../../src/grid/colours.js";
import type { Colour } from "../../src/grid/types.js";
import { LEGIBLE_PAIRS } from "../grid/arbitraries.js";

// Property 11 (design.md). The oracle below is written independently of the builder: it tracks
// occupied cells, the repertoire as a list of ranges, the legible pairs from the hand-written list
// in test/grid/arbitraries.ts, and the words of the grid and of the alternative.

interface Op {
  readonly row: number;
  readonly col: number;
  readonly text: string;
  readonly fg: Colour;
  readonly bg: Colour;
  readonly alt: boolean;
}

const CHARS = Array.from("abc XYZ 019-€é£°×\t\u2603😀{}");
const op: fc.Arbitrary<Op> = fc.record({
  row: fc.integer({ min: -2, max: 21 }),
  col: fc.integer({ min: -2, max: 42 }),
  text: fc.array(fc.constantFrom(...CHARS), { maxLength: 14 }).map((cs) => cs.join("")),
  fg: fc.constantFrom(...COLOURS),
  bg: fc.constantFrom(...COLOURS),
  alt: fc.boolean(),
});
const wild = fc.array(op, { maxLength: 12 });
// Mostly sound sequences (one write per band of rows, legible colours, an alternative for each), so
// that the success branch is exercised as well as the failures.
const SAFE = Array.from("abc XYZ019-");
const tame: fc.Arbitrary<Op[]> = fc
  .array(
    fc.record({
      band: fc.integer({ min: 0, max: 4 }),
      row: fc.integer({ min: 0, max: 3 }),
      col: fc.integer({ min: 0, max: 25 }),
      text: fc.array(fc.constantFrom(...SAFE), { maxLength: 12 }).map((cs) => cs.join("")),
      pair: fc.constantFrom(...LEGIBLE_PAIRS),
    }),
    { maxLength: 5 },
  )
  .map((list) =>
    list.map((o, i): Op => ({
      row: i * 4 + o.row,
      col: o.col,
      text: o.text,
      fg: o.pair[0],
      bg: o.pair[1],
      alt: true,
    })),
  );
const ops = fc.oneof(wild, tame);

function inRepertoire(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? -1;
  return (
    (cp >= 0x20 && cp <= 0x7e) ||
    cp === 0xa3 ||
    cp === 0xb0 ||
    cp === 0x20ac ||
    (cp >= 0xc0 && cp <= 0xff && cp !== 0xd7 && cp !== 0xf7)
  );
}

function legible(fg: Colour, bg: Colour): boolean {
  return LEGIBLE_PAIRS.some(([f, b]) => f === fg && b === bg);
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

describe("content builder properties", () => {
  it("Property 11: build succeeds exactly when the oracle finds no problem, and written cells are where they were written", () => {
    fc.assert(
      fc.property(ops, (list) => {
        const b = createContentBuilder();
        const occupied = new Map<string, { ch: string; fg: Colour; bg: Colour }>();
        const rows: string[][] = Array.from({ length: 20 }, () =>
          Array.from({ length: 40 }, () => " "),
        );
        const altTexts: string[] = [];
        let problem = false;

        for (const o of list) {
          b.text(o.row, o.col, o.text, { fg: o.fg, bg: o.bg });
          if (o.alt) {
            b.alt({ kind: "paragraph", text: o.text });
            altTexts.push(o.text);
          }
          const chars = Array.from(o.text);
          if (chars.length === 0) continue;
          const inside = o.row >= 0 && o.row < 20 && o.col >= 0 && o.col + chars.length <= 40;
          if (!inside) {
            problem = true;
            continue;
          }
          const bad =
            chars.some((ch) => !inRepertoire(ch)) ||
            chars.some((_, i) => occupied.has(`${String(o.row)},${String(o.col + i)}`));
          if (bad) {
            problem = true;
            continue;
          }
          chars.forEach((ch, i) => {
            occupied.set(`${String(o.row)},${String(o.col + i)}`, { ch, fg: o.fg, bg: o.bg });
            const line = rows[o.row];
            if (line !== undefined) line[o.col + i] = ch;
            if (ch !== " " && !legible(o.fg, o.bg)) problem = true;
          });
        }

        if (altTexts.length === 0) problem = true;
        const altWords = new Set(altTexts.flatMap(wordsOf));
        for (const line of rows) {
          if (wordsOf(line.join("")).some((w) => !altWords.has(w))) problem = true;
        }

        const built = b.build();
        expect(built.ok).toBe(!problem);
        if (!built.ok) {
          for (const p of built.problems) {
            expect(p.message.length).toBeGreaterThan(0);
            expect(p.subpage).toBeNull();
          }
          return;
        }
        built.subpage.content.forEach((line, r) => {
          expect(line).toHaveLength(40);
          line.forEach((cell, c) => {
            const written = occupied.get(`${String(r)},${String(c)}`);
            if (written === undefined) {
              expect(cell).toEqual({
                kind: "text",
                ch: " ",
                fg: "white",
                bg: "black",
                conceal: false,
              });
            } else {
              expect(cell).toEqual({
                kind: "text",
                ch: written.ch,
                fg: written.fg,
                bg: written.bg,
                conceal: false,
              });
            }
          });
        });
      }),
      { numRuns: 300 },
    );
  });
});
