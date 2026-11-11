import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Cell } from "../../src/grid/types.js";
import type { CompiledPage } from "../../src/pages/compiled-page.js";
import { findPage } from "../../src/pages/registry.js";
import { stampClock } from "../../src/pages/stamp-clock.js";
import { renderAnsi, renderTxt } from "../../src/server/render-screen.js";
import { renderFrag, renderHtml } from "../../src/server/render-html.js";
import { renderJson } from "../../src/server/render-json.js";
import { framePage } from "../../src/server/store.js";
import type { PublishedPage } from "../../src/server/store.js";
import { pageView } from "../../src/server/views.js";
import { NOW } from "../compilers/boot-snapshot.js";
import { COMPILED, URLS } from "./render-fixtures.js";

// Property 6 (server-and-viewer design.md): two versions share an ETag exactly when no format,
// subpage or reveal value can tell them apart at the same request clock.

type Change =
  | { readonly kind: "none" }
  | { readonly kind: "cell"; readonly row: number; readonly col: number; readonly cell: Cell }
  | { readonly kind: "stale" }
  | { readonly kind: "editor" }
  | { readonly kind: "dataAt"; readonly offset: number }
  | { readonly kind: "alt"; readonly word: string };

const COLOURS = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

const changeArb: fc.Arbitrary<Change> = fc.oneof(
  fc.constant<Change>({ kind: "none" }),
  fc.record({
    kind: fc.constant("cell" as const),
    row: fc.integer({ min: 0, max: 19 }),
    col: fc.integer({ min: 0, max: 39 }),
    cell: fc.oneof(
      fc.record({
        kind: fc.constant("text" as const),
        ch: fc.constant(" "),
        fg: fc.constantFrom(...COLOURS),
        bg: fc.constantFrom(...COLOURS),
        conceal: fc.boolean(),
      }),
      fc.record({
        kind: fc.constant("mosaic" as const),
        bits: fc.integer({ min: 1, max: 63 }),
        separated: fc.boolean(),
        fg: fc.constantFrom(...COLOURS),
        bg: fc.constantFrom(...COLOURS),
        conceal: fc.boolean(),
      }),
    ),
  }),
  fc.constant<Change>({ kind: "stale" }),
  fc.constant<Change>({ kind: "editor" }),
  fc
    .integer({ min: -3_000_000, max: 3_000_000 })
    .map<Change>((offset) => ({ kind: "dataAt", offset })),
  fc.constantFrom("extra", "word", "moon").map<Change>((word) => ({ kind: "alt", word })),
);

function changed(
  compiled: CompiledPage,
  change: Change,
): { compiled: CompiledPage; stale: boolean } {
  const [first, ...rest] = compiled.subpages;
  switch (change.kind) {
    case "none":
      return { compiled, stale: false };
    case "stale":
      return { compiled, stale: true };
    case "editor":
      return {
        compiled: { ...compiled, editor: compiled.editor === "ai" ? "rules" : "ai" },
        stale: false,
      };
    case "dataAt": {
      const base = compiled.dataAt ?? NOW;
      return {
        compiled: { ...compiled, dataAt: new Date(base.getTime() + change.offset) },
        stale: false,
      };
    }
    case "alt":
      return {
        compiled: {
          ...compiled,
          subpages: [
            { ...first, alt: [...first.alt, { kind: "paragraph", text: change.word }] },
            ...rest,
          ],
        },
        stale: false,
      };
    case "cell": {
      const rows = first.content.map((row) => [...row]);
      const row = rows[change.row];
      if (row === undefined) throw new Error("no row");
      row[change.col] = change.cell;
      return {
        compiled: {
          ...compiled,
          subpages: [{ ...first, content: rows as unknown as typeof first.content }, ...rest],
        },
        stale: false,
      };
    }
  }
}

function framed(compiled: CompiledPage, stale: boolean, now: Date): PublishedPage | undefined {
  const def = findPage(compiled.number);
  if (def === undefined) return undefined;
  const outcome = framePage(def, compiled, { now, stale });
  return outcome.ok ? outcome.page : undefined;
}

/** Every format, subpage and reveal value, at one request clock, as one string. */
function bodiesOf(page: PublishedPage, clock: Date): string {
  const parts: string[] = [];
  page.screens.forEach((screen, subpage) => {
    for (const reveal of [false, true]) {
      const view = pageView(page, subpage, clock, reveal);
      parts.push(renderHtml(view, URLS), renderFrag(view), renderJson(view));
      // The router stamps the request clock before it draws the text formats.
      const stamped = stampClock(screen, clock);
      parts.push(renderTxt(stamped, reveal), renderAnsi(stamped, reveal));
    }
  });
  return parts.join("\u0000");
}

describe("page ETag properties", () => {
  it("Property 6: two versions of a page have the same ETag exactly when every format renders to equal bodies at the same clock", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...COMPILED.map((p) => p.number)),
        changeArb,
        fc.integer({ min: 1, max: 5_000_000 }),
        (number, change, later) => {
          const original = COMPILED.find((p) => p.number === number);
          if (original === undefined) throw new Error("no page");
          const p = framed(original, false, NOW);
          if (p === undefined) throw new Error("original did not frame");
          const edit = changed(structuredClone(original), change);
          const q = framed(edit.compiled, edit.stale, new Date(NOW.getTime() + later));
          if (q === undefined) return; // an edit the gate rejects is never held, so it has no ETag
          const clock = new Date(NOW.getTime() + 123_000);
          expect(p.etag === q.etag).toBe(bodiesOf(p, clock) === bodiesOf(q, clock));
        },
      ),
    );
  });
});
