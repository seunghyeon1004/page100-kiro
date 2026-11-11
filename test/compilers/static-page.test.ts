import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileStatic, staticAlt, staticPageNumber } from "../../src/compilers/static-page.js";
import { checkCompiledPage } from "../../src/pages/check-compiled-page.js";
import { findPage } from "../../src/pages/registry.js";
import { parseContent } from "../../src/markup/parse-content.js";

const PAGES_DIR = resolve(import.meta.dirname, "..", "..", "pages");

function contentOf(text: string) {
  const parsed = parseContent(text);
  if (!parsed.ok) throw new Error("test markup does not parse");
  return parsed.value;
}

describe("the files in pages/ (requirement 17.3)", () => {
  const files = readdirSync(PAGES_DIR)
    .filter((name) => name.endsWith(".page"))
    .sort();

  it("holds exactly the four hand-written pages", () => {
    expect(files).toEqual(["666.page", "800.page", "801.page", "899.page"]);
  });

  it("compiles every file as a static page that passes the compiled-page check", () => {
    for (const name of files) {
      const number = staticPageNumber(name);
      expect(number, name).toBeDefined();
      const result = compileStatic(number ?? 0, readFileSync(join(PAGES_DIR, name), "utf8"));
      expect(result.ok, name).toBe(true);
      if (!result.ok) continue;
      expect(result.outcome).toBe("compiled");
      expect(result.page).toMatchObject({ number, dataAt: null, editor: "static" });
      const def = findPage(number ?? 0);
      expect(def && checkCompiledPage(def, result.page)).toEqual([]);
    }
  });

  it("has real content in every file: no placeholder text and at least eight written rows", () => {
    for (const name of files) {
      const text = readFileSync(join(PAGES_DIR, name), "utf8");
      expect(text, name).not.toContain("not written yet");
      const written = text.split("\n").filter((line) => line.trim() !== "");
      expect(written.length, name).toBeGreaterThanOrEqual(8);
    }
  });

  it("names every source on page 801", () => {
    const text = readFileSync(join(PAGES_DIR, "801.page"), "utf8");
    for (const source of [
      "Wikipedia",
      "CC BY-SA 4.0",
      "Open-Meteo",
      "CC BY 4.0",
      "European Central Bank",
      "Frankfurter",
      "Hacker News",
      "USGS",
      "Launch Library 2",
      "Bedstead",
      "MIT",
    ]) {
      expect(text, source).toContain(source);
    }
  });

  it("shows all 63 mosaic patterns, joined and separated, on page 899", () => {
    const result = compileStatic(899, readFileSync(join(PAGES_DIR, "899.page"), "utf8"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cells = result.page.subpages[0].content.flat();
    for (const separated of [false, true]) {
      const seen = new Set(
        cells.flatMap((cell) =>
          cell.kind === "mosaic" && cell.separated === separated ? [cell.bits] : [],
        ),
      );
      expect(seen.size, separated ? "separated" : "joined").toBe(63);
    }
  });

  it("conceals exactly one run of text on page 666", () => {
    const result = compileStatic(666, readFileSync(join(PAGES_DIR, "666.page"), "utf8"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rowsWithConcealed = result.page.subpages[0].content.filter((row) =>
      row.some((cell) => cell.conceal),
    );
    expect(rowsWithConcealed.length).toBe(1);
  });
});

describe("staticPageNumber", () => {
  it("accepts the static pages and rejects every other name", () => {
    expect(staticPageNumber("800.page")).toBe(800);
    expect(staticPageNumber("666.page")).toBe(666);
    for (const bad of [
      "123.page",
      "100.page",
      "110.page",
      "800.txt",
      "800",
      "0800.page",
      "8.page",
      "800.page.bak",
    ]) {
      expect(staticPageNumber(bad), bad).toBeUndefined();
    }
  });
});

describe("compileStatic: errors", () => {
  it("gives markup problems at the right rows and cells", () => {
    const result = compileStatic(800, " {z}bad\n fine\n x{/?}\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => [p.code, p.row, p.col])).toEqual([
      ["markup", 2, 1],
      ["markup", 4, 2],
    ]);
  });

  it("gives a grid problem for text that fails the contrast rule", () => {
    const result = compileStatic(800, " {r}{B}dim\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => [p.code, p.row, p.col])).toEqual([
      ["grid", 2, 1],
      ["grid", 2, 2],
      ["grid", 2, 3],
    ]);
  });

  it("rejects content of more than 20 lines and of no lines", () => {
    expect(compileStatic(800, "x\n".repeat(21)).ok).toBe(false);
    expect(compileStatic(800, "").ok).toBe(false);
  });

  it("rejects a number that is not a static page", () => {
    for (const number of [123, 110, 100]) {
      const result = compileStatic(number, " ok\n");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.problems[0].code).toBe("page-check");
    }
  });
});

describe("static alt (requirement 17.2)", () => {
  it("makes one paragraph from consecutive rows and a new one after a blank row", () => {
    const alt = staticAlt(contentOf(" First  line\n second line\n\n Third\n"), "Title");
    expect(alt).toEqual([
      { kind: "paragraph", text: "First line second line" },
      { kind: "paragraph", text: "Third" },
    ]);
  });

  it("reads mosaics as spaces and falls back to the title when there is no text", () => {
    expect(staticAlt(contentOf(" a\u2588b\n"), "Title")).toEqual([
      { kind: "paragraph", text: "a b" },
    ]);
    expect(staticAlt(contentOf(" \u2588\u2588\n"), "Title")).toEqual([
      { kind: "paragraph", text: "Title" },
    ]);
  });

  it("puts concealed text in a block after the paragraph of its row", () => {
    const alt = staticAlt(contentOf(" Year: {?}1066{/?}\n next row\n\n {?}solo{/?}\n"), "Title");
    expect(alt).toEqual([
      { kind: "paragraph", text: "Year: next row" },
      { kind: "concealed", summary: "Show hidden text", text: "1066" },
      { kind: "concealed", summary: "Show hidden text", text: "solo" },
    ]);
  });

  it("gives a half-concealed word whole in the concealed block, so that the words agree", () => {
    const result = compileStatic(800, " ab{?}cd{/?} ef\n");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.page.subpages[0].alt).toEqual([
      { kind: "paragraph", text: "ab ef" },
      { kind: "concealed", summary: "Show hidden text", text: "abcd" },
    ]);
    const def = findPage(800);
    expect(def && checkCompiledPage(def, result.page)).toEqual([]);
  });
});
