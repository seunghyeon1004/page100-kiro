import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { appRoot, parseSnapshotText, readAppFiles } from "../../src/server/app-files.js";
import { startServer } from "../../src/server/run.js";
import type { RunResult } from "../../src/server/run.js";
import { NOW } from "../compilers/boot-snapshot.js";
import { FakeTime } from "./scheduler-fakes.js";

// server-and-viewer requirement 3 (boot and shutdown), on 127.0.0.1 with port 0. The tests start
// and stop the server themselves; the fetch given to the app refuses to leave the machine.

const ROOT = resolve(import.meta.dirname, "..", "..");
const KEY = "sk-test-not-a-real-key";

async function start(env: Record<string, string>, root = ROOT) {
  const time = new FakeTime(NOW.getTime());
  const logs: string[] = [];
  const outbound: string[] = [];
  const result = await startServer({
    env,
    root,
    clock: time.clock,
    timers: time.timers,
    random: () => 0.5,
    fetch: (input) => {
      outbound.push(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      );
      return Promise.reject(new Error("the app tests allow no outbound request"));
    },
    log: (line) => logs.push(line),
    port: 0,
    host: "127.0.0.1",
  });
  return { result, logs, outbound, time };
}

function running(result: RunResult) {
  if (!result.ok) throw new Error(`did not start: ${result.problems.join("; ")}`);
  return result;
}

const OFF = { REFRESH: "off", EDITOR_CLIENT: "off" } as const;

describe("startServer (requirements 3.3, 3.4)", () => {
  it("publishes all 30 pages, then listens, and answers health, a page and a redirect", async () => {
    const { result, logs, outbound } = await start({ ...OFF });
    const server = running(result);
    try {
      expect(server.app.boot).toEqual({ published: 30, failed: 0 });
      expect(logs).toEqual([
        `boot: 30 pages published, 0 failed, listening on ${String(server.port)}`,
      ]);
      const base = `http://127.0.0.1:${String(server.port)}`;

      const health = await fetch(`${base}/api/health`);
      expect(health.status).toBe(200);
      expect(await health.text()).toBe("ok\n");

      const txt = await fetch(`${base}/100.txt`);
      expect(txt.status).toBe(200);
      const lines = (await txt.text()).split("\n");
      expect(lines.pop()).toBe("");
      expect(lines).toHaveLength(24);
      for (const line of lines) expect(Array.from(line)).toHaveLength(40);
      expect(lines[0]).toMatch(/^P100 Page 100 {8}\w{3} \d\d \w{3} \d\d:\d\d:\d\d$/);

      const html = await fetch(`${base}/`);
      expect(html.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(html.headers.get("content-security-policy")).toContain("default-src 'none'");

      const go = await fetch(`${base}/go?p=300`, { redirect: "manual" });
      expect(go.status).toBe(303);
      expect(go.headers.get("location")).toBe("/300");

      const head = await fetch(`${base}/100`, { method: "HEAD" });
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");

      expect((await fetch(`${base}/nope`)).status).toBe(404);
      expect((await fetch(`${base}/123`)).status).toBe(404);
      expect(outbound).toEqual([]);
    } finally {
      await server.shutdown();
    }
  });

  it("answers a path with a bad escape with 404 and keeps serving", async () => {
    const { result } = await start({ ...OFF });
    const server = running(result);
    try {
      const base = `http://127.0.0.1:${String(server.port)}`;
      // A path that is not a path.
      expect((await fetch(`${base}/%zz`)).status).toBe(404);
      expect((await fetch(`${base}/api/health`)).status).toBe(200);
    } finally {
      await server.shutdown();
    }
  });

  it("stops listening and clears its timers on shutdown (3.4)", async () => {
    const { result, time } = await start({ REFRESH: "on", EDITOR_CLIENT: "off" });
    const server = running(result);
    const url = `http://127.0.0.1:${String(server.port)}/api/health`;
    expect((await fetch(url)).status).toBe(200);
    expect(time.pendingCount()).toBeGreaterThan(0);
    await server.shutdown();
    expect(time.pendingCount()).toBe(0);
    await expect(fetch(url)).rejects.toThrow();
  });

  it("serves the edited pages when the fixtures client is on (6.9)", async () => {
    const { result } = await start({ REFRESH: "off", EDITOR_CLIENT: "fixtures" });
    const server = running(result);
    try {
      await server.app.scheduler.idle();
      const base = `http://127.0.0.1:${String(server.port)}`;
      const json = (await (await fetch(`${base}/110.json`)).json()) as { editor: string };
      expect(json.editor).toBe("ai");
      const other = (await (await fetch(`${base}/116.json`)).json()) as { editor: string };
      expect(other.editor).toBe("rules");
      const status = (await (await fetch(`${base}/api/status`)).json()) as {
        aiEditor: boolean;
        editor: { accepted: number } | null;
      };
      expect(status.aiEditor).toBe(true);
      expect(status.editor?.accepted).toBeGreaterThan(0);
    } finally {
      await server.shutdown();
    }
  });

  it("never lets the API key reach a log line, a body or a header (2.4)", async () => {
    const { result, logs } = await start({ ...OFF, ANTHROPIC_API_KEY: KEY });
    const server = running(result);
    try {
      const base = `http://127.0.0.1:${String(server.port)}`;
      for (const path of ["/", "/100.json", "/api/status", "/api/health", "/nope", "/802.txt"]) {
        const response = await fetch(`${base}${path}`);
        const headers = JSON.stringify([...response.headers.entries()]);
        expect(headers).not.toContain(KEY);
        expect(await response.text()).not.toContain(KEY);
      }
      expect(logs.join("\n")).not.toContain(KEY);
    } finally {
      await server.shutdown();
    }
  });
});

describe("startServer failures (requirement 3.2)", () => {
  it("fails with one problem per bad variable and does not listen", async () => {
    const { result } = await start({ PORT: "x", REFRESH: "maybe" });
    expect(result).toEqual({
      ok: false,
      problems: ["PORT must be an integer from 1 to 65535", "REFRESH must be on or off"],
    });
  });

  it("fails naming the first missing file when the root lacks the boot files", async () => {
    const { result, time } = await start({ ...OFF }, resolve(ROOT, "test", "fixtures"));
    expect(result).toEqual({
      ok: false,
      problems: ["src/sources/snapshot/snapshot.json is missing"],
    });
    expect(time.pendingCount()).toBe(0);
  });
});

describe("readAppFiles (requirement 3.1)", () => {
  it("finds the app root from the module's own place", () => {
    expect(appRoot()).toBe(ROOT);
  });

  it("reads the snapshot, the four pages, the stylesheet, the script and the font, and no fixtures unless asked", () => {
    const read = readAppFiles(ROOT, false);
    if (!read.ok) throw new Error(read.problem);
    expect(Object.keys(read.files.pageFiles).sort()).toEqual(["666", "800", "801", "899"]);
    expect(read.files.snapshot.version).toBe(1);
    expect(read.files.font.byteLength).toBeGreaterThan(1000);
    expect(read.files.fixtures).toEqual([]);
  });

  it("reads test/fixtures/editor/*.json when asked", () => {
    const read = readAppFiles(ROOT, true);
    if (!read.ok) throw new Error(read.problem);
    expect(read.files.fixtures).toHaveLength(9);
    expect(read.files.fixtures.every((f) => f.name.endsWith(".json"))).toBe(true);
  });

  it("names the file when it is missing, without reading further", () => {
    expect(readAppFiles(resolve(ROOT, "no-such-directory"), false)).toEqual({
      ok: false,
      problem: "src/sources/snapshot/snapshot.json is missing",
    });
  });
});

describe("parseSnapshotText", () => {
  it("rejects text that is not JSON and JSON that is not a snapshot, naming the file and paths", () => {
    expect(parseSnapshotText("not json")).toEqual({
      ok: false,
      problem: "src/sources/snapshot/snapshot.json is not JSON",
    });
    const bad = parseSnapshotText("{}");
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.problem).toMatch(
        /^src\/sources\/snapshot\/snapshot\.json is not a snapshot: issues /,
      );
    }
  });
});
