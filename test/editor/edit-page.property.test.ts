import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AI_PAGES, jobFor } from "../../src/editor/ai-pages.js";
import { createCallBudget } from "../../src/editor/call-budget.js";
import { createDraftCache } from "../../src/editor/draft-cache.js";
import { editPage } from "../../src/editor/edit-page.js";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import { snapshotArb, time } from "../compilers/compile-arbitraries.js";
import { ScriptedClient } from "./scripted-client.js";
import { stepArb } from "./editor-arbitraries.js";

// Property 2 (ai-editor design.md). The client is scripted; the draft checks, the budget, the
// cache, editPage and the page checks are real.

describe("editPage properties", () => {
  it("Property 2: editPage never throws, drafts at most 3 times, and always returns rows that publish", async () => {
    await fc.assert(
      fc.asyncProperty(
        snapshotArb,
        time,
        fc.integer({ min: 0, max: AI_PAGES.length - 1 }),
        fc.array(stepArb(), { maxLength: 5 }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 8 }),
        fc.boolean(),
        async (snapshot, now, index, steps, perDay, perBoot, stopped) => {
          const page = AI_PAGES[index];
          if (page === undefined) throw new Error("no page");
          const job = jobFor(page, snapshot, now);
          const client = new ScriptedClient(steps);
          const outcome = await editPage(
            job,
            {
              client,
              budget: createCallBudget(perDay, perBoot),
              cache: createDraftCache(),
              log: () => undefined,
            },
            now,
            stopped,
          );

          expect(client.calls.length).toBeLessThanOrEqual(3);
          if (stopped || job.input.slots.length === 0) expect(client.calls).toHaveLength(0);

          if (outcome.editor === "rules") expect(outcome.rows).toEqual(job.rules);

          const published = job.publish(outcome.rows, outcome.editor);
          if (outcome.page === null) {
            // Only when the rules draft itself does not publish.
            expect(outcome.editor).toBe("rules");
            expect(published.ok).toBe(false);
            expect(outcome.problems.length).toBeGreaterThan(0);
          } else {
            expect(published.ok).toBe(true);
            for (const subpage of outcome.page.subpages) {
              expect(validateContentRows(subpage.content).ok).toBe(true);
            }
          }
          if (outcome.editor === "ai") expect(outcome.page?.editor).toBe("ai");
        },
      ),
    );
  });
});
