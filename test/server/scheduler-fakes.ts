import type { FETCHERS } from "../../src/sources/fetchers.js";
import type { HttpClient } from "../../src/sources/http.js";
import type { FetchOutcome, SourceFailure } from "../../src/sources/outcome.js";
import type { SourceId } from "../../src/sources/source-id.js";
import type { Timers } from "../../src/server/timers.js";
import type { Store } from "../../src/server/store.js";
import type { CompiledPage } from "../../src/pages/compiled-page.js";
import { SNAPSHOT } from "../compilers/boot-snapshot.js";

// Fakes for the scheduler tests: a clock that only moves when a test says so, fake timers that
// fire in order, scripted fetchers, and a recording view of the real store.

/** Lets every promise chain that is not waiting on a fake timer run to its end. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}

export class FakeTime {
  now: number;
  /** How many timers have ever been set. */
  sets = 0;
  private readonly pending = new Map<number, { readonly at: number; readonly fn: () => void }>();
  private nextId = 1;

  constructor(start: number) {
    this.now = start;
  }

  readonly timers: Timers = {
    set: (ms, fn) => {
      const id = this.nextId++;
      this.sets += 1;
      // Whole milliseconds, rounded up, so a fractional delay cannot make the clock fractional.
      this.pending.set(id, { at: this.now + Math.ceil(Math.max(ms, 0)), fn });
      return id;
    },
    clear: (id) => {
      this.pending.delete(id);
    },
  };

  readonly clock = (): Date => new Date(this.now);

  pendingCount(): number {
    return this.pending.size;
  }

  /** The times of the timers that have not fired, ascending. */
  pendingTimes(): number[] {
    return [...this.pending.values()].map((t) => t.at).sort((a, b) => a - b);
  }

  /** Fires every timer due by `end` in time order, letting the work each starts settle, then sets the clock to `end`. */
  async runUntil(end: number): Promise<void> {
    await settle();
    for (;;) {
      let due: { id: number; at: number } | undefined;
      for (const [id, timer] of this.pending) {
        if (timer.at <= end && (due === undefined || timer.at < due.at)) due = { id, at: timer.at };
      }
      if (due === undefined) break;
      const timer = this.pending.get(due.id);
      this.pending.delete(due.id);
      this.now = Math.max(this.now, due.at);
      timer?.fn();
      await settle();
    }
    this.now = Math.max(this.now, end);
    await settle();
  }
}

export type Step =
  | { readonly kind: "ok"; readonly delayMs?: number }
  | { readonly kind: "fail"; readonly failure: SourceFailure; readonly delayMs?: number }
  | { readonly kind: "throw"; readonly delayMs?: number };

export interface Attempt {
  readonly source: SourceId;
  /** The `now` the scheduler passed. */
  readonly at: number;
  readonly step: Step;
}

const URL_OF = (source: SourceId): string => `https://example.test/${source}`;

/**
 * Fetchers that follow a script (a list of steps per source, cycled), take their delay on the fake
 * timers, and record every attempt, the number in flight and the last good `fetchedAt`.
 */
export function scriptedFetchers(
  time: FakeTime,
  script: Readonly<Record<SourceId, readonly Step[]>>,
) {
  const attempts: Attempt[] = [];
  const inFlight = new Map<SourceId, number>();
  const maxInFlight = new Map<SourceId, number>();
  const lastGood = new Map<SourceId, string>(
    (Object.keys(SNAPSHOT.sources) as SourceId[]).map((id) => [id, SNAPSHOT.sources[id].fetchedAt]),
  );
  const counts = new Map<SourceId, number>();

  async function run(source: SourceId, at: Date) {
    const steps = script[source];
    const n = counts.get(source) ?? 0;
    counts.set(source, n + 1);
    const step: Step = steps[n % Math.max(steps.length, 1)] ?? { kind: "ok" };
    attempts.push({ source, at: at.getTime(), step });
    const now = (inFlight.get(source) ?? 0) + 1;
    inFlight.set(source, now);
    maxInFlight.set(source, Math.max(maxInFlight.get(source) ?? 0, now));
    try {
      if ((step.delayMs ?? 0) > 0) {
        await new Promise<void>((resolve) => time.timers.set(step.delayMs ?? 0, resolve));
      }
      if (step.kind === "throw") throw new Error("scripted throw");
      if (step.kind === "fail") {
        const failed: FetchOutcome<never> = {
          ok: false,
          source,
          url: URL_OF(source),
          failure: step.failure,
        };
        return failed;
      }
      lastGood.set(source, at.toISOString());
      return { ok: true as const, fetchedAt: at.toISOString() };
    } finally {
      inFlight.set(source, (inFlight.get(source) ?? 1) - 1);
    }
  }

  const fetchers: typeof FETCHERS = {
    "wikimedia-feed": async (_http: HttpClient, at) => {
      const r = await run("wikimedia-feed", at);
      return r.ok
        ? { ok: true, value: SNAPSHOT.sources["wikimedia-feed"].value, fetchedAt: r.fetchedAt }
        : r;
    },
    "wikimedia-onthisday": async (_http: HttpClient, at) => {
      const r = await run("wikimedia-onthisday", at);
      return r.ok
        ? { ok: true, value: SNAPSHOT.sources["wikimedia-onthisday"].value, fetchedAt: r.fetchedAt }
        : r;
    },
    "open-meteo": async (_http: HttpClient, at) => {
      const r = await run("open-meteo", at);
      return r.ok
        ? { ok: true, value: SNAPSHOT.sources["open-meteo"].value, fetchedAt: r.fetchedAt }
        : r;
    },
    frankfurter: async (_http: HttpClient, at) => {
      const r = await run("frankfurter", at);
      return r.ok
        ? { ok: true, value: SNAPSHOT.sources.frankfurter.value, fetchedAt: r.fetchedAt }
        : r;
    },
    "hacker-news": async (_http: HttpClient, at) => {
      const r = await run("hacker-news", at);
      return r.ok
        ? { ok: true, value: SNAPSHOT.sources["hacker-news"].value, fetchedAt: r.fetchedAt }
        : r;
    },
    usgs: async (_http: HttpClient, at) => {
      const r = await run("usgs", at);
      return r.ok ? { ok: true, value: SNAPSHOT.sources.usgs.value, fetchedAt: r.fetchedAt } : r;
    },
    "launch-library": async (_http: HttpClient, at) => {
      const r = await run("launch-library", at);
      return r.ok
        ? { ok: true, value: SNAPSHOT.sources["launch-library"].value, fetchedAt: r.fetchedAt }
        : r;
    },
  };
  return { fetchers, attempts, maxInFlight, lastGood };
}

/** A script that always succeeds at once. */
export const ALWAYS_OK: Readonly<Record<SourceId, readonly Step[]>> = {
  "wikimedia-feed": [{ kind: "ok" }],
  "wikimedia-onthisday": [{ kind: "ok" }],
  "open-meteo": [{ kind: "ok" }],
  frankfurter: [{ kind: "ok" }],
  "hacker-news": [{ kind: "ok" }],
  usgs: [{ kind: "ok" }],
  "launch-library": [{ kind: "ok" }],
};

/** An HTTP client the scheduler passes on; the scripted fetchers never use it. */
export const NO_HTTP: HttpClient = {
  getText: () => Promise.reject(new Error("the scripted fetchers make no request")),
  getJson: () => Promise.reject(new Error("the scripted fetchers make no request")),
};

export interface PublishRecord {
  readonly number: number;
  readonly stale: boolean;
  readonly now: number;
  readonly ok: boolean;
  /** What `probe` said at the moment of the publish. */
  readonly probed: string | undefined;
}

/** The real store, with every publish recorded; it changes nothing about what the store does. */
export function recordingStore(
  inner: Store,
  probe: (page: number) => string | undefined = () => undefined,
): { store: Store; publishes: PublishRecord[] } {
  const publishes: PublishRecord[] = [];
  const store: Store = {
    get: (n) => inner.get(n),
    list: () => inner.list(),
    failures: (n) => inner.failures(n),
    editorStatus: () => inner.editorStatus(),
    aiEditor: () => inner.aiEditor(),
    setEditorStatus: (status) => {
      inner.setEditorStatus(status);
    },
    publish(compiled: CompiledPage, frame) {
      const outcome = inner.publish(compiled, frame);
      publishes.push({
        number: compiled.number,
        stale: frame.stale,
        now: frame.now.getTime(),
        ok: outcome.ok,
        probed: probe(compiled.number),
      });
      return outcome;
    },
  };
  return { store, publishes };
}
