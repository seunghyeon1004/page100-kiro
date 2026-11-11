import { describe, expect, it } from "vitest";
import { checkAltAgreement, wordsOf } from "../../src/pages/alt-agreement.js";
import type { AltBlock } from "../../src/pages/alt-block.js";
import { contentOf } from "./page-arbitraries.js";

const para = (text: string): AltBlock => ({ kind: "paragraph", text });

describe("wordsOf (requirement 9.1)", () => {
  it("splits on anything that is not a letter or digit and lower-cases", () => {
    expect(wordsOf("Hello, World 42-x")).toEqual(["hello", "world", "42", "x"]);
    expect(wordsOf("")).toEqual([]);
    expect(wordsOf("... !!")).toEqual([]);
  });
});

describe("checkAltAgreement (requirement 9.1)", () => {
  it("accepts a grid whose words are all in the alt", () => {
    expect(checkAltAgreement(contentOf("Hello world"), [para("Hello world")])).toEqual({
      ok: true,
    });
  });

  it("accepts an empty grid with any alt", () => {
    expect(checkAltAgreement(contentOf("\n\n"), [para("anything")])).toEqual({ ok: true });
  });

  it("reports a concealed word that is missing from the alt", () => {
    const content = contentOf("shown {?}secret{/?}");
    expect(checkAltAgreement(content, [para("shown")])).toEqual({ ok: false, missing: ["secret"] });
  });

  it("accepts a concealed word that the alt gives in a concealed block", () => {
    const content = contentOf("shown {?}secret{/?}");
    const alt: AltBlock[] = [
      para("shown"),
      { kind: "concealed", summary: "Answer", text: "secret" },
    ];
    expect(checkAltAgreement(content, alt)).toEqual({ ok: true });
  });

  it("treats mosaic cells as spaces", () => {
    expect(checkAltAgreement(contentOf("ab█cd"), [para("ab cd")])).toEqual({ ok: true });
    expect(checkAltAgreement(contentOf("▌▐█"), [para("")])).toEqual({ ok: true });
  });

  it("ignores case", () => {
    expect(checkAltAgreement(contentOf("HELLO"), [para("hello")])).toEqual({ ok: true });
    expect(checkAltAgreement(contentOf("hello"), [para("HELLO")])).toEqual({ ok: true });
  });

  it("matches Dvořák in the alt to Dvorák on the grid by folding", () => {
    expect(checkAltAgreement(contentOf("Dvorák"), [para("Dvořák")])).toEqual({ ok: true });
  });

  it("does not count words in a link target", () => {
    const alt: AltBlock[] = [
      { kind: "link", text: "Home", target: { url: "https://example.com/secret" } },
    ];
    expect(checkAltAgreement(contentOf("Home secret"), alt)).toEqual({
      ok: false,
      missing: ["secret"],
    });
  });

  it("counts link text, headings, list items, table headers and cells, and concealed summaries", () => {
    const alt: AltBlock[] = [
      { kind: "heading", level: 2, text: "alpha" },
      { kind: "list", ordered: false, items: ["bravo", "charlie"] },
      { kind: "table", headers: ["delta"], rows: [["echo"]] },
      { kind: "link", text: "foxtrot", target: { page: 100 } },
      { kind: "concealed", summary: "golf", text: "hotel" },
    ];
    const content = contentOf("alpha bravo charlie\ndelta echo foxtrot\ngolf hotel");
    expect(checkAltAgreement(content, alt)).toEqual({ ok: true });
  });

  it("lists each missing word once, in order of first appearance on the grid", () => {
    const content = contentOf("zulu alpha\nalpha mike zulu");
    expect(checkAltAgreement(content, [para("nothing")])).toEqual({
      ok: false,
      missing: ["zulu", "alpha", "mike"],
    });
  });

  it("does not join words across rows", () => {
    expect(checkAltAgreement(contentOf("ab\ncd"), [para("abcd")])).toEqual({
      ok: false,
      missing: ["ab", "cd"],
    });
  });
});
