import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createCallBudget } from "../../src/editor/call-budget.js";
import type { CallBudget } from "../../src/editor/call-budget.js";
import { createDraftCache } from "../../src/editor/draft-cache.js";
import { EditorFixture } from "../../src/editor/editor-fixture.js";
import type { DraftRequest, EditorClient } from "../../src/editor/editor-types.js";
import { FixtureEditorClient } from "../../src/editor/fixture-editor-client.js";
import { runEdition } from "../../src/editor/run-edition.js";
import type { EditionResult } from "../../src/editor/run-edition.js";
import { createRouter } from "../../src/server/router.js";
import { createScheduler, nextDelay } from "../../src/server/scheduler.js";
import type { EditionMode, EditionPolicy, EditionRunner } from "../../src/server/scheduler.js";
import { createStore } from "../../src/server/store.js";
import { SOURCE_IDS } from "../../src/sources/source-id.js";
import type { SourceId } from "../../src/sources/source-id.js";
import { NOW, PAGE_FILES, SNAPSHOT } from "../compilers/boot-snapshot.js";
import { testAssets } from "./render-fixtures.js";
import { ALWAYS_OK, FakeTime, NO_HTTP, scriptedFetchers, settle } from "./scheduler-fakes.js";
import type { Step } from "./scheduler-fakes.js";

// server-and-viewer requirements 5 and 6 on the real store, compilers and editor, with a fake
// clock, scripted fetchers and the recorded drafts of test/fixtures/editor.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const START = NOW.getTime();

const FIXTURES = readdirSync(resolve(import.meta.dirname, "..", "fixtures", "editor"))
  .filter((name) => name.endsWith(".json"))
  .map((name) =>
    EditorFixture.parse(
      JSON.parse(
        readFileSync(resolve(import.meta.dirname, "..", "fixtures", "editor", name), "utf8"),
      ),
    ),
  );

/** A budget that refuses every call, as `createApp` builds it for the reuse pass. */
function refusing(real: CallBudget): CallBudget {
  return { tryReserve: () => false, settle: () => undefined, usage: (now) => real.usage(now) };
}

interface Options {
  readonly refresh?: boolean;
  readonly editor?: EditionPolicy | null;
  readonly script?: Readonly<Record<SourceId, readonly Step[]>>;
  readonly random?: number;
  readonly bootDelayMs?: number;
  readonly minIntervalMs?: number;
  /** Replaces the spend edition, to hold one open. */
  readonly spend?: (run: () => Promise<EditionResult>, call: number) => Promise<EditionResult>;
}

function build(options: Options = {}) {
  const time = new FakeTime(START);
  const policy = options.editor === undefined ? "free" : options.editor;
  const store = createStore({ aiEditor: policy !== null });
  const { fetchers, attempts, lastGood } = scriptedFetchers(time, options.script ?? ALWAYS_OK);
  const logs: string[] = [];

  const inner = new FixtureEditorClient(FIXTURES);
  const drafts: DraftRequest[] = [];
  const client: EditorClient = {
    maxRequestsPerDraft: inner.maxRequestsPerDraft,
    draft: (request) => {
      drafts.push(request);
      return inner.draft(request);
    },
  };
  const budget = createCallBudget(60, 30);
  const cache = createDraftCache();
  const runs: { mode: EditionMode; at: number }[] = [];
  const run: EditionRunner = (snapshot, status, now, mode) => {
    runs.push({ mode, at: now.getTime() });
    const go = () =>
      runEdition(snapshot, status, now, {
        client,
        budget: mode === "spend" ? budget : refusing(budget),
        cache,
        log: (line) => {
          if (mode === "spend") logs.push(line);
        },
      });
    const spends = runs.filter((r) => r.mode === "spend").length;
    return mode === "spend" && options.spend !== undefined ? options.spend(go, spends) : go();
  };

  const scheduler = createScheduler({
    refresh: options.refresh ?? true,
    editor: policy === null ? null : { run, policy },
    editorBootDelayMs: options.bootDelayMs ?? 10 * MIN,
    editorMinIntervalMs: options.minIntervalMs ?? 3 * HOUR,
    modelCallCap: 60,
    store,
    timers: time.timers,
    clock: time.clock,
    random: () => options.random ?? 0,
    http: NO_HTTP,
    fetchers,
    snapshot: SNAPSHOT,
    pageFiles: PAGE_FILES,
    log: (line) => logs.push(line),
  });
  return { time, store, scheduler, attempts, lastGood, logs, runs, drafts };
}

/** Every source but `except` takes so long to answer that it never finishes within a test, which keeps a long run cheap. */
function quietExcept(
  except: SourceId,
  steps: readonly Step[],
): Readonly<Record<SourceId, readonly Step[]>> {
  const silent: Step = { kind: "ok", delayMs: 1000 * HOUR };
  return Object.fromEntries(
    SOURCE_IDS.map((id) => [id, id === except ? steps : [silent]]),
  ) as Record<SourceId, readonly Step[]>;
}

function spendRuns(runs: readonly { mode: EditionMode; at: number }[]): number[] {
  return runs.filter((r) => r.mode === "spend").map((r) => r.at);
}

function attemptTimes(attempts: readonly { source: SourceId; at: number }[], source: SourceId) {
  return attempts.filter((a) => a.source === source).map((a) => a.at);
}

describe("nextDelay (requirements 5.1 to 5.3)", () => {
  const at = new Date("2026-11-11T14:05:09.000Z");

  it("adds the interval and up to 10% of it to most sources, success or failure", () => {
    expect(nextDelay("hacker-news", at, { ok: true }, 0)).toBe(at.getTime() + 10 * MIN);
    expect(nextDelay("hacker-news", at, { ok: true }, 0.5)).toBe(at.getTime() + 10.5 * MIN);
    expect(nextDelay("open-meteo", at, { ok: false, retryAfterMs: null }, 0.5)).toBe(
      at.getTime() + 31.5 * MIN,
    );
    expect(nextDelay("frankfurter", at, { ok: true }, 0.99)).toBeLessThan(
      at.getTime() + 1.1 * HOUR,
    );
  });

  it("waits for Retry-After when it is longer than the interval, and not otherwise", () => {
    expect(nextDelay("usgs", at, { ok: false, retryAfterMs: HOUR }, 0)).toBe(at.getTime() + HOUR);
    expect(nextDelay("usgs", at, { ok: false, retryAfterMs: 1000 }, 0)).toBe(
      at.getTime() + 10 * MIN,
    );
  });

  it("fetches on this day at the next 00:00 UTC plus up to 300 s, and 30 minutes after a failure", () => {
    const midnight = Date.UTC(2026, 10, 12);
    expect(nextDelay("wikimedia-onthisday", at, { ok: true }, 0)).toBe(midnight);
    expect(nextDelay("wikimedia-onthisday", at, { ok: true }, 0.5)).toBe(midnight + 150_000);
    expect(nextDelay("wikimedia-onthisday", new Date(midnight), { ok: true }, 0)).toBe(
      midnight + DAY,
    );
    expect(nextDelay("wikimedia-onthisday", at, { ok: false, retryAfterMs: null }, 0.9)).toBe(
      at.getTime() + 30 * MIN,
    );
    expect(nextDelay("wikimedia-onthisday", at, { ok: false, retryAfterMs: 2 * HOUR }, 0)).toBe(
      at.getTime() + 2 * HOUR,
    );
  });

  it("keeps launch-library at least an hour apart", () => {
    expect(nextDelay("launch-library", at, { ok: true }, 0)).toBe(at.getTime() + HOUR);
    expect(nextDelay("launch-library", at, { ok: false, retryAfterMs: null }, 0)).toBe(
      at.getTime() + HOUR,
    );
    expect(nextDelay("launch-library", at, { ok: false, retryAfterMs: 1 }, 0)).toBe(
      at.getTime() + HOUR,
    );
  });
});

describe("boot (requirements 3.3, 5.7)", () => {
  it("publishes all 30 pages before anything else happens, and sets no timer without an editor", async () => {
    const { scheduler, store, time } = build({ editor: null });
    expect(store.list()).toHaveLength(0);
    expect(scheduler.boot()).toEqual({ published: 30, failed: 0 });
    expect(store.list()).toHaveLength(30);
    expect(store.list().every((p) => p.compiledAt.getTime() === START)).toBe(true);
    expect(time.sets).toBe(0);
    await scheduler.idle();
  });

  it("compiles at the snapshot time while refresh is off", () => {
    const { scheduler, store } = build({ refresh: false, editor: null });
    scheduler.boot();
    const latest = Math.max(...SOURCE_IDS.map((id) => Date.parse(SNAPSHOT.sources[id].fetchedAt)));
    expect(store.get(200)?.compiledAt.getTime()).toBe(latest);
  });

  it("makes no fetch and sets no timer while refresh is off, however long it runs", async () => {
    const { scheduler, time, attempts } = build({ refresh: false, editor: "gated" });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 3 * DAY);
    expect(attempts).toHaveLength(0);
    expect(time.sets).toBe(0);
  });
});

describe("fetching (requirements 5.1 to 5.6, 5.8)", () => {
  it("fetches every source once as soon as it starts, and publishes the affected pages", async () => {
    const { scheduler, time, attempts, store, logs } = build({ editor: null });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START);
    expect(attempts.map((a) => a.source)).toEqual([...SOURCE_IDS]);
    expect(attempts.every((a) => a.at === START)).toBe(true);
    expect(store.get(600)?.dataAt?.getTime()).toBe(START);
    expect(store.get(200)?.dataAt?.getTime()).toBe(START);
    expect(logs.filter((l) => l.startsWith("refresh usgs: ok"))).toEqual([
      "refresh usgs: ok, 2 pages published, 0 failed",
    ]);
  });

  it("repeats each source after its interval, with the jitter from random", async () => {
    const { scheduler, time, attempts } = build({ editor: null, random: 0.5 });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 2 * HOUR);
    expect(attemptTimes(attempts, "hacker-news").slice(0, 3)).toEqual([
      START,
      START + 10.5 * MIN,
      START + 21 * MIN,
    ]);
    expect(attemptTimes(attempts, "frankfurter").slice(0, 2)).toEqual([START, START + 1.05 * HOUR]);
  });

  it("refetches on this day at midnight, and every 30 minutes after a failure until it succeeds", async () => {
    const fail: Step = { kind: "fail", failure: { kind: "timeout" } };
    const { scheduler, time, attempts, store } = build({
      editor: null,
      script: quietExcept("wikimedia-onthisday", [fail, fail, { kind: "ok" }]),
    });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 2 * DAY);
    const times = attemptTimes(attempts, "wikimedia-onthisday");
    expect(times.slice(0, 5)).toEqual([
      START,
      START + 30 * MIN,
      START + 60 * MIN,
      Date.UTC(2026, 10, 12),
      Date.UTC(2026, 10, 12) + 30 * MIN,
    ]);
    expect(store.get(500)?.dataAt?.getTime()).toBeGreaterThanOrEqual(START + 60 * MIN);
  });

  it("waits for Retry-After after a 429", async () => {
    const limited: Step = {
      kind: "fail",
      failure: { kind: "rate-limited", retryAfterMs: 3 * HOUR },
    };
    const { scheduler, time, attempts } = build({
      editor: null,
      script: quietExcept("usgs", [limited, { kind: "ok" }]),
    });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 4 * HOUR);
    expect(attemptTimes(attempts, "usgs").slice(0, 2)).toEqual([START, START + 3 * HOUR]);
  });

  it("keeps launch-library an hour apart, failures included", async () => {
    const fail: Step = { kind: "fail", failure: { kind: "network" } };
    const { scheduler, time, attempts } = build({
      editor: null,
      script: quietExcept("launch-library", [fail, fail, { kind: "ok" }]),
    });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 5 * HOUR);
    const times = attemptTimes(attempts, "launch-library");
    expect(times.length).toBeGreaterThanOrEqual(5);
    times.slice(1).forEach((t, i) => {
      expect(t - (times[i] ?? 0)).toBeGreaterThanOrEqual(HOUR);
    });
  });

  it("keeps the entry and the pages on a failure, and logs the source, kind, URL, status and issue paths", async () => {
    const script = {
      ...ALWAYS_OK,
      usgs: [{ kind: "fail", failure: { kind: "status", status: 503 } }],
      frankfurter: [
        { kind: "fail", failure: { kind: "schema", issuePaths: ["rates.EUR", "date"] } },
      ],
      "hacker-news": [{ kind: "fail", failure: { kind: "timeout" } }],
      "open-meteo": [{ kind: "throw" }],
    } satisfies Record<SourceId, readonly Step[]>;
    const { scheduler, time, store, logs } = build({ editor: null, script });
    scheduler.boot();
    const before = store.get(600);
    scheduler.start();
    await time.runUntil(START);
    expect(store.get(600)).toBe(before);
    expect(logs).toContain("refresh usgs: failed, status, https://example.test/usgs, status 503");
    expect(logs).toContain(
      "refresh frankfurter: failed, schema, https://example.test/frankfurter, issues rates.EUR,date",
    );
    expect(logs).toContain(
      "refresh hacker-news: failed, timeout, https://example.test/hacker-news",
    );
    expect(logs).toContain("refresh open-meteo: failed, threw");
    expect(logs.join("\n")).not.toMatch(/<html|\{"/);
  });

  it("has at most one fetch in flight per source, even when a fetch outlasts its interval", async () => {
    const slow: Step = { kind: "ok", delayMs: 25 * MIN };
    const { scheduler, time, attempts } = build({
      editor: null,
      script: { ...ALWAYS_OK, "hacker-news": [slow] },
    });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 2 * HOUR);
    const times = attemptTimes(attempts, "hacker-news");
    times.slice(1).forEach((t, i) => {
      expect(t - (times[i] ?? 0)).toBeGreaterThanOrEqual(25 * MIN);
    });
  });
});

describe("staleness (requirement 5.6)", () => {
  it("republishes a source's pages as stale 2 intervals + 1 ms after the last good fetch, and a success clears it", async () => {
    const fail: Step = { kind: "fail", failure: { kind: "network" } };
    const ok: Step = { kind: "ok" };
    const script = {
      ...ALWAYS_OK,
      usgs: [ok, ...Array<Step>(5).fill(fail), ok],
    };
    const { scheduler, time, store } = build({ editor: null, script });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 19 * MIN);
    expect(store.get(600)?.stale).toBe(false);
    await time.runUntil(START + 20 * MIN);
    expect(store.get(600)?.stale).toBe(false);
    await time.runUntil(START + 20 * MIN + 1);
    expect(store.get(600)?.stale).toBe(true);
    expect(store.get(600)?.dataAt?.getTime()).toBe(START);
    // Pages of other sources are untouched.
    expect(store.get(300)?.stale).toBe(false);
    // The seventh attempt succeeds, after 6 x 10 minutes.
    await time.runUntil(START + 61 * MIN);
    expect(store.get(600)?.stale).toBe(false);
    expect(store.get(600)?.dataAt?.getTime()).toBeGreaterThan(START + 59 * MIN);
  });
});

describe("the edition (requirements 6.1 to 6.9)", () => {
  it("runs at boot with recorded drafts when the policy is free, and publishes the AI pages and page 802", async () => {
    const { scheduler, store, runs, logs } = build({ editor: "free" });
    scheduler.boot();
    expect(store.get(110)?.editor).toBe("rules");
    await scheduler.idle();
    expect(spendRuns(runs)).toHaveLength(1);
    for (const n of [110, 111, 112, 113, 114, 115, 500, 501, 700]) {
      expect(store.get(n)?.editor, `page ${String(n)}`).toBe("ai");
    }
    expect(store.get(116)?.editor).toBe("rules");
    expect(store.editorStatus()?.accepted).toBeGreaterThan(0);
    expect(logs.some((l) => /^edition: 12 pages published, 0 dropped, 0 failed$/.test(l))).toBe(
      true,
    );
    const status = store.get(802)?.alts[0];
    expect(JSON.stringify(status)).toContain("AI editor: on");
  });

  it("keeps the AI pages after a refresh and makes no model call to do it (6.8)", async () => {
    const { scheduler, time, store, drafts } = build({
      editor: "free",
      script: quietExcept("wikimedia-feed", [{ kind: "ok" }]),
    });
    scheduler.boot();
    await scheduler.idle();
    const callsAfterEdition = drafts.length;
    expect(callsAfterEdition).toBeGreaterThan(0);
    scheduler.start();
    await time.runUntil(START + 2 * HOUR);
    expect(store.get(110)?.editor).toBe("ai");
    expect(store.get(500)?.editor).toBe("ai");
    expect(store.get(110)?.dataAt?.getTime()).toBeGreaterThan(START);
    expect(drafts).toHaveLength(callsAfterEdition);
  });

  it("holds the first gated edition back until the boot delay, then spends once (6.6)", async () => {
    const { scheduler, time, runs, store } = build({ editor: "gated" });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 10 * MIN - 1);
    expect(spendRuns(runs)).toEqual([]);
    expect(store.get(110)?.editor).toBe("rules");
    await time.runUntil(START + 10 * MIN);
    expect(spendRuns(runs)).toEqual([START + 10 * MIN]);
    expect(store.get(110)?.editor).toBe("ai");
  });

  it("starts later gated editions at least the minimum interval apart, once per interval (6.6, 6.7)", async () => {
    const { scheduler, time, runs } = build({
      editor: "gated",
      script: quietExcept("wikimedia-feed", [{ kind: "ok" }]),
    });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 12 * HOUR);
    const starts = spendRuns(runs);
    expect(starts[0]).toBe(START + 10 * MIN);
    expect(starts.length).toBeGreaterThanOrEqual(3);
    starts.slice(1).forEach((t, i) => {
      expect(t - (starts[i] ?? 0)).toBeGreaterThanOrEqual(3 * HOUR);
    });
    // One edition per interval, not one per refresh: the feed refreshes every 30 minutes.
    expect(starts.length).toBeLessThanOrEqual(5);
  });

  it("spends nothing when the process sleeps before the boot delay (6.6)", async () => {
    const { scheduler, time, runs, drafts } = build({ editor: "gated" });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 9 * MIN);
    scheduler.stop();
    expect(time.pendingCount()).toBe(0);
    await time.runUntil(START + DAY);
    expect(spendRuns(runs)).toEqual([]);
    expect(drafts).toHaveLength(0);
  });

  it("never runs a gated edition while refresh is off (6.9)", async () => {
    const { scheduler, time, runs } = build({ editor: "gated", refresh: false });
    scheduler.boot();
    await time.runUntil(START + DAY);
    expect(spendRuns(runs)).toEqual([]);
  });

  it("runs a free edition at boot even while refresh is off (6.9)", async () => {
    const { scheduler, store, runs } = build({ editor: "free", refresh: false });
    scheduler.boot();
    await scheduler.idle();
    expect(spendRuns(runs)).toHaveLength(1);
    expect(store.get(110)?.editor).toBe("ai");
  });

  it("starts nothing without an editor", async () => {
    const { scheduler, time, runs, store } = build({ editor: null });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START + 2 * HOUR);
    expect(runs).toEqual([]);
    expect(store.get(110)?.editor).toBe("rules");
    expect(JSON.stringify(store.get(802)?.alts[0])).toContain("AI editor: off");
  });

  it("runs one more edition, not two, after triggers that arrive during one (6.2)", async () => {
    const held: (() => void)[] = [];
    const { scheduler, time, runs } = build({
      editor: "free",
      spend: (go) =>
        new Promise((resolve, reject) => {
          held.push(() => {
            go().then(resolve, reject);
          });
        }),
    });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START);
    // Both Wikipedia fetches have succeeded while edition 1 is open.
    expect(spendRuns(runs)).toHaveLength(1);
    held.shift()?.();
    await settle();
    expect(spendRuns(runs)).toHaveLength(2);
    held.shift()?.();
    await settle();
    expect(spendRuns(runs)).toHaveLength(2);
    expect(held).toHaveLength(0);
  });

  it("drops the pages of a source that was refreshed during the edition, and publishes the rest (6.3)", async () => {
    const held: (() => void)[] = [];
    const { scheduler, time, store, logs } = build({
      editor: "free",
      script: {
        ...ALWAYS_OK,
        "wikimedia-onthisday": [{ kind: "fail", failure: { kind: "timeout" } }],
      },
      spend: (go) =>
        new Promise((resolve, reject) => {
          held.push(() => {
            go().then(resolve, reject);
          });
        }),
    });
    scheduler.boot();
    scheduler.start();
    await time.runUntil(START);
    held.shift()?.();
    await settle();
    expect(logs).toContain("edition: 2 pages published, 10 dropped, 0 failed");
    expect(store.get(500)?.editor).toBe("ai");
    // 6.3a: the refreshed feed text is the same, so the dropped pages come back from the cache.
    expect(logs.some((line) => /dropped pages published from cached drafts/.test(line))).toBe(true);
    expect(store.get(110)?.editor).toBe("ai");
  });
});

describe("visitors (requirement 7.1)", () => {
  it("cause no fetch and no edition in 1,000 requests", async () => {
    const { scheduler, store, attempts, runs, time } = build({ editor: "gated" });
    scheduler.boot();
    const router = createRouter({ store, assets: testAssets(), clock: time.clock });
    const urls = ["/", "/201", "/201?s=3", "/550.txt", "/123", "/nope", "/api/status", "/go?p=300"];
    for (let i = 0; i < 1000; i++) {
      router({ method: "GET", url: urls[i % urls.length] ?? "/", headers: {} });
    }
    await scheduler.idle();
    expect(attempts).toHaveLength(0);
    expect(runs).toEqual([]);
  });
});
