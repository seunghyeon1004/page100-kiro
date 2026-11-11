import { describe, expect, it } from "vitest";
import { compileAll } from "../../src/compilers/compile-all.js";
import { emptyEditorStatus } from "../../src/editor/run-edition.js";
import type { CompiledPage } from "../../src/pages/compiled-page.js";
import { findPage } from "../../src/pages/registry.js";
import { createStore, framePage } from "../../src/server/store.js";
import { NOW, PAGE_FILES, SNAPSHOT, STATUS } from "../compilers/boot-snapshot.js";

// server-and-viewer requirement 4, on pages the real compilers produce from the boot snapshot.

const PAGES: readonly CompiledPage[] = compileAll(SNAPSHOT, STATUS, NOW, PAGE_FILES).pages;

function pageNumbered(n: number): CompiledPage {
  const page = PAGES.find((p) => p.number === n);
  if (page === undefined) throw new Error(`no compiled page ${String(n)}`);
  return page;
}

const FRAME = { now: NOW, stale: false } as const;

describe("store.publish (requirements 4.1 to 4.3)", () => {
  it("accepts every compiled page of the boot snapshot", () => {
    const store = createStore({ aiEditor: false });
    expect(PAGES).toHaveLength(30);
    for (const page of PAGES) {
      const outcome = store.publish(page, FRAME);
      expect(outcome.ok, `page ${String(page.number)}`).toBe(true);
    }
    expect(store.list().map((p) => p.number)).toEqual(PAGES.map((p) => p.number));
  });

  it("holds one screen per subpage, with the frame's compile time and the data time", () => {
    const store = createStore({ aiEditor: false });
    const compiled = pageNumbered(201);
    const outcome = store.publish(compiled, FRAME);
    if (!outcome.ok) throw new Error("expected a page");
    expect(outcome.page.screens).toHaveLength(compiled.subpages.length);
    expect(outcome.page.alts).toHaveLength(compiled.subpages.length);
    expect(outcome.page.compiledAt).toEqual(NOW);
    expect(outcome.page.dataAt).toEqual(compiled.dataAt);
    expect(outcome.page.def).toBe(findPage(201));
    expect(store.get(201)).toBe(outcome.page);
  });

  it("freezes the page deeply and shares nothing with the input (4.1)", () => {
    const store = createStore({ aiEditor: false });
    const compiled = pageNumbered(300);
    const outcome = store.publish(compiled, FRAME);
    if (!outcome.ok) throw new Error("expected a page");
    const page = outcome.page;
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page.screens)).toBe(true);
    expect(Object.isFrozen(page.screens[0])).toBe(true);
    expect(Object.isFrozen(page.screens[0][5])).toBe(true);
    expect(Object.isFrozen(page.screens[0][5]?.[0])).toBe(true);
    expect(Object.isFrozen(page.alts[0])).toBe(true);
    expect(page.alts[0]).not.toBe(compiled.subpages[0].alt);
    expect(page.alts[0]).toEqual(compiled.subpages[0].alt);
    expect(page.dataAt).not.toBe(compiled.dataAt);
  });

  it("rejects a page with no registry entry, counts it, and holds nothing (4.2)", () => {
    const store = createStore({ aiEditor: false });
    const outcome = store.publish({ ...pageNumbered(100), number: 123 }, FRAME);
    expect(outcome).toEqual({ ok: false, codes: ["unknown-page"] });
    expect(store.get(123)).toBeUndefined();
    expect(store.failures(123)).toBe(1);
  });

  it("rejects an editor the registry does not allow, with the check's code", () => {
    const store = createStore({ aiEditor: false });
    const outcome = store.publish({ ...pageNumbered(100), editor: "ai" }, FRAME);
    expect(outcome).toEqual({ ok: false, codes: ["editor"] });
  });

  it("rejects an invalid time", () => {
    const store = createStore({ aiEditor: false });
    const outcome = store.publish(pageNumbered(100), {
      now: new Date(Number.NaN),
      stale: false,
    });
    expect(outcome).toEqual({ ok: false, codes: ["time-invalid"] });
  });

  it("keeps the same object after a rejected publish and adds 1 to the failure count (4.3)", () => {
    const store = createStore({ aiEditor: false });
    const first = store.publish(pageNumbered(100), FRAME);
    if (!first.ok) throw new Error("expected a page");
    const bad = store.publish(pageNumbered(100), { now: new Date(Number.NaN), stale: false });
    expect(bad.ok).toBe(false);
    expect(store.get(100)).toBe(first.page);
    expect(store.failures(100)).toBe(1);
    expect(store.failures(200)).toBe(0);
  });

  it("replaces the page after an accepted publish", () => {
    const store = createStore({ aiEditor: false });
    store.publish(pageNumbered(100), FRAME);
    const later = store.publish(pageNumbered(100), {
      now: new Date(NOW.getTime() + 5000),
      stale: true,
    });
    if (!later.ok) throw new Error("expected a page");
    expect(store.get(100)).toBe(later.page);
    expect(later.page.stale).toBe(true);
  });

  it("starts empty and remembers the editor status as a copy", () => {
    const store = createStore({ aiEditor: true });
    expect(store.list()).toEqual([]);
    expect(store.editorStatus()).toBeNull();
    expect(store.aiEditor()).toBe(true);
    const status = emptyEditorStatus();
    store.setEditorStatus(status);
    expect(store.editorStatus()).toEqual(status);
    expect(store.editorStatus()).not.toBe(status);
  });
});

describe("page ETags (requirement 4.4)", () => {
  function etagOf(compiled: CompiledPage, now: Date, stale = false): string {
    const def = findPage(compiled.number);
    if (def === undefined) throw new Error("no def");
    const outcome = framePage(def, compiled, { now, stale });
    if (!outcome.ok) throw new Error("expected a page");
    return outcome.page.etag;
  }

  it("is 20 hex digits", () => {
    expect(etagOf(pageNumbered(100), NOW)).toMatch(/^[0-9a-f]{20}$/);
  });

  it("does not change with the compile time, which only moves the clock cells", () => {
    expect(etagOf(pageNumbered(200), NOW)).toBe(
      etagOf(pageNumbered(200), new Date(NOW.getTime() + 123_000)),
    );
  });

  it("changes with staleness, the editor and the alt text", () => {
    const base = etagOf(pageNumbered(300), NOW);
    expect(etagOf(pageNumbered(300), NOW, true)).not.toBe(base);
    const compiled = pageNumbered(300);
    const [first] = compiled.subpages;
    const edited: CompiledPage = {
      ...compiled,
      subpages: [
        { ...first, alt: [...first.alt, { kind: "paragraph", text: "Rates" }] },
        ...compiled.subpages.slice(1),
      ],
    };
    expect(etagOf(edited, NOW)).not.toBe(base);
  });
});
