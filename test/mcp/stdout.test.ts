import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(import.meta.dirname, "..", "..");

/** Starts the server as `tsx tools/mcp/server.ts` would, sends the handshake, collects stdout. */
function converse(): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "tools/mcp/server.ts"], {
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`no tools/list answer; stdout so far: ${stdout}`));
    }, 25_000);
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.includes('"id":2')) {
        clearTimeout(timer);
        child.kill();
        resolvePromise({ stdout, stderr });
      }
    });
    child.on("error", reject);
    const send = (message: object): void => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "stdout-test", version: "0.0.0" },
      },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  });
}

describe("server.ts as a child process", () => {
  it("writes only JSON-RPC messages to stdout and its diagnostics to stderr", async () => {
    const { stdout, stderr } = await converse();
    const lines = stdout.split("\n").filter((line) => line !== "");
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      const message = JSON.parse(line) as { jsonrpc?: unknown };
      expect(message.jsonrpc, line).toBe("2.0");
    }
    const first = JSON.parse(lines[0] ?? "{}") as {
      id?: unknown;
      result?: { serverInfo?: { name?: unknown } };
    };
    expect(first.id).toBe(1);
    expect(first.result?.serverInfo?.name).toBe("page100");
    expect(stderr).toContain("page100 MCP server ready");
  }, 30_000);
});
