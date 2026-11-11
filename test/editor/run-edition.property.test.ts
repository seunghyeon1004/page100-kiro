import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AI_PAGES } from "../../src/editor/ai-pages.js";
import { createCallBudget } from "../../src/editor/call-budget.js";
import { createDraftCache } from "../../src/editor/draft-cache.js";
import { emptyEditorStatus, runEdition } from "../../src/editor/run-edition.js";
import { buildScreen } from "../../src/pages/build-screen.js";
import { checkCompiledPage } from "../../src/pages/check-compiled-page.js";
import { findPage } from "../../src/pages/registry.js";
import { snapshotArb, time } from "../compilers/compile-arbitraries.js";
import { PagedClient } from "./scripted-client.js";
import type { Step } from "./scripted-client.js";
import { stepArb } from "./editor-arbitraries.js";

// Property 8 (ai-editor design.md). Only the clients are scripted, one script per page.

describe("runEdition properties", () => {
  it("Property 8: runEdition gives 12 ordered outcomes and sound pages, and lists exactly the rules pages", async () => {
    await fc.assert(
      fc.asyncProperty(
        snapshotArb,
        time,
        fc.array(fc.array(stepArb(), { maxLength: 4 }), { minLength: 12, maxLength: 12 }),
        fc.integer({ min: 0, max: 30 }),
        async (snapshot, now, scripts, perDay) => {
          const steps = new Map<number, Step[]>(
            AI_PAGES.map((p, i) => [p.number, scripts[i] ?? []]),
          );
          const result = await runEdition(snapshot, emptyEditorStatus(), now, {
            client: new PagedClient(steps),
            budget: createCallBudget(perDay, 30),
            cache: createDraftCache(),
            log: () => undefined,
          });

          expect(result.outcomes.map((o) => o.number)).toEqual(AI_PAGES.map((p) => p.number));
          for (const page of result.pages) {
            const def = findPage(page.number);
            expect(def).toBeDefined();
            if (def === undefined) continue;
            expect(checkCompiledPage(def, page)).toEqual([]);
            page.subpages.forEach((_, subpage) => {
              for (const stale of [false, true]) {
                const screen = buildScreen(def, page, subpage, {
                  now,
                  stale,
                  lastGoodAt: page.dataAt,
                });
                expect(screen.ok, `page ${String(page.number)} subpage ${String(subpage)}`).toBe(
                  true,
                );
              }
            });
          }
          expect(result.status.fallbackPages).toEqual(
            result.pages.filter((p) => p.editor === "rules").map((p) => p.number),
          );
          const failed = result.outcomes.filter((o) => "outcome" in o).map((o) => o.number);
          expect(result.pages.map((p) => p.number)).toEqual(
            AI_PAGES.map((p) => p.number).filter((n) => !failed.includes(n)),
          );
        },
      ),
    );
  });
});
