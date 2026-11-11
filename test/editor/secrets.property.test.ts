import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AnthropicEditorClient } from "../../src/editor/anthropic-editor-client.js";
import { createCallBudget } from "../../src/editor/call-budget.js";
import { createDraftCache } from "../../src/editor/draft-cache.js";
import type { DraftRequest } from "../../src/editor/editor-types.js";
import { emptyEditorStatus, runEdition } from "../../src/editor/run-edition.js";
import { NOW, SNAPSHOT } from "../compilers/boot-snapshot.js";
import { errorReply, fakeFetch, messageReply } from "./fake-fetch.js";
import type { Reply } from "./fake-fetch.js";

// Property 6 (ai-editor design.md). The SDK is real; the transport is scripted to fail in every
// way the design lists, with the key placed in every part of the failure that it could leak from.

const apiKey = fc.stringMatching(/^[A-Za-z0-9_-]{20,100}$/).map((rest) => `sk-ant-${rest}`);

type Kind =
  "http-error" | "throw-message" | "throw-cause" | "cut-off" | "not-json" | "refusal" | "timeout";

interface Script {
  readonly kind: Kind;
  readonly status: number;
}

const script: fc.Arbitrary<Script> = fc.record({
  kind: fc.constantFrom<Kind>(
    "http-error",
    "throw-message",
    "throw-cause",
    "cut-off",
    "not-json",
    "refusal",
    "timeout",
  ),
  status: fc.integer({ min: 400, max: 529 }),
});

function replyFor(s: Script, key: string): Reply {
  switch (s.kind) {
    case "http-error":
      return errorReply(s.status, `invalid credentials ${key}`, {
        "x-echo": key,
        "request-id": key,
        "www-authenticate": `Bearer ${key}`,
      });
    case "throw-message":
      return { kind: "throw", error: new TypeError(`fetch failed for ${key}`) };
    case "throw-cause":
      return { kind: "throw", error: new Error("network down", { cause: new Error(key) }) };
    case "cut-off":
      return messageReply(`{"rows":["${key}`, "max_tokens");
    case "not-json":
      return { kind: "text", status: 200, body: `<html>${key}</html>` };
    case "refusal":
      return messageReply(`I cannot help with ${key}`, "refusal");
    case "timeout":
      return { kind: "hang" };
  }
}

/** Runs `fn` while recording everything written through `console`, `process.stdout` and `process.stderr`. */
async function capturing<T>(fn: () => Promise<T>): Promise<{ value: T; output: string[] }> {
  const output: string[] = [];
  const consoleNames = ["log", "info", "warn", "error", "debug"] as const;
  const record = (...args: unknown[]): void => {
    output.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  // Properties are read and written with Reflect, so no method is taken off its object.
  const savedConsole = consoleNames.map((name): unknown => Reflect.get(console, name));
  for (const name of consoleNames) {
    Reflect.set(console, name, (...args: unknown[]) => {
      record(...args);
    });
  }
  const streams = [process.stdout, process.stderr];
  const savedWrites = streams.map((stream): unknown => Reflect.get(stream, "write"));
  streams.forEach((stream, i) => {
    const original = savedWrites[i];
    Reflect.set(stream, "write", (chunk: unknown, ...rest: unknown[]): boolean => {
      record(chunk);
      return typeof original === "function"
        ? Boolean(Reflect.apply(original, stream, [chunk, ...rest]))
        : true;
    });
  });
  try {
    return { value: await fn(), output };
  } finally {
    consoleNames.forEach((name, i) => {
      Reflect.set(console, name, savedConsole[i]);
    });
    streams.forEach((stream, i) => {
      Reflect.set(stream, "write", savedWrites[i]);
    });
  }
}

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

describe("secret properties", () => {
  it("the capture used below sees console calls and stream writes (it is not blind)", async () => {
    const { output } = await capturing(() => {
      console.log("via console");
      process.stderr.write("via stderr\n");
      return Promise.resolve();
    });
    expect(output.join("\n")).toContain("via console");
    expect(output.join("\n")).toContain("via stderr");
  });

  it("Property 6: the API key reaches no log line, console or stream write, result, outcome or status, and the transport sees it only in the authorization header", async () => {
    await fc.assert(
      fc.asyncProperty(
        apiKey,
        fc.array(script, { minLength: 1, maxLength: 6 }),
        async (key, scripts) => {
          const replies = Array.from({ length: 80 }, (_, i): Reply => {
            const one = scripts[i % scripts.length];
            return one === undefined ? errorReply(500) : replyFor(one, key);
          });
          const fake = fakeFetch(replies);
          // A thrown fetch error is retried by the SDK after a pause, so those scripts use no retry.
          const quick = scripts.some((s) => s.kind.startsWith("throw") || s.kind === "timeout");
          const client = new AnthropicEditorClient({
            apiKey: key,
            model: "test-model",
            fetch: fake.fetch,
            timeoutMs: 5,
            maxRetries: quick ? 0 : 1,
          });
          const lines: string[] = [];
          const { value, output } = await capturing(async () => {
            const direct = await client.draft(REQUEST);
            const edition = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, {
              client,
              budget: createCallBudget(60, 60),
              cache: createDraftCache(),
              log: (line) => lines.push(line),
            });
            return { direct, edition };
          });

          expect(lines.join("\n")).not.toContain(key);
          expect(output.join("\n")).not.toContain(key);
          expect(JSON.stringify(value.direct)).not.toContain(key);
          expect(JSON.stringify(value.edition.outcomes)).not.toContain(key);
          expect(JSON.stringify(value.edition.status)).not.toContain(key);
          expect(JSON.stringify(value.edition.pages)).not.toContain(key);

          expect(fake.calls.length).toBeGreaterThan(0);
          for (const call of fake.calls) {
            const carrying = Object.entries(call.headers)
              .filter(([, v]) => v.includes(key))
              .map(([name]) => name);
            expect(carrying).toEqual(["authorization"]);
            expect(call.bodyText).not.toContain(key);
            expect(call.url).not.toContain(key);
          }
        },
      ),
    );
  }, 120_000);
});
