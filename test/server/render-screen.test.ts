import { describe, expect, it } from "vitest";
import { compileAll } from "../../src/compilers/compile-all.js";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import type { Cell } from "../../src/grid/types.js";
import { validateGrid } from "../../src/grid/validate-grid.js";
import { escapeHtml } from "../../src/server/escape-html.js";
import {
  htmlCodePoint,
  renderAnsi,
  renderScreenHtml,
  renderTxt,
  screenRuns,
} from "../../src/server/render-screen.js";
import { createStore } from "../../src/server/store.js";
import { NOW, PAGE_FILES, SNAPSHOT, STATUS } from "../compilers/boot-snapshot.js";

// server-and-viewer 9.3, 9.4, 11.1, 11.2 and 9.6 (escaping), on real screens.

function screenOf(number: number, subpage = 0) {
  const store = createStore({ aiEditor: false });
  for (const page of compileAll(SNAPSHOT, STATUS, NOW, PAGE_FILES).pages) {
    store.publish(page, { now: NOW, stale: false });
  }
  const screen = store.get(number)?.screens[subpage];
  if (screen === undefined) throw new Error("no screen");
  return screen;
}

function gridWith(cells: Record<string, Cell>) {
  const rows: Cell[][] = Array.from({ length: 24 }, () =>
    Array.from({ length: 40 }, () => BLANK_CELL),
  );
  for (const [key, cell] of Object.entries(cells)) {
    const [r, c] = key.split(",").map(Number);
    const row = rows[r ?? 0];
    if (row !== undefined) row[c ?? 0] = cell;
  }
  const checked = validateGrid(rows);
  if (!checked.ok) throw new Error("grid did not validate");
  return checked.page;
}

describe("escapeHtml", () => {
  it("escapes the five characters and nothing else", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
    expect(escapeHtml("plain £ é")).toBe("plain £ é");
  });
});

describe("renderTxt", () => {
  it("gives 24 LF-ended lines of 40 code points for a real page", () => {
    const text = renderTxt(screenOf(550), true);
    const lines = text.split("\n");
    expect(lines.pop()).toBe("");
    expect(lines).toHaveLength(24);
    for (const line of lines) expect(Array.from(line)).toHaveLength(40);
  });

  it("hides concealed cells unless revealed", () => {
    const concealed: Cell = { kind: "text", ch: "X", fg: "white", bg: "black", conceal: true };
    const grid = gridWith({ "5,0": concealed });
    expect(renderTxt(grid, false).split("\n")[5]?.startsWith(" ")).toBe(true);
    expect(renderTxt(grid, true).split("\n")[5]?.startsWith("X")).toBe(true);
  });

  it("writes mosaics, separated or not, with mosaicCodePoint", () => {
    const grid = gridWith({
      "3,0": { kind: "mosaic", bits: 22, separated: false, fg: "red", bg: "black", conceal: false },
      "3,1": { kind: "mosaic", bits: 22, separated: true, fg: "red", bg: "black", conceal: false },
      "3,2": { kind: "mosaic", bits: 63, separated: false, fg: "red", bg: "black", conceal: false },
    });
    expect(Array.from(renderTxt(grid, true).split("\n")[3] ?? "").slice(0, 3)).toEqual([
      "\u{1fb14}",
      "\u{1fb14}",
      "\u2588",
    ]);
  });
});

describe("renderScreenHtml", () => {
  it("writes the separated form of pattern b as U+1CE51 + b - 1", () => {
    const cell: Cell = {
      kind: "mosaic",
      bits: 22,
      separated: true,
      fg: "red",
      bg: "black",
      conceal: false,
    };
    expect(htmlCodePoint(cell).codePointAt(0)).toBe(0x1ce51 + 21);
    expect(htmlCodePoint({ ...cell, separated: false }).codePointAt(0)).toBe(0x1fb14);
  });

  it("splits row 0 into page number, middle and clock, and row 1 at the indicator", () => {
    const screen = screenOf(201);
    const row0 = screenRuns(screen[0] ?? [], 0).map((run) => [run.start, run.role]);
    expect(row0).toEqual([
      [0, "pn"],
      [4, null],
      [5, null],
      [13, null],
      [21, "ck"],
    ]);
    const row1 = screenRuns(screen[1] ?? [], 1);
    expect(row1.at(-1)).toMatchObject({ start: 35, role: "si" });
    expect(row1.at(-2)?.role).toBeNull();
  });

  it("has no style attribute, no script and no unescaped text", () => {
    const html = renderScreenHtml(screenOf(100));
    expect(html).not.toMatch(/style=|<script|on\w+=/);
    expect(html.match(/<div class="r">/g)).toHaveLength(24);
  });

  it("puts classes only where a cell differs from white on black", () => {
    const cell: Cell = { kind: "text", ch: "x", fg: "red", bg: "black", conceal: true };
    const html = renderScreenHtml(gridWith({ "4,2": cell }));
    expect(html).toContain('<span class="fr conceal">x</span>');
  });
});

describe("renderAnsi", () => {
  it("sets the exact RGB of each colour and resets at each line's end", () => {
    const cell: Cell = { kind: "text", ch: "x", fg: "yellow", bg: "blue", conceal: false };
    const ansi = renderAnsi(gridWith({ "2,0": cell }), true);
    expect(ansi.split("\n")[2]).toContain("\u001b[38;2;255;255;0m\u001b[48;2;0;0;255mx");
    expect(ansi.split("\n")[0]?.endsWith("\u001b[0m")).toBe(true);
  });
});
