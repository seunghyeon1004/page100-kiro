import { describe, expect, it } from "vitest";
import { EditorFixture } from "../../src/editor/editor-fixture.js";
import type { DraftRequest } from "../../src/editor/editor-types.js";
import { FixtureEditorClient } from "../../src/editor/fixture-editor-client.js";

// These fixtures are scripted in the test and parsed with the real schema. They are not
// recordings: those are made by the owner (tasks.md, task 14).

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

function parsed(value: unknown): EditorFixture {
  return EditorFixture.parse(value);
}

const FIXTURE = parsed({
  version: 1,
  page: 111,
  inputKey: KEY_A,
  model: "test-model",
  recordedAt: "2026-11-11T14:05:09.000Z",
  system: "system text",
  attempts: [
    { user: "first", result: { ok: false, reason: "refusal", status: null, requests: 2 } },
    { user: "second", result: { ok: true, rows: ["Floods hit 12 towns"], requests: 2 } },
  ],
});

function request(inputKey: string, attempt: 0 | 1 | 2): DraftRequest {
  return { page: 111, totalRows: 17, slots: [], inputKey, attempt, previous: null };
}

describe("FixtureEditorClient (requirement 13.2)", () => {
  const client = new FixtureEditorClient([FIXTURE]);

  it("reports one request per draft", () => {
    expect(client.maxRequestsPerDraft).toBe(1);
  });

  it("answers attempt n of an input key with the fixture's attempt n, as one request", async () => {
    expect(await client.draft(request(KEY_A, 0))).toEqual({
      ok: false,
      reason: "refusal",
      status: null,
      requests: 1,
    });
    expect(await client.draft(request(KEY_A, 1))).toEqual({
      ok: true,
      rows: ["Floods hit 12 towns"],
      requests: 1,
    });
  });

  it("answers an attempt the fixture lacks, and an unknown key, with no-fixture", async () => {
    const none = { ok: false, reason: "no-fixture", status: null, requests: 1 };
    expect(await client.draft(request(KEY_A, 2))).toEqual(none);
    expect(await client.draft(request(KEY_B, 0))).toEqual(none);
  });
});

describe("EditorFixture (requirement 13.1)", () => {
  const good = {
    version: 1,
    page: 111,
    inputKey: KEY_A,
    model: "m",
    recordedAt: "2026-11-11T14:05:09.000Z",
    system: "s",
    attempts: [{ user: "u", result: { ok: true, rows: [], requests: 1 } }],
  };

  it("accepts a well-formed fixture", () => {
    expect(EditorFixture.safeParse(good).success).toBe(true);
  });

  it.each([
    ["an unknown field", { ...good, extra: 1 }],
    ["a short input key", { ...good, inputKey: "abc" }],
    ["no attempts", { ...good, attempts: [] }],
    ["four attempts", { ...good, attempts: Array.from({ length: 4 }, () => good.attempts[0]) }],
    ["a bad time", { ...good, recordedAt: "yesterday" }],
    [
      "an unknown reason",
      {
        ...good,
        attempts: [{ user: "u", result: { ok: false, reason: "x", status: null, requests: 1 } }],
      },
    ],
  ])("rejects %s", (_name, value) => {
    expect(EditorFixture.safeParse(value).success).toBe(false);
  });
});
