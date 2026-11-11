import { describe, expect, it } from "vitest";
import { serialiseContent } from "../../src/markup/serialise-content.js";
import { buildScreen } from "../../src/pages/build-screen.js";
import { checkCompiledPage } from "../../src/pages/check-compiled-page.js";
import { notInServicePage } from "../../src/pages/not-in-service.js";

const NOW = new Date("2026-11-11T14:05:09.000Z");

function ok(n: number) {
  const result = notInServicePage(n);
  if (!result.ok) throw new Error(`page ${String(n)}: ${result.reason}`);
  return result;
}

describe("notInServicePage (requirement 8)", () => {
  it("writes the exact markup and alt for page 123", () => {
    const { compiled } = ok(123);
    expect(serialiseContent(compiled.subpages[0].content)).toBe(
      [
        "",
        " Page 123 is not in service.",
        "",
        " Nearest pages in service:",
        "",
        " {y}120{w}  Most read on Wikipedia",
        " {y}200{w}  World weather now",
        " {y}100{w}  Index",
        "",
        " Type a page number, or use the",
        " coloured links below.",
        "",
      ].join("\n"),
    );
    expect(compiled.subpages[0].alt).toEqual([
      { kind: "paragraph", text: "Page 123 is not in service." },
      { kind: "paragraph", text: "Nearest pages in service:" },
      { kind: "link", text: "120 Most read on Wikipedia", target: { page: 120 } },
      { kind: "link", text: "200 World weather now", target: { page: 200 } },
      { kind: "link", text: "100 Index", target: { page: 100 } },
      { kind: "paragraph", text: "Type a page number, or use the coloured links below." },
    ]);
  });

  it("lists page 100 only once for page 101 (lower page is 100)", () => {
    const { compiled } = ok(101);
    expect(serialiseContent(compiled.subpages[0].content)).toBe(
      [
        "",
        " Page 101 is not in service.",
        "",
        " Nearest pages in service:",
        "",
        " {y}100{w}  Index",
        " {y}110{w}  World news",
        "",
        " Type a page number, or use the",
        " coloured links below.",
        "",
      ].join("\n"),
    );
  });

  it("lists the nearest pages for page 898", () => {
    const { compiled } = ok(898);
    expect(serialiseContent(compiled.subpages[0].content)).toBe(
      [
        "",
        " Page 898 is not in service.",
        "",
        " Nearest pages in service:",
        "",
        " {y}802{w}  Service status",
        " {y}899{w}  Engineering test page",
        " {y}100{w}  Index",
        "",
        " Type a page number, or use the",
        " coloured links below.",
        "",
      ].join("\n"),
    );
  });

  it("gives the def of the design: title, banner, static source and editor, four links (8.1, 8.2)", () => {
    const { def, compiled } = ok(123);
    expect(def.number).toBe(123);
    expect(def.title).toBe("Page not in service");
    expect(def.banner).toBe("PAGE NOT IN SERVICE");
    expect(def.source).toBe("static");
    expect(def.editor).toBe("static");
    expect(def.links).toEqual([
      { label: "Index", target: 100 },
      { label: "P120", target: 120 },
      { label: "P200", target: 200 },
      { label: "Help", target: 800 },
    ]);
    expect(compiled).toMatchObject({ number: 123, dataAt: null, editor: "static" });
    expect(compiled.subpages).toHaveLength(1);
  });

  it("builds a valid screen with a blank row 22", () => {
    const { def, compiled } = ok(123);
    expect(checkCompiledPage(def, compiled)).toEqual([]);
    const screen = buildScreen(def, compiled, 0, { now: NOW, stale: false, lastGoodAt: null });
    expect(screen.ok).toBe(true);
  });

  it("returns in-service for a page in service", () => {
    expect(notInServicePage(100)).toEqual({ ok: false, reason: "in-service" });
    expect(notInServicePage(899)).toEqual({ ok: false, reason: "in-service" });
  });

  it.each([99, 900, 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 123.5])(
    "returns out-of-range for %s",
    (n) => {
      expect(notInServicePage(n)).toEqual({ ok: false, reason: "out-of-range" });
    },
  );
});
