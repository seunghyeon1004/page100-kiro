import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { EditorialInput } from "../../src/compilers/editorial-input.js";
import { AI_PAGES } from "../../src/editor/ai-pages.js";
import { createCallBudget } from "../../src/editor/call-budget.js";
import { canonicalInput, createDraftCache, inputKey } from "../../src/editor/draft-cache.js";
import { emptyEditorStatus, runEdition } from "../../src/editor/run-edition.js";
import { snapshotArb, time } from "../compilers/compile-arbitraries.js";
import { hostileText, stepArb } from "./editor-arbitraries.js";
import { PagedClient } from "./scripted-client.js";
import type { Step } from "./scripted-client.js";

// Property 5 (ai-editor design.md).

const slot = fc.record({
  id: fc.stringMatching(/^[a-z]+-[0-9]$/),
  mode: fc.constantFrom("headline" as const, "body" as const),
  text: hostileText,
  maxRows: fc.integer({ min: 1, max: 12 }),
  width: fc.integer({ min: 10, max: 38 }),
});

const input: fc.Arbitrary<EditorialInput> = fc.record({
  page: fc.integer({ min: 100, max: 899 }),
  totalRows: fc.integer({ min: 1, max: 20 }),
  slots: fc.array(slot, { maxLength: 4 }),
});

/** A second input: the same, a copy changed in one field, or unrelated. */
function second(a: EditorialInput): fc.Arbitrary<EditorialInput> {
  const first = a.slots[0];
  return fc.oneof(
    fc.constant(a),
    fc.constant({ ...a, slots: a.slots.map((s) => ({ ...s })) }),
    fc.constant({ ...a, page: a.page + 1 }),
    fc.constant({ ...a, totalRows: a.totalRows + 1 }),
    first === undefined
      ? fc.constant({ ...a, slots: [] })
      : fc.constant({ ...a, slots: [{ ...first, text: `${first.text}x` }, ...a.slots.slice(1)] }),
    first === undefined
      ? fc.constant(a)
      : fc.constant({ ...a, slots: [{ ...first, width: first.width + 1 }, ...a.slots.slice(1)] }),
    input,
  );
}

describe("draft cache properties", () => {
  it("Property 5: an entry is found exactly for an equal canonical input, and an unchanged page costs no call", async () => {
    fc.assert(
      fc.property(
        input.chain((a) => second(a).map((b) => [a, b] as const)),
        ([a, b]) => {
          const equal = canonicalInput(a) === canonicalInput(b);
          const cache = createDraftCache();
          cache.set(a, { kind: "accepted", rows: [["x"]] });
          expect(cache.get(b) !== undefined).toBe(equal);
          expect(inputKey(a) === inputKey(b)).toBe(equal);
        },
      ),
    );

    // A second edition on the same snapshot: no call for a page whose key was accepted or rejected.
    await fc.assert(
      fc.asyncProperty(
        snapshotArb,
        time,
        fc.array(fc.array(stepArb(), { maxLength: 4 }), { minLength: 12, maxLength: 12 }),
        async (snapshot, now, scripts) => {
          const budget = createCallBudget(10_000, 10_000);
          const cache = createDraftCache();
          const log = (): void => undefined;
          const firstSteps = new Map<number, Step[]>(
            AI_PAGES.map((p, i) => [p.number, scripts[i] ?? []]),
          );
          const first = await runEdition(snapshot, emptyEditorStatus(), now, {
            client: new PagedClient(firstSteps),
            budget,
            cache,
            log,
          });
          const kept = first.outcomes.flatMap((o) =>
            "reason" in o && ["accepted", "rejected", "refused"].includes(o.reason)
              ? [o.number]
              : [],
          );
          const again = new PagedClient(
            new Map<number, Step[]>(AI_PAGES.map((p, i) => [p.number, scripts[i] ?? []])),
          );
          await runEdition(snapshot, emptyEditorStatus(), now, {
            client: again,
            budget,
            cache,
            log,
          });
          for (const number of kept) {
            expect(
              again.calls.filter((c) => c.page === number),
              `page ${String(number)}`,
            ).toHaveLength(0);
          }
        },
      ),
    );
  });
});
