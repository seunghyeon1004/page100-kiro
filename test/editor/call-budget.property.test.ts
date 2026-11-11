import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AI_PAGES } from "../../src/editor/ai-pages.js";
import { AnthropicEditorClient } from "../../src/editor/anthropic-editor-client.js";
import { createCallBudget } from "../../src/editor/call-budget.js";
import { createDraftCache } from "../../src/editor/draft-cache.js";
import { emptyEditorStatus, runEdition } from "../../src/editor/run-edition.js";
import { snapshotArb } from "../compilers/compile-arbitraries.js";
import { SNAPSHOT } from "../compilers/boot-snapshot.js";
import { stepArb } from "./editor-arbitraries.js";
import { errorReply, fakeFetch, rowsReply } from "./fake-fetch.js";
import type { Reply } from "./fake-fetch.js";
import { PagedClient } from "./scripted-client.js";
import type { Step } from "./scripted-client.js";

// Property 3 (ai-editor design.md). Calls are counted where they are made: by the scripted
// client's own reports, and by the fetch invocations under the real SDK client. The budget, the
// cache, editPage and runEdition are real.

const HOUR = 3_600_000;
const START = Date.UTC(2026, 10, 11, 12);

/** Edition times that never go back: each step is 0 to 40 hours, so UTC days change. */
const times = fc
  .array(fc.integer({ min: 0, max: 40 }), { minLength: 1, maxLength: 10 })
  .map((steps) => {
    let at = START;
    return steps.map((hours) => new Date((at += hours * HOUR)));
  });

const caps = fc.tuple(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 40 }));

function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Checks per-day sums and the total against the caps. */
function expectWithinCaps(
  perDay: number,
  perBoot: number,
  calls: readonly { day: string; n: number }[],
) {
  const byDay = new Map<string, number>();
  let total = 0;
  for (const { day, n } of calls) {
    byDay.set(day, (byDay.get(day) ?? 0) + n);
    total += n;
  }
  for (const [day, n] of byDay) expect(n, `calls on ${day}`).toBeLessThanOrEqual(perDay);
  expect(total).toBeLessThanOrEqual(perBoot);
}

describe("call budget properties", () => {
  it("Property 3: calls per UTC day stay within the daily cap and all calls within the boot cap, for scripted clients and for the SDK under 500 and 529", async () => {
    // Scripted clients: hostile snapshots, arbitrary scripts per edition and page.
    await fc.assert(
      fc.asyncProperty(
        snapshotArb,
        times,
        caps,
        fc.array(
          fc.array(fc.array(stepArb(), { maxLength: 3 }), { minLength: 12, maxLength: 12 }),
          {
            minLength: 10,
            maxLength: 10,
          },
        ),
        async (snapshot, editions, [perDay, perBoot], scripts) => {
          const budget = createCallBudget(perDay, perBoot);
          const cache = createDraftCache();
          const made: { day: string; n: number }[] = [];
          for (const [i, now] of editions.entries()) {
            const steps = new Map<number, Step[]>(
              AI_PAGES.map((p, k) => [p.number, scripts[i]?.[k] ?? []]),
            );
            const client = new PagedClient(steps);
            const result = await runEdition(snapshot, emptyEditorStatus(), now, {
              client,
              budget,
              cache,
              log: () => undefined,
            });
            made.push({ day: dayOf(now), n: client.made });
            expect(result.status.callsToday).toBeLessThanOrEqual(perDay);
            expect(result.status.callsThisBoot).toBeLessThanOrEqual(perBoot);
          }
          expectWithinCaps(perDay, perBoot, made);
        },
      ),
    );

    // The real SDK client over a fake fetch that answers 500 or 529 before it succeeds.
    const kinds = fc.array(fc.constantFrom<"500" | "529" | "ok">("500", "529", "ok"), {
      minLength: 1,
      maxLength: 20,
    });
    await fc.assert(
      fc.asyncProperty(times, caps, kinds, async (editions, [perDay, perBoot], pattern) => {
        const replies: Reply[] = Array.from({ length: 120 }, (_, i): Reply => {
          const kind = pattern[i % pattern.length];
          if (kind === "500") return errorReply(500);
          if (kind === "529") return errorReply(529);
          return rowsReply(["x"]);
        });
        const fake = fakeFetch(replies);
        const client = new AnthropicEditorClient({
          apiKey: "sk-ant-test",
          model: "test-model",
          fetch: fake.fetch,
        });
        const budget = createCallBudget(perDay, perBoot);
        const cache = createDraftCache();
        const made: { day: string; n: number }[] = [];
        for (const now of editions) {
          const before = fake.calls.length;
          await runEdition(SNAPSHOT, emptyEditorStatus(), now, {
            client,
            budget,
            cache,
            log: () => undefined,
          });
          made.push({ day: dayOf(now), n: fake.calls.length - before });
        }
        expectWithinCaps(perDay, perBoot, made);
      }),
    );
  }, 120_000);
});
