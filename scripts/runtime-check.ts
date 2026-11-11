import { execFileSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { RUNTIME_COPIES } from "./lib/runtime-copies.js";

// `npx tsx scripts/runtime-check.ts` (server-and-viewer requirement 16.5): proves the layout of the
// Docker runtime stage without Docker. Builds, copies exactly RUNTIME_COPIES into a temporary
// directory, runs `npm ci --omit=dev` there (npm network use), starts the server with no refresh
// and no editor client, gets 200 from /api/health, /100 and each asset, sends SIGTERM and passes
// only when the process exits 0 within 10 s. Requests go to 127.0.0.1 only.

const ROOT = resolve(import.meta.dirname, "..");
const EXIT_LIMIT_MS = 10_000;
const READY_LIMIT_MS = 20_000;

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => {
        resolvePort(port);
      });
    });
  });
}

function copyRuntimeFiles(target: string): void {
  for (const tokens of RUNTIME_COPIES) {
    const args = tokens.filter((token) => !token.startsWith("--"));
    const destination = args.at(-1);
    if (destination === undefined) throw new Error("empty COPY line");
    for (const source of args.slice(0, -1)) {
      // `--from=build /app/dist` is the build stage's output: the repository's own dist/.
      const from = source.startsWith("/app/") ? join(ROOT, source.slice(5)) : join(ROOT, source);
      const to = destination.endsWith("/")
        ? join(target, destination, basename(source))
        : join(target, destination);
      mkdirSync(resolve(to, ".."), { recursive: true });
      cpSync(from, to, { recursive: true });
    }
  }
}

async function get(base: string, path: string): Promise<{ status: number; text: string }> {
  const response = await fetch(`${base}${path}`);
  return { status: response.status, text: await response.text() };
}

function fail(message: string): never {
  throw new Error(`runtime check failed: ${message}`);
}

const work = mkdtempSync(join(tmpdir(), "page100-runtime-"));
let server: ReturnType<typeof spawn> | undefined;
try {
  console.log("building");
  execFileSync("npx", ["tsc", "-p", "tsconfig.build.json"], { cwd: ROOT, stdio: "inherit" });
  copyRuntimeFiles(work);
  console.log("npm ci --omit=dev");
  execFileSync("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], {
    cwd: work,
    stdio: "inherit",
  });

  const port = await freePort();
  const base = `http://127.0.0.1:${String(port)}`;
  const child = spawn("node", ["dist/server/main.js"], {
    cwd: work,
    env: {
      PATH: process.env.PATH ?? "",
      NODE_ENV: "production",
      PORT: String(port),
      REFRESH: "off",
      EDITOR_CLIENT: "off",
    },
    stdio: ["ignore", "inherit", "inherit"],
  });
  server = child;
  const exited = new Promise<number | null>((done) => {
    child.once("exit", (code) => {
      done(code);
    });
  });

  const deadline = Date.now() + READY_LIMIT_MS;
  for (;;) {
    if (child.exitCode !== null)
      fail(`server exited with ${String(child.exitCode)} while starting`);
    try {
      if ((await get(base, "/api/health")).status === 200) break;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) fail("/api/health not ready in 20 s");
    await new Promise((done) => setTimeout(done, 200));
  }

  const home = await get(base, "/100");
  if (home.status !== 200) fail(`/100 answered ${String(home.status)}`);
  const assets = [
    ...new Set(
      [...home.text.matchAll(/(?:href|src)="(\/(?:assets\/|favicon)[^"]*)"/g)].map(
        (m) => m[1] ?? "",
      ),
    ),
  ];
  if (assets.length < 4) fail(`expected 4 assets, found ${String(assets.length)}`);
  for (const path of assets) {
    const answer = await get(base, path);
    if (answer.status !== 200) fail(`${path} answered ${String(answer.status)}`);
  }

  child.kill("SIGTERM");
  const code = await Promise.race([
    exited,
    new Promise<"timeout">((done) =>
      setTimeout(() => {
        done("timeout");
      }, EXIT_LIMIT_MS),
    ),
  ]);
  if (code !== 0) fail(`exit ${String(code)} after SIGTERM (0 within 10 s expected)`);
  console.log("runtime check passed");
} catch (error) {
  console.error(error instanceof Error ? error.message : "runtime check failed");
  process.exitCode = 1;
} finally {
  if (server?.exitCode === null) server.kill("SIGKILL");
  rmSync(work, { recursive: true, force: true });
}
