import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createScheduler, nextDelay } from "../../src/server/scheduler.js";
import type { AttemptOutcome } from "../../src/server/scheduler.js";
import { createStore } from "../../src/server/store.js";
import { findPage } from "../../src/pages/registry.js";
import { isStale } from "../../src/sources/schedule.js";
import { SOURCE_IDS } from "../../src/sources/source-id.js";
import { NOW, PAGE_FILES, SNAPSHOT } from "../compilers/boot-snapshot.js";
import { COMPILED } from "./render-fixtures.js";
import { FakeTime, NO_HTTP, recordingStore, scriptedFetchers } from "./scheduler-fakes.js";
import type { Step } from "./scheduler-fakes.js";

// Property 8 (server-and-viewer design.md): three simulated days of scripted fetches on a fake
// clock. The real scheduler and the real store run; the compile step is the only stand-in (it
// returns the boot pages), because the property is about when things happen, and compiling 30
// pages on each of about 1,300 events would take minutes.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const START = NOW.getTime();

/** The "random" number the scheduler sees: a fixed function of the clock, so the test can recompute it. */
function randomAt(ms: number): number {
  return ((Math.floor(ms / 1000) * 7919) % 1009) / 1009;
}

const delayMs = fc.oneof(
  { weight: 4, arbitrary: fc.constant(0) },
  { weight: 2, arbitrary: fc.integer({ min: 1, max: 2 * HOUR }) },
);

const failure = fc.oneof(
  fc.constantFrom(
    { kind: "network" } as const,
    { kind: "timeout" } as const,
    { kind: "too-large" } as const,
    { kind: "not-json" } as const,
  ),
  fc.integer({ min: 400, max: 599 }).map((status) => ({ kind: "status", status }) as const),
  fc
    .oneof(fc.constant(null), fc.integer({ min: 0, max: 6 * HOUR }))
    .map((retryAfterMs) => ({ kind: "rate-limited", retryAfterMs }) as const),
  fc.constant({ kind: "schema", issuePaths: ["a.b"] } as const),
);

const step: fc.Arbitrary<Step> = fc.oneof(
  { weight: 4, arbitrary: delayMs.map((d): Step => ({ kind: "ok", delayMs: d })) },
  {
    weight: 3,
    arbitrary: fc
      .tuple(failure, delayMs)
      .map(([f, d]): Step => ({ kind: "fail", failure: f, delayMs: d })),
  },
  { weight: 1, arbitrary: delayMs.map((d): Step => ({ kind: "throw", delayMs: d })) },
);

const steps = fc.array(step, { minLength: 1, maxLength: 8 });

const scriptArb = fc.record({
  "wikimedia-feed": steps,
  "wikimedia-onthisday": steps,
  "open-meteo": steps,
  frankfurter: steps,
  "hacker-news": steps,
  usgs: steps,
  "launch-library": steps,
});

function outcomeOf(step: Step): AttemptOutcome {
  if (step.kind === "ok") return { ok: true };
  if (step.kind === "fail" && step.failure.kind === "rate-limited") {
    return { ok: false, retryAfterMs: step.failure.retryAfterMs };
  }
  return { ok: false, retryAfterMs: null };
}

describe("scheduler properties", () => {
  it("Property 8: attempts follow nextDelay, launch-library is an hour apart, no source is fetched twice at once, published pages carry isStale, and refresh off does nothing", async () => {
    await fc.assert(
      fc.asyncProperty(scriptArb, fc.boolean(), async (script, refresh) => {
        const time = new FakeTime(START);
        const { fetchers, attempts, maxInFlight, lastGood } = scriptedFetchers(time, script);
        // At each publish, note the `fetchedAt` that the source's last good fetch gave.
        const { store, publishes } = recordingStore(createStore({ aiEditor: false }), (number) => {
          const source = findPage(number)?.source;
          return source === undefined || source === "static" || source === "computed"
            ? undefined
            : lastGood.get(source);
        });
        const scheduler = createScheduler({
          refresh,
          editor: null,
          editorBootDelayMs: 0,
          editorMinIntervalMs: 0,
          modelCallCap: 60,
          store,
          timers: time.timers,
          clock: time.clock,
          random: () => randomAt(time.now),
          http: NO_HTTP,
          fetchers,
          snapshot: SNAPSHOT,
          pageFiles: PAGE_FILES,
          compile: () => ({ pages: COMPILED, outcomes: [] }),
          log: () => undefined,
        });

        scheduler.boot();
        scheduler.start();
        await time.runUntil(START + 3 * DAY);
        scheduler.stop();

        if (!refresh) {
          expect(attempts).toHaveLength(0);
          expect(time.sets).toBe(0);
        }

        for (const source of SOURCE_IDS) {
          expect(maxInFlight.get(source) ?? 0).toBeLessThanOrEqual(1);
          const mine = attempts.filter((a) => a.source === source);
          if (refresh) expect(mine[0]?.at).toBe(START);
          mine.slice(1).forEach((next, i) => {
            const previous = mine[i];
            if (previous === undefined) throw new Error("no previous attempt");
            const completed = previous.at + (previous.step.delayMs ?? 0);
            const wanted = nextDelay(
              source,
              new Date(previous.at),
              outcomeOf(previous.step),
              randomAt(completed),
            );
            expect(next.at, `${source} attempt ${String(i + 1)}`).toBe(
              completed + Math.ceil(Math.max(wanted - completed, 0)),
            );
            if (source === "launch-library") {
              expect(next.at - previous.at).toBeGreaterThanOrEqual(HOUR);
            }
          });
        }

        for (const record of publishes) {
          const source = findPage(record.number)?.source;
          if (source === undefined || source === "static" || source === "computed") {
            expect(record.stale).toBe(false);
            continue;
          }
          const good = record.probed ?? "";
          expect(record.stale, `page ${String(record.number)} at ${String(record.now)}`).toBe(
            isStale(source, new Date(good), new Date(record.now)),
          );
        }
      }),
      { numRuns: 15 },
    );
  }, 600_000);
});
