import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { renderAnsi, renderTxt } from "../../src/server/render-screen.js";
import { validGrid } from "../grid/arbitraries.js";

// Property 7 (server-and-viewer design.md): ANSI is the text format plus colour codes.

const ESCAPES = /\u001b\[[0-9;]*m/g;

describe("renderAnsi properties", () => {
  it("Property 7: without its colour codes the ANSI output is the text output, and each line has one reset, at its end", () => {
    fc.assert(
      fc.property(validGrid, fc.boolean(), (grid, reveal) => {
        const ansi = renderAnsi(grid, reveal);
        expect(ansi.replace(ESCAPES, "")).toBe(renderTxt(grid, reveal));
        const lines = ansi.split("\n");
        expect(lines.pop()).toBe("");
        expect(lines).toHaveLength(24);
        for (const line of lines) {
          expect(line.endsWith("\u001b[0m")).toBe(true);
          expect(line.split("\u001b[0m")).toHaveLength(2);
        }
      }),
    );
  });
});
