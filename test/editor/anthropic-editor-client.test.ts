import { describe, expect, it } from "vitest";
import { AnthropicEditorClient } from "../../src/editor/anthropic-editor-client.js";
import type { DraftRequest } from "../../src/editor/editor-types.js";
import { SYSTEM_PROMPT } from "../../src/editor/system-prompt.js";
import { userMessage } from "../../src/editor/user-message.js";
import { errorReply, fakeFetch, messageReply, rowsReply } from "./fake-fetch.js";
import type { Reply } from "./fake-fetch.js";

// The real SDK over a scripted transport (requirements 4.1 to 4.5, 5.1 to 5.4).

const KEY = "sk-ant-test-0123456789abcdefghij";

const REQUEST: DraftRequest = {
  page: 111,
  totalRows: 17,
  slots: [
    {
      id: "lead",
      mode: "body",
      maxRows: 5,
      width: 38,
      optional: false,
      text: "Floods hit 12 towns.",
    },
  ],
  inputKey: "0".repeat(64),
  attempt: 0,
  previous: null,
};

function client(replies: Reply[], extra: { timeoutMs?: number; maxRetries?: number } = {}) {
  const fake = fakeFetch(replies);
  return {
    calls: fake.calls,
    client: new AnthropicEditorClient({
      apiKey: KEY,
      model: "test-model",
      fetch: fake.fetch,
      ...extra,
    }),
  };
}

describe("AnthropicEditorClient: the request (4.1 to 4.3)", () => {
  it("sends exactly the documented keys, to the fixed host, and nothing the design forbids", async () => {
    const { client: c, calls } = client([rowsReply(["Floods hit 12 towns"])]);
    await c.draft(REQUEST);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(call?.method).toBe("POST");
    const body = call?.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "max_tokens",
      "messages",
      "model",
      "output_config",
      "system",
    ]);
    expect(body.model).toBe("test-model");
    expect(body.max_tokens).toBe(4000);
    expect(body.system).toBe(SYSTEM_PROMPT);
    expect(body.messages).toEqual([{ role: "user", content: userMessage(REQUEST) }]);
    const output = body.output_config as Record<string, unknown>;
    expect(Object.keys(output).sort()).toEqual(["effort", "format"]);
    expect(output.effort).toBe("low");
    expect(output.format).toMatchObject({ type: "json_schema" });
    for (const forbidden of [
      "temperature",
      "top_p",
      "top_k",
      "thinking",
      "stop_sequences",
      "tools",
    ]) {
      expect(body).not.toHaveProperty(forbidden);
    }
  });

  it("puts the key in one authentication header, `authorization` as SDK 1.8.0 sets it, and nowhere in the body", async () => {
    const { client: c, calls } = client([rowsReply(["x"])]);
    await c.draft(REQUEST);
    const headers = calls[0]?.headers ?? {};
    const carrying = Object.entries(headers).filter(([, value]) => value.includes(KEY));
    expect(carrying.map(([name]) => name)).toEqual(["authorization"]);
    expect(calls[0]?.bodyText).not.toContain(KEY);
  });
});

describe("AnthropicEditorClient: replies (5.1)", () => {
  it("returns the rows of an end_turn reply and counts one request", async () => {
    const { client: c } = client([rowsReply(["a", "", "b"])]);
    expect(await c.draft(REQUEST)).toEqual({ ok: true, rows: ["a", "", "b"], requests: 1 });
  });

  it("reports a refusal as refusal, even with text", async () => {
    const { client: c } = client([messageReply('{"rows":["a"]}', "refusal")]);
    expect(await c.draft(REQUEST)).toEqual({
      ok: false,
      reason: "refusal",
      status: null,
      requests: 1,
    });
  });

  it("reports max_tokens as max-tokens, even with a complete reply", async () => {
    const { client: c } = client([messageReply('{"rows":["a"]}', "max_tokens")]);
    expect(await c.draft(REQUEST)).toEqual({
      ok: false,
      reason: "max-tokens",
      status: null,
      requests: 1,
    });
  });

  it("reports a cut-off reply as malformed: the SDK throws on the parse before the stop reason can be read (design.md)", async () => {
    const { client: c } = client([messageReply('{"rows":["a', "max_tokens")]);
    expect(await c.draft(REQUEST)).toEqual({
      ok: false,
      reason: "malformed",
      status: null,
      requests: 1,
    });
  });

  it("reports a 200 response body that is not a message as unknown (5.2: a TypeError, not an AnthropicError)", async () => {
    const { client: c } = client([{ kind: "text", status: 200, body: "hello" }]);
    expect(await c.draft(REQUEST)).toMatchObject({ ok: false, reason: "unknown", status: null });
  });

  it("reports other stop reasons, text that is not the schema, and no text as malformed", async () => {
    for (const reply of [
      messageReply('{"rows":["a"]}', "stop_sequence"),
      messageReply('{"lines":["a"]}'),
      messageReply("not json at all"),
      messageReply("", "end_turn", []),
    ]) {
      const { client: c } = client([reply]);
      expect(await c.draft(REQUEST)).toMatchObject({
        ok: false,
        reason: "malformed",
        status: null,
      });
    }
  });
});

describe("AnthropicEditorClient: failures (5.2 to 5.4)", () => {
  it("classifies 401 and 403 as auth, with the status and one request", async () => {
    for (const status of [401, 403]) {
      const { client: c } = client([errorReply(status)]);
      expect(await c.draft(REQUEST)).toEqual({ ok: false, reason: "auth", status, requests: 1 });
    }
  });

  it("classifies 429 as rate-limited after the SDK's one retry", async () => {
    const { client: c, calls } = client([errorReply(429), errorReply(429)]);
    expect(await c.draft(REQUEST)).toEqual({
      ok: false,
      reason: "rate-limited",
      status: 429,
      requests: 2,
    });
    expect(calls).toHaveLength(2);
  });

  it("classifies 500 as status, after one retry, and succeeds when the retry does", async () => {
    const failing = client([errorReply(500), errorReply(500)]);
    expect(await failing.client.draft(REQUEST)).toEqual({
      ok: false,
      reason: "status",
      status: 500,
      requests: 2,
    });
    const recovering = client([errorReply(500), rowsReply(["ok"])]);
    expect(await recovering.client.draft(REQUEST)).toEqual({ ok: true, rows: ["ok"], requests: 2 });
  });

  it("classifies 400 as status without a retry", async () => {
    const { client: c, calls } = client([errorReply(400)]);
    expect(await c.draft(REQUEST)).toEqual({
      ok: false,
      reason: "status",
      status: 400,
      requests: 1,
    });
    expect(calls).toHaveLength(1);
  });

  it("classifies a timeout, with no status", async () => {
    const { client: c } = client([{ kind: "hang" }, { kind: "hang" }], { timeoutMs: 50 });
    expect(await c.draft(REQUEST)).toEqual({
      ok: false,
      reason: "timeout",
      status: null,
      requests: 2,
    });
  });

  it("classifies a TypeError from fetch as connection", async () => {
    const boom: Reply = { kind: "throw", error: new TypeError("fetch failed") };
    const { client: c } = client([boom, boom]);
    expect(await c.draft(REQUEST)).toEqual({
      ok: false,
      reason: "connection",
      status: null,
      requests: 2,
    });
  });

  it("refuses a third request without sending it (4.5)", async () => {
    const { client: c, calls } = client(
      [errorReply(500), errorReply(500), errorReply(500), errorReply(500)],
      { maxRetries: 3 },
    );
    const result = await c.draft(REQUEST);
    expect(calls).toHaveLength(2);
    expect(result).toMatchObject({ ok: false, requests: 2 });
  });

  it("starts the count again for each draft", async () => {
    const { client: c, calls } = client([rowsReply(["a"]), rowsReply(["b"])]);
    expect(await c.draft(REQUEST)).toMatchObject({ ok: true, requests: 1 });
    expect(await c.draft(REQUEST)).toMatchObject({ ok: true, rows: ["b"], requests: 1 });
    expect(calls).toHaveLength(2);
  });

  it("runs drafts one at a time, in order", async () => {
    const { client: c, calls } = client([rowsReply(["first"]), rowsReply(["second"])]);
    const [a, b] = await Promise.all([
      c.draft(REQUEST),
      c.draft({ ...REQUEST, attempt: 1, previous: { rows: ["x"], violations: ["v"] } }),
    ]);
    expect(a).toMatchObject({ rows: ["first"] });
    expect(b).toMatchObject({ rows: ["second"] });
    expect(calls).toHaveLength(2);
  });

  it("never carries the error, its message or headers in a result (5.3)", async () => {
    const { client: c } = client([errorReply(401, `bad key ${KEY}`, { "x-echo": KEY })]);
    const result = await c.draft(REQUEST);
    expect(Object.keys(result).sort()).toEqual(["ok", "reason", "requests", "status"]);
    expect(JSON.stringify(result)).not.toContain(KEY);
  });
});
