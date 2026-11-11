import { appRoot, readAppFiles } from "./app-files.js";
import { createApp } from "./app.js";
import type { App } from "./app.js";
import { loadConfig } from "./config.js";
import type { Env } from "./config.js";
import { startHttpServer } from "./http-server.js";
import type { Timers } from "./timers.js";
import type { FetchFunction } from "../editor/anthropic-editor-client.js";

// Starting the server (server-and-viewer requirements 3.1 to 3.4). `main.ts` calls this and turns
// the answer into an exit code; tests call it with port 0 on 127.0.0.1 and shut it down themselves.

export interface RunOptions {
  readonly env?: Env;
  readonly root?: string;
  readonly clock: () => Date;
  readonly timers: Timers;
  readonly random: () => number;
  readonly fetch: FetchFunction;
  readonly log: (line: string) => void;
  /** Overrides `PORT` (tests ask for 0). */
  readonly port?: number;
  readonly host: string;
}

export type RunResult =
  | { readonly ok: false; readonly problems: readonly string[] }
  | {
      readonly ok: true;
      readonly port: number;
      readonly app: App;
      /** Clears every timer, stops accepting connections, and resolves when open requests are done. */
      shutdown(): Promise<void>;
    };

/**
 * Loads the config and the files, compiles and publishes every page, and only then listens
 * (requirement 3.3). A bad config, a missing or invalid file, or no published page is a failure
 * with one line per problem (requirement 3.2); nothing listens.
 */
export async function startServer(options: RunOptions): Promise<RunResult> {
  const loaded = options.env === undefined ? loadConfig() : loadConfig(options.env);
  if (!loaded.ok) return { ok: false, problems: loaded.problems };
  const { config } = loaded;

  const read = readAppFiles(options.root ?? appRoot(), config.editorClient === "fixtures");
  if (!read.ok) return { ok: false, problems: [read.problem] };

  const app = createApp({
    config,
    files: read.files,
    clock: options.clock,
    timers: options.timers,
    random: options.random,
    fetch: options.fetch,
    log: options.log,
  });
  if (app.boot.published === 0) {
    app.scheduler.stop();
    return { ok: false, problems: ["no page could be published at boot"] };
  }

  let running;
  try {
    running = await startHttpServer(app.router, options.port ?? config.port, options.host);
  } catch {
    app.scheduler.stop();
    return {
      ok: false,
      problems: [`could not listen on port ${String(options.port ?? config.port)}`],
    };
  }
  app.scheduler.start();
  options.log(
    `boot: ${String(app.boot.published)} pages published, ${String(app.boot.failed)} failed, listening on ${String(running.port)}`,
  );
  return {
    ok: true,
    port: running.port,
    app,
    async shutdown() {
      app.scheduler.stop();
      await running.close();
    },
  };
}
