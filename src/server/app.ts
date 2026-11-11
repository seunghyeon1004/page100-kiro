import { createCallBudget } from "../editor/call-budget.js";
import type { CallBudget } from "../editor/call-budget.js";
import { createEditorClient } from "../editor/create-editor-client.js";
import { createDraftCache } from "../editor/draft-cache.js";
import { EditorFixture } from "../editor/editor-fixture.js";
import { runEdition } from "../editor/run-edition.js";
import type { FetchFunction } from "../editor/anthropic-editor-client.js";
import { createHttpClient, realDelay } from "../sources/http.js";
import { FETCHERS } from "../sources/fetchers.js";
import { userAgent } from "../sources/user-agent.js";
import type { AppFiles } from "./app-files.js";
import { buildAssets } from "./assets.js";
import type { AssetTable } from "./assets.js";
import type { Config } from "./config.js";
import { createRouter } from "./router.js";
import type { Router } from "./router.js";
import { createScheduler } from "./scheduler.js";
import type { EditionRunner, Scheduler } from "./scheduler.js";
import { createStore } from "./store.js";
import type { Store } from "./store.js";
import type { Timers } from "./timers.js";

// The app: every part of the server wired together except the socket (server-and-viewer design.md,
// "Boot"). `payload`, `screenshots` and the tests call this with the same inputs as production.

export interface AppDeps {
  readonly config: Config;
  readonly files: AppFiles;
  readonly clock: () => Date;
  readonly timers: Timers;
  readonly random: () => number;
  /** The global `fetch`: used for the sources and for the model. */
  readonly fetch: FetchFunction;
  readonly log: (line: string) => void;
}

export interface App {
  readonly router: Router;
  readonly scheduler: Scheduler;
  readonly store: Store;
  readonly assets: AssetTable;
  /** What the boot compile published. */
  readonly boot: { readonly published: number; readonly failed: number };
}

/** A budget that refuses every call: the reuse pass reads the draft cache and nothing more (requirement 6.8). */
function refusing(real: CallBudget): CallBudget {
  return { tryReserve: () => false, settle: () => undefined, usage: (now) => real.usage(now) };
}

function parseFixtures(files: AppFiles, log: (line: string) => void): EditorFixture[] {
  const fixtures: EditorFixture[] = [];
  for (const { name, text } of files.fixtures) {
    try {
      const parsed = EditorFixture.safeParse(JSON.parse(text));
      if (parsed.success) fixtures.push(parsed.data);
      else log(`editor fixture ${name}: skipped, not a fixture`);
    } catch {
      log(`editor fixture ${name}: skipped, not JSON`);
    }
  }
  return fixtures;
}

export function createApp(deps: AppDeps): App {
  const { config, files, clock, log } = deps;
  const assets = buildAssets({ css: files.css, js: files.js, font: files.font });

  const client = createEditorClient(config, deps.fetch, parseFixtures(files, log));
  const store = createStore({ aiEditor: client !== null });

  let editor: { run: EditionRunner; policy: "gated" | "free" } | null = null;
  if (client !== null) {
    const budget = createCallBudget(config.maxModelCallsPerDay, config.editorMaxCallsPerBoot);
    const cache = createDraftCache();
    const reuseBudget = refusing(budget);
    const run: EditionRunner = (snapshot, status, now, mode) =>
      runEdition(snapshot, status, now, {
        client,
        budget: mode === "spend" ? budget : reuseBudget,
        cache,
        log: mode === "spend" ? log : () => undefined,
      });
    editor = { run, policy: config.editorClient === "fixtures" ? "free" : "gated" };
  }

  const scheduler = createScheduler({
    refresh: config.refresh === "on",
    editor,
    editorBootDelayMs: config.editorBootDelayMs,
    editorMinIntervalMs: config.editorMinIntervalMs,
    modelCallCap: config.maxModelCallsPerDay,
    store,
    timers: deps.timers,
    clock,
    random: deps.random,
    http: createHttpClient({
      fetch: deps.fetch,
      delay: realDelay,
      userAgent: userAgent(config.publicOrigin),
    }),
    fetchers: FETCHERS,
    snapshot: files.snapshot,
    pageFiles: files.pageFiles,
    log,
  });

  const boot = scheduler.boot();
  const router = createRouter({ store, assets, clock });
  return { router, scheduler, store, assets, boot };
}
