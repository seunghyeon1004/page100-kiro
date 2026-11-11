import { realTimers } from "./timers.js";
import { startServer } from "./run.js";

// The entry point (`npm start`, `npm run dev`): start, log, and shut down on SIGTERM or SIGINT.

const SHUTDOWN_LIMIT_MS = 10_000;

function log(line: string): void {
  process.stdout.write(`${new Date().toISOString()} ${line}\n`);
}

const started = await startServer({
  clock: () => new Date(),
  timers: realTimers(),
  random: Math.random,
  fetch: globalThis.fetch,
  log,
  host: "0.0.0.0",
});

if (!started.ok) {
  for (const problem of started.problems) log(problem);
  process.exit(1);
}

const running = started;
let closing = false;
function shutdown(signal: string): void {
  if (closing) return;
  closing = true;
  log(`shutdown: ${signal}`);
  setTimeout(() => {
    process.exit(1);
  }, SHUTDOWN_LIMIT_MS).unref();
  void running.shutdown().then(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
