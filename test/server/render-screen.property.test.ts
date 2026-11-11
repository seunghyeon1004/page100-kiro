import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { COLOUR_LETTER } from "../../src/grid/colours.js";
import { mosaicCodePoint } from "../../src/grid/mosaic-code-point.js";
import { renderScreenHtml, renderTxt } from "../../src/server/render-screen.js";
import { validGrid } from "../grid/arbitraries.js";

// Property 2 (server-and-viewer design.md): the HTML runs say what the grid says.

function unescape(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

/** One code point read back: U+1CE51 + b - 1 is the separated mosaic b. */
function readBack(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp >= 0x1ce51 && cp <= 0x1ce8f) {
    return String.fromCodePoint(mosaicCodePoint(cp - 0x1ce51 + 1) ?? 0x20);
  }
  return ch;
}

describe("renderScreenHtml properties", () => {
  it("Property 2: the spans of each row, read back, equal the text line, and their classes equal the cells' attributes", () => {
    fc.assert(
      fc.property(validGrid, (grid) => {
        const html = renderScreenHtml(grid);
        expect(html.startsWith('<div class="screen" aria-hidden="true">')).toBe(true);
        const rows = [...html.matchAll(/<div class="r">(.*?)<\/div>/g)];
        expect(rows).toHaveLength(24);
        const lines = renderTxt(grid, true).split("\n");
        rows.forEach((row, r) => {
          const spans = [...(row[1] ?? "").matchAll(/<span(?: class="([^"]*)")?>(.*?)<\/span>/g)];
          const gridRow = grid[r];
          if (gridRow === undefined) throw new Error("no row");
          let col = 0;
          let text = "";
          for (const span of spans) {
            const classes = (span[1] ?? "").split(" ").filter((c) => c !== "");
            const chars = Array.from(unescape(span[2] ?? ""));
            expect(chars.length).toBeGreaterThan(0);
            for (const ch of chars) {
              const cell = gridRow[col];
              if (cell === undefined) throw new Error("more characters than cells");
              const expected = [
                ...(cell.fg === "white" ? [] : [`f${COLOUR_LETTER[cell.fg]}`]),
                ...(cell.bg === "black" ? [] : [`b${COLOUR_LETTER[cell.bg]}`]),
                ...(cell.conceal ? ["conceal"] : []),
              ];
              const plain = classes.filter((c) => c !== "pn" && c !== "ck" && c !== "si");
              expect(plain).toEqual(expected);
              text += readBack(ch);
              col += 1;
            }
          }
          expect(col).toBe(40);
          expect(text).toBe(lines[r]);
        });
      }),
    );
  });
});
