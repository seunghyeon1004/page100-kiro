import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileAll } from "../../src/compilers/compile-all.js";
import { mosaicBitsOf } from "../../src/grid/mosaic-code-point.js";
import { renderTxt } from "../../src/server/render-screen.js";
import { createStore } from "../../src/server/store.js";
import { pageFilesArb, snapshotArb, statusArb, time } from "../compilers/compile-arbitraries.js";

// Property 1 (server-and-viewer design.md): the text format is the grid, cell for cell.

describe("renderTxt properties", () => {
  it("Property 1: every screen the store holds renders to 24 lines of 40 code points that read back as the cells", () => {
    fc.assert(
      fc.property(snapshotArb, statusArb, time, pageFilesArb, (snapshot, status, now, files) => {
        const store = createStore({ aiEditor: false });
        for (const page of compileAll(snapshot, status, now, files).pages) {
          store.publish(page, { now, stale: false });
        }
        for (const held of store.list()) {
          for (const screen of held.screens) {
            for (const reveal of [false, true]) {
              const text = renderTxt(screen, reveal);
              const lines = text.split("\n");
              expect(lines.pop()).toBe("");
              expect(lines).toHaveLength(24);
              const wrong: string[] = [];
              lines.forEach((line, r) => {
                const points = Array.from(line);
                if (points.length !== 40)
                  wrong.push(`row ${String(r)} has ${String(points.length)}`);
                points.forEach((point, c) => {
                  const cell = screen[r]?.[c];
                  if (cell === undefined) throw new Error("no cell");
                  const ok =
                    cell.conceal && !reveal
                      ? point === " "
                      : cell.kind === "text"
                        ? point === cell.ch
                        : mosaicBitsOf(point.codePointAt(0) ?? -1) === cell.bits;
                  if (!ok) wrong.push(`row ${String(r)} col ${String(c)}`);
                });
              });
              expect(wrong).toEqual([]);
            }
          }
        }
      }),
    );
  });
});
