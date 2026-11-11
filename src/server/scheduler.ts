import { compileAll } from "../compilers/compile-all.js";
import type { CompileAllResult } from "../compilers/compile-all.js";
import type { PageFiles } from "../compilers/compile-types.js";
import { compile802 } from "../compilers/p802-service-status.js";
import type { ServiceStatus } from "../compilers/service-status.js";
import { emptyEditorStatus } from "../editor/run-edition.js";
import type { EditionResult, EditorStatus } from "../editor/run-edition.js";
import type { CompiledPage } from "../pages/compiled-page.js";
import type { PageSource } from "../pages/page-def.js";
import { findPage } from "../pages/registry.js";
import type { FETCHERS } from "../sources/fetchers.js";
import type { HttpClient } from "../sources/http.js";
import type { SourceFailure } from "../sources/outcome.js";
import { JITTER_FRACTION, SCHEDULE, isStale } from "../sources/schedule.js";
import { parseSnapshot } from "../sources/snapshot.js";
import type { Snapshot } from "../sources/snapshot.js";
import { SOURCE_IDS } from "../sources/source-id.js";
import type { SourceId } from "../sources/source-id.js";
import type { Store } from "./store.js";
import type { Timers } from "./timers.js";

// The scheduler (server-and-viewer requirements 5 and 6, design.md, "Scheduler"): when each
// source is fetched, when its pages are recompiled and published, when they turn stale, and
// when the AI editor runs. Everything it needs from the outside is an argument.

const DAY_MS = 86_400_000;
const MIDNIGHT_JITTER_MS = 300_000;
const ON_THIS_DAY_RETRY_MS = 1_800_000;
const WIKIPEDIA: readonly SourceId[] = ["wikimedia-feed", "wikimedia-onthisday"];
/** The pages that depend on no source but are recompiled on every success: the moon and the status page. */
const ALWAYS_AFFECTED: readonly number[] = [601, 802];

/** What `nextDelay` needs to know about an attempt. */
export type AttemptOutcome =
  { readonly ok: true } | { readonly ok: false; readonly retryAfterMs: number | null };

/**
 * The time of the next attempt on `source`, in milliseconds since the epoch, given the time of the
 * last attempt and a random number `r` in [0, 1) (requirements 5.1 to 5.3). Pure.
 */
export function nextDelay(
  source: SourceId,
  attemptAt: Date,
  outcome: AttemptOutcome,
  r: number,
): number {
  const at = attemptAt.getTime();
  const entry = SCHEDULE[source];
  let next: number;
  if (source === "wikimedia-onthisday") {
    next = outcome.ok
      ? (Math.floor(at / DAY_MS) + 1) * DAY_MS + MIDNIGHT_JITTER_MS * r
      : at + ON_THIS_DAY_RETRY_MS;
  } else {
    next = at + entry.intervalMs * (1 + JITTER_FRACTION * r);
  }
  if (entry.strictInterval) next = Math.max(next, at + entry.intervalMs);
  if (!outcome.ok && outcome.retryAfterMs !== null)
    next = Math.max(next, at + outcome.retryAfterMs);
  return next;
}

/** How an edition is run: `spend` may call the model, `reuse` only reads the draft cache (requirement 6.8). */
export type EditionMode = "spend" | "reuse";

export type EditionRunner = (
  snapshot: Snapshot,
  status: EditorStatus,
  now: Date,
  mode: EditionMode,
) => Promise<EditionResult>;

/** `gated` is the real model (boot delay and interval apply); `free` is recorded drafts (requirement 6.9). */
export type EditionPolicy = "gated" | "free";

export type CompileFunction = (
  snapshot: Snapshot,
  status: ServiceStatus,
  now: Date,
  pageFiles: PageFiles,
) => CompileAllResult;

export interface SchedulerDeps {
  readonly refresh: boolean;
  /** The editor, or `null` when there is no client. */
  readonly editor: { readonly run: EditionRunner; readonly policy: EditionPolicy } | null;
  readonly editorBootDelayMs: number;
  readonly editorMinIntervalMs: number;
  /** Shown on page 802 before the first edition has reported the real cap. */
  readonly modelCallCap: number;
  readonly store: Store;
  readonly timers: Timers;
  readonly clock: () => Date;
  readonly random: () => number;
  readonly http: HttpClient;
  readonly fetchers: typeof FETCHERS;
  /** The boot snapshot. */
  readonly snapshot: Snapshot;
  readonly pageFiles: PageFiles;
  /** `compileAll`, unless a test supplies another to keep a long simulation cheap. */
  readonly compile?: CompileFunction;
  readonly log: (line: string) => void;
}

export interface Scheduler {
  /** Compiles and publishes every page, then asks for the first edition. Synchronous. */
  boot(): { readonly published: number; readonly failed: number };
  /** Sets the source timers (only while `refresh` is on). */
  start(): void;
  /** Clears every timer; nothing is scheduled afterwards. */
  stop(): void;
  /** Resolves when no fetch and no edition is in flight. */
  idle(): Promise<void>;
}

interface SourceState {
  inFlight: boolean;
  timer: number | null;
  staleTimer: number | null;
}

/** The log line of a failed fetch (requirement 5.5): source, kind, URL, status, issue paths; never a body. */
function describeFailure(source: SourceId, url: string, failure: SourceFailure): string {
  const status = failure.kind === "status" ? `, status ${String(failure.status)}` : "";
  const issues = failure.kind === "schema" ? `, issues ${failure.issuePaths.join(",")}` : "";
  return `refresh ${source}: failed, ${failure.kind}, ${url}${status}${issues}`;
}

/** The Wikipedia source a page is built from, or `undefined` for any other page. */
function wikipediaSourceOf(source: PageSource | undefined): SourceId | undefined {
  return source === "wikimedia-feed" || source === "wikimedia-onthisday" ? source : undefined;
}

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const { store, timers, clock, random, log, editor } = deps;
  const compile = deps.compile ?? compileAll;
  let current = deps.snapshot;
  let stopped = false;
  /** Read through a function: `stop()` can run during any `await`, which flow analysis cannot see. */
  const halted = (): boolean => stopped;
  let bootAt = 0;

  const states = new Map<SourceId, SourceState>(
    SOURCE_IDS.map((id) => [id, { inFlight: false, timer: null, staleTimer: null }]),
  );
  /** The latest compiled page of each number that the store accepted, for stale republishing. */
  const held = new Map<number, CompiledPage>();
  const pending = new Set<Promise<void>>();

  // Edition state (design.md, "Scheduler", Edition).
  let running = false;
  let dirty = false;
  let lastStartAt: number | null = null;
  let gateTimer: number | null = null;

  function track(work: Promise<void>): void {
    pending.add(work);
    void work.finally(() => {
      pending.delete(work);
    });
  }

  function stateOf(source: SourceId): SourceState {
    const state = states.get(source);
    if (state === undefined) throw new Error(`no state for ${source}`);
    return state;
  }

  function serviceStatus(): ServiceStatus {
    const status = store.editorStatus();
    return {
      aiEditor: editor !== null,
      modelCalls: {
        used: status?.callsToday ?? 0,
        cap: status?.capPerDay ?? deps.modelCallCap,
      },
      drafts: { accepted: status?.accepted ?? 0, rejected: status?.rejected ?? 0 },
      pages: store.list().map((page) => ({
        number: page.number,
        compiledAt: page.compiledAt,
        editor: page.editor,
      })),
    };
  }

  function staleAt(number: number, now: Date): boolean {
    const source = findPage(number)?.source;
    if (source === undefined || source === "static" || source === "computed") return false;
    return isStale(source, new Date(current.sources[source].fetchedAt), now);
  }

  function publishPages(
    pages: readonly CompiledPage[],
    now: Date,
  ): { published: number; failed: number } {
    let published = 0;
    let failed = 0;
    for (const page of pages) {
      const outcome = store.publish(page, { now, stale: staleAt(page.number, now) });
      if (outcome.ok) {
        held.set(page.number, page);
        published += 1;
      } else {
        failed += 1;
      }
    }
    return { published, failed };
  }

  /** Page 802 from the store as it is now. */
  function publish802(now: Date): void {
    const result = compile802(serviceStatus(), now);
    if (result.ok) publishPages([result.page], now);
  }

  function isAffected(source: SourceId, number: number): boolean {
    return findPage(number)?.source === source || ALWAYS_AFFECTED.includes(number);
  }

  // ---- editions --------------------------------------------------------------------------

  function trigger(): void {
    dirty = true;
    tryStart();
  }

  function tryStart(): void {
    if (stopped || editor === null || !dirty || running) return;
    const now = clock();
    if (editor.policy === "gated") {
      if (!deps.refresh) return;
      const earliest = Math.max(
        bootAt + deps.editorBootDelayMs,
        lastStartAt === null ? 0 : lastStartAt + deps.editorMinIntervalMs,
      );
      if (now.getTime() < earliest) {
        gateTimer ??= timers.set(earliest - now.getTime(), () => {
          gateTimer = null;
          tryStart();
        });
        return;
      }
    }
    track(runEdition(editor.run, now));
  }

  async function runEdition(run: EditionRunner, startedAt: Date): Promise<void> {
    running = true;
    dirty = false;
    lastStartAt = startedAt.getTime();
    const snapshot = current;
    const fetchedAt = new Map(WIKIPEDIA.map((id) => [id, snapshot.sources[id].fetchedAt]));
    try {
      const result = await run(
        snapshot,
        store.editorStatus() ?? emptyEditorStatus(),
        startedAt,
        "spend",
      );
      store.setEditorStatus(result.status);
      const now = clock();
      const fresh: CompiledPage[] = [];
      let dropped = 0;
      for (const page of result.pages) {
        const source = wikipediaSourceOf(findPage(page.number)?.source);
        const unchanged =
          source !== undefined && fetchedAt.get(source) === current.sources[source].fetchedAt;
        if (unchanged) fresh.push(page);
        else dropped += 1;
      }
      const counts = publishPages(fresh, now);
      publish802(now);
      const failed = result.outcomes.filter((o) => "outcome" in o).length + counts.failed;
      log(
        `edition: ${String(counts.published)} pages published, ${String(dropped)} dropped, ${String(failed)} failed`,
      );
    } catch {
      log("edition: failed");
    } finally {
      running = false;
    }
    tryStart();
  }

  /** The cached AI text for pages whose input is unchanged, at no cost (requirement 6.8). */
  async function withReusedDrafts(
    pages: readonly CompiledPage[],
    snapshot: Snapshot,
    now: Date,
  ): Promise<readonly CompiledPage[]> {
    if (editor === null) return pages;
    try {
      const result = await editor.run(
        snapshot,
        store.editorStatus() ?? emptyEditorStatus(),
        now,
        "reuse",
      );
      const edited = new Map(
        result.pages.filter((p) => p.editor === "ai").map((p) => [p.number, p]),
      );
      return pages.map((page) => edited.get(page.number) ?? page);
    } catch {
      log("edition: failed");
      return pages;
    }
  }

  // ---- sources ---------------------------------------------------------------------------

  function resetStaleTimer(source: SourceId): void {
    const state = stateOf(source);
    if (state.staleTimer !== null) timers.clear(state.staleTimer);
    state.staleTimer = null;
    if (stopped || !deps.refresh) return;
    const fetchedAt = Date.parse(current.sources[source].fetchedAt);
    const wait = fetchedAt + SCHEDULE[source].staleAfterMs + 1 - clock().getTime();
    if (wait <= 0) return;
    state.staleTimer = timers.set(wait, () => {
      state.staleTimer = null;
      try {
        const now = clock();
        const mine = [...held.values()].filter((page) => findPage(page.number)?.source === source);
        publishPages(mine, now);
        publish802(now);
      } catch {
        log(`refresh ${source}: failed, stale republish`);
      }
    });
  }

  async function applySuccess(source: SourceId, fetchedAt: string, value: unknown): Promise<void> {
    const candidate = parseSnapshot({
      ...current,
      sources: { ...current.sources, [source]: { fetchedAt, value } },
    });
    if (!candidate.ok) {
      log(`refresh ${source}: failed, schema, issues ${candidate.issuePaths.join(",")}`);
      return;
    }
    current = candidate.snapshot;
    const snapshot = current;
    const now = clock();
    let pages = compile(snapshot, serviceStatus(), now, deps.pageFiles).pages;
    if (WIKIPEDIA.includes(source)) pages = [...(await withReusedDrafts(pages, snapshot, now))];
    if (halted()) return;
    const counts = publishPages(
      pages.filter((page) => page.number !== 802 && isAffected(source, page.number)),
      now,
    );
    resetStaleTimer(source);
    publish802(now);
    log(
      `refresh ${source}: ok, ${String(counts.published)} pages published, ${String(counts.failed)} failed`,
    );
    if (WIKIPEDIA.includes(source)) trigger();
  }

  async function attempt(source: SourceId): Promise<void> {
    const state = stateOf(source);
    if (stopped || state.inFlight) return;
    state.inFlight = true;
    const at = clock();
    let outcome: AttemptOutcome = { ok: false, retryAfterMs: null };
    try {
      const fetched = await deps.fetchers[source](deps.http, at);
      if (fetched.ok) {
        await applySuccess(source, fetched.fetchedAt, fetched.value);
        outcome = { ok: true };
      } else {
        log(describeFailure(source, fetched.url, fetched.failure));
        if (fetched.failure.kind === "rate-limited") {
          outcome = { ok: false, retryAfterMs: fetched.failure.retryAfterMs };
        }
      }
    } catch {
      log(`refresh ${source}: failed, threw`);
    } finally {
      state.inFlight = false;
    }
    if (halted()) return;
    const next = nextDelay(source, at, outcome, random());
    state.timer = timers.set(Math.max(next - clock().getTime(), 0), () => {
      state.timer = null;
      track(attempt(source));
    });
  }

  return {
    boot() {
      const first = clock();
      bootAt = first.getTime();
      const compileTime = deps.refresh
        ? first
        : new Date(Math.max(...SOURCE_IDS.map((id) => Date.parse(current.sources[id].fetchedAt))));
      const compiled = compile(current, serviceStatus(), compileTime, deps.pageFiles);
      const counts = publishPages(compiled.pages, compileTime);
      publish802(compileTime);
      trigger();
      return counts;
    },
    start() {
      if (stopped || !deps.refresh) return;
      for (const source of SOURCE_IDS) {
        stateOf(source).timer = timers.set(0, () => {
          stateOf(source).timer = null;
          track(attempt(source));
        });
        resetStaleTimer(source);
      }
    },
    stop() {
      stopped = true;
      for (const state of states.values()) {
        if (state.timer !== null) timers.clear(state.timer);
        if (state.staleTimer !== null) timers.clear(state.staleTimer);
        state.timer = null;
        state.staleTimer = null;
      }
      if (gateTimer !== null) timers.clear(gateTimer);
      gateTimer = null;
    },
    async idle() {
      while (pending.size > 0) await Promise.allSettled([...pending]);
    },
  };
}
