import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EditorFixture } from "../../src/editor/editor-fixture.js";
import { containsSecret } from "../../scripts/lib/recording-client.js";
import { recordEditor } from "../../scripts/lib/record-editor.js";
import type { RecordHost } from "../../scripts/lib/record-editor.js";
import { NOW } from "../compilers/boot-snapshot.js";
import { fakeFetch, rowsReply } from "../editor/fake-fetch.js";
import { replay } from "../editor/replay.js";

// The recording script's logic (ai-editor 14.1 to 14.5). These tests give it a scripted transport
// and a fake host: the real script is run only by the owner with a real key (14.4), and no test
// reads a secrets file or makes a network request.

const KEY = "sk-ant-test-0123456789abcdefghij";
const SNAPSHOT_TEXT = readFileSync(
  resolve(import.meta.dirname, "..", "..", "src", "sources", "snapshot", "snapshot.json"),
  "utf8",
);

function host(snapshot: unknown = JSON.parse(SNAPSHOT_TEXT)) {
  const lines: string[] = [];
  const written = new Map<string, string>();
  const h: RecordHost = {
    print: (line) => lines.push(line),
    readSnapshot: () => snapshot,
    now: () => NOW,
    writeFixture: (name, text) => written.set(name, text),
  };
  return { host: h, lines, written };
}

describe("containsSecret (14.3)", () => {
  it("finds the key, x-api-key and authorization, in any case", () => {
    expect(containsSecret(`a ${KEY} b`, KEY)).toBe(true);
    expect(containsSecret("sent X-API-Key: abc", KEY)).toBe(true);
    expect(containsSecret("Authorization: Bearer abc", KEY)).toBe(true);
  });

  it("finds nothing in text without them", () => {
    expect(containsSecret('{"rows":["Floods hit 12 towns"]}', KEY)).toBe(false);
    expect(containsSecret("sk-ant-other-key is not this one", KEY)).toBe(false);
  });

  it("does not treat an empty key as present everywhere", () => {
    expect(containsSecret("anything", "")).toBe(false);
  });
});

describe("recordEditor refusals (14.1, 14.5)", () => {
  it("returns 1 with the 14.1 message and sends no request when the key is not set", async () => {
    const fake = fakeFetch([]);
    const h = host();
    expect(await recordEditor({}, fake.fetch, h.host)).toBe(1);
    expect(h.lines).toEqual(["ANTHROPIC_API_KEY is not set"]);
    expect(fake.calls).toHaveLength(0);
    expect(h.written.size).toBe(0);
  });

  it("treats an empty key as not set", async () => {
    const fake = fakeFetch([]);
    const h = host();
    expect(await recordEditor({ ANTHROPIC_API_KEY: "" }, fake.fetch, h.host)).toBe(1);
    expect(h.lines).toEqual(["ANTHROPIC_API_KEY is not set"]);
  });

  it.each([
    ["MAX_MODEL_CALLS_PER_DAY", "abc"],
    ["MAX_MODEL_CALLS_PER_DAY", "10001"],
    ["MAX_MODEL_CALLS_PER_DAY", "-1"],
    ["EDITOR_MAX_CALLS_PER_BOOT", "1.5"],
    ["EDITOR_MAX_CALLS_PER_BOOT", "99999999"],
  ])("names %s and never its value %s", async (name, value) => {
    const fake = fakeFetch([]);
    const h = host();
    expect(await recordEditor({ ANTHROPIC_API_KEY: KEY, [name]: value }, fake.fetch, h.host)).toBe(
      1,
    );
    expect(h.lines).toEqual([`${name} must be an integer from 0 to 10000`]);
    expect(h.lines.join("\n")).not.toContain(value);
    expect(fake.calls).toHaveLength(0);
  });

  it("returns 1 for a snapshot that does not parse, without a request", async () => {
    const fake = fakeFetch([]);
    const h = host({ version: 2 });
    expect(await recordEditor({ ANTHROPIC_API_KEY: KEY }, fake.fetch, h.host)).toBe(1);
    expect(h.lines).toEqual(["the boot snapshot does not parse"]);
    expect(fake.calls).toHaveLength(0);
  });
});

describe("recordEditor over a scripted transport (14.2, 14.3)", () => {
  const env = {
    ANTHROPIC_API_KEY: KEY,
    MAX_MODEL_CALLS_PER_DAY: "100",
    EDITOR_MAX_CALLS_PER_BOOT: "100",
  };

  it("writes one valid fixture per page that made a call, none holding a secret, and they replay", async () => {
    const fake = fakeFetch(Array.from({ length: 60 }, () => rowsReply(["Floods"])));
    const h = host();
    expect(await recordEditor(env, fake.fetch, h.host)).toBe(0);
    expect([...h.written.keys()].sort()).toEqual(
      [110, 111, 112, 113, 114, 115, 500, 501, 700].map((n) => `2026-11-11-p${String(n)}.json`),
    );
    const fixtures = [...h.written.values()].map((text) => {
      expect(containsSecret(text, KEY)).toBe(false);
      return EditorFixture.parse(JSON.parse(text));
    });
    for (const fixture of fixtures) {
      expect(fixture.model).toBe("claude-opus-5-5");
      expect(fixture.recordedAt).toBe(NOW.toISOString());
      expect(fixture.attempts.length).toBeGreaterThan(0);
    }
    expect(h.lines.at(-1)).toBe("wrote 9 fixtures");
    expect(h.lines.join("\n")).not.toContain(KEY);

    const { calls } = await replay(fixtures);
    for (const fixture of fixtures) {
      expect(calls.filter((c) => c.page === fixture.page)).toHaveLength(fixture.attempts.length);
    }
  });

  it("writes nothing and returns 1 when a fixture would hold a secret", async () => {
    const snapshot: unknown = JSON.parse(SNAPSHOT_TEXT);
    const text = JSON.stringify(snapshot).replace(
      /("news":\s*\[\s*\{\s*"text":\s*")/,
      "$1Authorization header leaked ",
    );
    const fake = fakeFetch(Array.from({ length: 60 }, () => rowsReply(["Floods"])));
    const h = host(JSON.parse(text));
    expect(await recordEditor(env, fake.fetch, h.host)).toBe(1);
    expect(h.written.size).toBe(0);
    expect(h.lines.at(-1)).toBe("a fixture would hold a secret; nothing was written");
    expect(h.lines.join("\n")).not.toContain(KEY);
  });
});
