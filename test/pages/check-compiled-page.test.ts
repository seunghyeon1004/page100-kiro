import { describe, expect, it } from "vitest";
import type { AltBlock } from "../../src/pages/alt-block.js";
import { checkCompiledPage } from "../../src/pages/check-compiled-page.js";
import type { CompiledPage } from "../../src/pages/compiled-page.js";
import { findPage } from "../../src/pages/registry.js";
import { blankCompiled, contentOf } from "./page-arbitraries.js";

function def(number: number) {
  const found = findPage(number);
  if (found === undefined) throw new Error(`no page ${String(number)}`);
  return found;
}

describe("checkCompiledPage (requirement 9.2)", () => {
  it("returns no problems for a sound page", () => {
    expect(checkCompiledPage(def(200), blankCompiled(200, 3))).toEqual([]);
  });

  it("reports a number that differs from the def", () => {
    expect(checkCompiledPage(def(200), blankCompiled(201, 1))).toEqual([{ code: "number" }]);
  });

  it("reports more than 9 subpages", () => {
    expect(checkCompiledPage(def(200), blankCompiled(200, 10))).toEqual([
      { code: "subpage-count", count: 10 },
    ]);
  });

  it("allows exactly 9 subpages", () => {
    expect(checkCompiledPage(def(200), blankCompiled(200, 9))).toEqual([]);
  });

  it("allows static for static pages, rules for rules pages, ai or rules for ai pages", () => {
    expect(checkCompiledPage(def(800), blankCompiled(800, 1, "static"))).toEqual([]);
    expect(checkCompiledPage(def(200), blankCompiled(200, 1, "rules"))).toEqual([]);
    expect(checkCompiledPage(def(110), blankCompiled(110, 1, "ai"))).toEqual([]);
    expect(checkCompiledPage(def(110), blankCompiled(110, 1, "rules"))).toEqual([]);
  });

  it("rejects an editor the def does not allow", () => {
    expect(checkCompiledPage(def(800), blankCompiled(800, 1, "rules"))).toEqual([
      { code: "editor", actual: "rules" },
    ]);
    expect(checkCompiledPage(def(200), blankCompiled(200, 1, "ai"))).toEqual([
      { code: "editor", actual: "ai" },
    ]);
    expect(checkCompiledPage(def(110), blankCompiled(110, 1, "static"))).toEqual([
      { code: "editor", actual: "static" },
    ]);
  });

  it("reports a table row whose length differs from its headers", () => {
    const table: AltBlock = {
      kind: "table",
      headers: ["a", "b"],
      rows: [["1", "2"], ["3"], ["4", "5", "6"]],
    };
    const compiled: CompiledPage = {
      ...blankCompiled(200, 1),
      subpages: [{ content: blankCompiled(200, 1).subpages[0].content, alt: [table] }],
    };
    expect(checkCompiledPage(def(200), compiled)).toEqual([
      { code: "table-width", subpage: 0, block: 0, row: 1 },
      { code: "table-width", subpage: 0, block: 0, row: 2 },
    ]);
  });

  it("reports a subpage whose alt misses a grid word, with its index", () => {
    const sound = blankCompiled(200, 1).subpages[0];
    const compiled: CompiledPage = {
      ...blankCompiled(200, 1),
      subpages: [
        sound,
        { content: contentOf("hello world"), alt: [{ kind: "paragraph", text: "hello" }] },
      ],
    };
    expect(checkCompiledPage(def(200), compiled)).toEqual([
      { code: "alt-missing", subpage: 1, words: ["world"] },
    ]);
  });
});
