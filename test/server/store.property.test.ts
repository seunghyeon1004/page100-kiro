import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileAll } from "../../src/compilers/compile-all.js";
import type { ValidContent } from "../../src/grid/types.js";
import { validateGrid } from "../../src/grid/validate-grid.js";
import type { CompiledPage, Subpage } from "../../src/pages/compiled-page.js";
import { createStore } from "../../src/server/store.js";
import type { PublishedPage } from "../../src/server/store.js";
import { NOW, PAGE_FILES, SNAPSHOT, STATUS } from "../compilers/boot-snapshot.js";

// Property 4 (server-and-viewer design.md): the store holds only valid pages and keeps the last
// accepted one when a publish is rejected.

const PAGES: readonly CompiledPage[] = compileAll(SNAPSHOT, STATUS, NOW, PAGE_FILES).pages;

type Kind =
  | "valid"
  | "valid-stale"
  | "unknown-number"
  | "bits-zero"
  | "bad-colour"
  | "illegible"
  | "alt-missing"
  | "ten-subpages"
  | "invalid-now";

const KINDS: readonly Kind[] = [
  "valid",
  "valid-stale",
  "unknown-number",
  "bits-zero",
  "bad-colour",
  "illegible",
  "alt-missing",
  "ten-subpages",
  "invalid-now",
];

/** The content with one cell replaced by a value the validator must reject, cast through `unknown`. */
function withBadCell(content: ValidContent, cell: unknown): ValidContent {
  const rows: unknown[][] = content.map((row) => [...row]);
  const target = rows[7];
  if (target === undefined) throw new Error("no row");
  target[3] = cell;
  return rows as unknown as ValidContent;
}

function withFirstSubpage(page: CompiledPage, change: (s: Subpage) => Subpage): CompiledPage {
  const [first, ...rest] = page.subpages;
  return { ...page, subpages: [change(first), ...rest] };
}

interface Call {
  readonly compiled: CompiledPage;
  readonly now: Date;
  readonly stale: boolean;
  readonly valid: boolean;
}

function callOf(page: CompiledPage, kind: Kind, now: Date): Call {
  const base = { now, stale: false };
  switch (kind) {
    case "valid":
      return { compiled: page, ...base, valid: true };
    case "valid-stale":
      return { compiled: page, now, stale: true, valid: true };
    case "unknown-number":
      return { compiled: { ...page, number: 123 }, ...base, valid: false };
    case "bits-zero":
      return {
        compiled: withFirstSubpage(page, (s) => ({
          ...s,
          content: withBadCell(s.content, {
            kind: "mosaic",
            bits: 0,
            separated: false,
            fg: "white",
            bg: "black",
            conceal: false,
          }),
        })),
        ...base,
        valid: false,
      };
    case "bad-colour":
      return {
        compiled: withFirstSubpage(page, (s) => ({
          ...s,
          content: withBadCell(s.content, {
            kind: "text",
            ch: "x",
            fg: "pink",
            bg: "black",
            conceal: false,
          }),
        })),
        ...base,
        valid: false,
      };
    case "illegible":
      return {
        compiled: withFirstSubpage(page, (s) => ({
          ...s,
          content: withBadCell(s.content, {
            kind: "text",
            ch: "x",
            fg: "red",
            bg: "green",
            conceal: false,
          }),
        })),
        ...base,
        valid: false,
      };
    case "alt-missing":
      return {
        compiled: withFirstSubpage(page, (s) => ({
          ...s,
          alt: [{ kind: "paragraph", text: "zzz" }],
        })),
        ...base,
        valid: false,
      };
    case "ten-subpages": {
      const [first] = page.subpages;
      return {
        compiled: { ...page, subpages: Array.from({ length: 10 }, () => first) as never },
        ...base,
        valid: false,
      };
    }
    case "invalid-now":
      return { compiled: page, now: new Date(Number.NaN), stale: false, valid: false };
  }
}

const callArb = fc
  .tuple(
    fc.integer({ min: 0, max: PAGES.length - 1 }),
    fc.constantFrom(...KINDS),
    fc.integer({ min: 0, max: 3 * 86_400_000 }),
  )
  .map(([index, kind, offset]) => {
    const page = PAGES[index];
    if (page === undefined) throw new Error("no page");
    // A private copy: the property mutates what it publishes.
    return callOf(structuredClone(page), kind, new Date(NOW.getTime() + offset));
  });

describe("store properties", () => {
  it("Property 4: only valid pages are held, a rejected publish keeps the last accepted page, held pages are copies", () => {
    fc.assert(
      fc.property(fc.array(callArb, { minLength: 1, maxLength: 40 }), (calls) => {
        const store = createStore({ aiEditor: false });
        const lastAccepted = new Map<number, PublishedPage>();
        const rejected = new Map<number, number>();

        for (const call of calls) {
          const number = call.compiled.number;
          const before = store.get(number);
          const outcome = store.publish(call.compiled, { now: call.now, stale: call.stale });
          expect(outcome.ok, `kind valid=${String(call.valid)} page ${String(number)}`).toBe(
            call.valid,
          );
          if (outcome.ok) {
            lastAccepted.set(number, outcome.page);
          } else {
            rejected.set(number, (rejected.get(number) ?? 0) + 1);
            expect(store.get(number)).toBe(before);
          }

          // Mutating the input afterwards changes nothing held.
          const held = store.get(number);
          const heldJson = JSON.stringify(held);
          for (const subpage of call.compiled.subpages) {
            (subpage.alt as unknown as unknown[]).length = 0;
          }
          expect(JSON.stringify(store.get(number))).toBe(heldJson);

          for (const page of store.list()) {
            for (const screen of page.screens) {
              expect(validateGrid(screen).ok).toBe(true);
            }
            expect(page.screens.length).toBeLessThanOrEqual(9);
            expect(store.get(page.number)).toBe(lastAccepted.get(page.number));
          }
        }
        for (const [number, count] of rejected) expect(store.failures(number)).toBe(count);
        expect(store.list()).toHaveLength(lastAccepted.size);
      }),
    );
  });
});
