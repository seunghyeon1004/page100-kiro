import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, createHttpClient } from "../../src/sources/http.js";
import { PACKAGE_VERSION, USER_AGENT } from "../../src/sources/user-agent.js";
import {
  fakeDelay,
  fakeResponse,
  hangingBody,
  neverResolves,
  sequenceFetch,
  textResponse,
} from "./fake-http.js";

const URL = "https://example.test/data.json";

function client(
  handlers: Parameters<typeof sequenceFetch>[0],
  timeoutOnAttempts: readonly number[] = [],
) {
  const { fetch, calls } = sequenceFetch(handlers);
  const { delay, waits } = fakeDelay(timeoutOnAttempts);
  return { http: createHttpClient({ fetch, delay }), calls, waits };
}

describe("createHttpClient (requirement 10)", () => {
  it("sends GET with credentials omit and exactly the Accept and User-Agent headers (10.2)", async () => {
    const { http, calls } = client([() => Promise.resolve(textResponse(200, "{}"))]);
    await http.getText(URL, { retry: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(URL);
    expect(calls[0]?.init.method).toBe("GET");
    expect(calls[0]?.init.credentials).toBe("omit");
    expect(calls[0]?.init.headers).toEqual({
      Accept: "application/json",
      "User-Agent":
        "Page100/0.1.0 (teletext revival, Kiroween 2026; +https://github.com/seunghyeon1004/page100-kiro)",
    });
  });

  it("keeps PACKAGE_VERSION equal to package.json and puts it in the User-Agent (10.2)", () => {
    const pkg: unknown = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "..", "..", "package.json"), "utf8"),
    );
    expect(pkg).toMatchObject({ version: PACKAGE_VERSION });
    expect(USER_AGENT.startsWith(`Page100/${PACKAGE_VERSION} `)).toBe(true);
  });

  it("returns the body of a 200 (10.1)", async () => {
    const { http } = client([() => Promise.resolve(textResponse(200, '{"a":1}'))]);
    expect(await http.getText(URL, { retry: true })).toEqual({
      ok: true,
      url: URL,
      status: 200,
      attempts: 1,
      body: '{"a":1}',
    });
  });

  it("parses JSON for getJson", async () => {
    const { http } = client([() => Promise.resolve(textResponse(200, '{"a":[1,2]}'))]);
    expect(await http.getJson(URL, { retry: false })).toEqual({
      ok: true,
      url: URL,
      status: 200,
      attempts: 1,
      body: { a: [1, 2] },
    });
  });

  it("reports not-json when the body does not parse (10.6)", async () => {
    const { http } = client([() => Promise.resolve(textResponse(200, "<html>"))]);
    expect(await http.getJson(URL, { retry: true })).toEqual({
      ok: false,
      url: URL,
      attempts: 1,
      failure: { kind: "not-json" },
    });
  });

  it("makes one attempt on a 404 even with retry (10.4, 10.6)", async () => {
    const { http, calls, waits } = client([() => Promise.resolve(textResponse(404, "no"))]);
    expect(await http.getText(URL, { retry: true })).toEqual({
      ok: false,
      url: URL,
      attempts: 1,
      failure: { kind: "status", status: 404 },
    });
    expect(calls).toHaveLength(1);
    expect(waits).not.toContain(30_000);
  });

  it("retries once after a 503, waiting 30 s (10.4)", async () => {
    const { http, calls, waits } = client([
      () => Promise.resolve(textResponse(503, "busy")),
      () => Promise.resolve(textResponse(200, "ok")),
    ]);
    const result = await http.getText(URL, { retry: true });
    expect(result).toEqual({ ok: true, url: URL, status: 200, attempts: 2, body: "ok" });
    expect(calls).toHaveLength(2);
    expect(waits.filter((ms) => ms === 30_000)).toHaveLength(1);
  });

  it("does not retry a 503 when retry is false (10.4)", async () => {
    const { http, calls, waits } = client([() => Promise.resolve(textResponse(503, "busy"))]);
    const result = await http.getText(URL, { retry: false });
    expect(result).toMatchObject({
      ok: false,
      attempts: 1,
      failure: { kind: "status", status: 503 },
    });
    expect(calls).toHaveLength(1);
    expect(waits).not.toContain(30_000);
  });

  it("never makes a third attempt (10.4)", async () => {
    const { http, calls } = client([
      () => Promise.resolve(textResponse(500, "x")),
      () => Promise.resolve(textResponse(502, "x")),
    ]);
    const result = await http.getText(URL, { retry: true });
    expect(result).toMatchObject({
      ok: false,
      attempts: 2,
      failure: { kind: "status", status: 502 },
    });
    expect(calls).toHaveLength(2);
  });

  it("retries a network error once (10.4)", async () => {
    const { http, calls } = client([
      () => Promise.reject(new Error("down")),
      () => Promise.resolve(textResponse(200, "up")),
    ]);
    expect(await http.getText(URL, { retry: true })).toMatchObject({ ok: true, attempts: 2 });
    expect(calls).toHaveLength(2);
  });

  it("reports network for a rejection without retry", async () => {
    const { http } = client([() => Promise.reject(new Error("down"))]);
    expect(await http.getText(URL, { retry: false })).toEqual({
      ok: false,
      url: URL,
      attempts: 1,
      failure: { kind: "network" },
    });
  });

  it("reports timeout when no response arrives within 10 s, and retries once (10.3, 10.4)", async () => {
    const { http, calls, waits } = client([neverResolves, neverResolves], [1, 2]);
    const result = await http.getText(URL, { retry: true });
    expect(result).toEqual({
      ok: false,
      url: URL,
      attempts: 2,
      failure: { kind: "timeout" },
    });
    expect(calls).toHaveLength(2);
    expect(waits).toEqual([10_000, 30_000, 10_000]);
  });

  it("reports timeout when the body stalls (10.3)", async () => {
    const state = { pulled: false, cancelled: false };
    const { http } = client(
      [() => Promise.resolve(fakeResponse({ status: 200, body: hangingBody(state) }))],
      [1],
    );
    const result = await http.getText(URL, { retry: false });
    expect(result).toMatchObject({ ok: false, failure: { kind: "timeout" } });
  });

  describe("429 (requirement 10.5)", () => {
    it("reads delta-seconds and does not retry", async () => {
      const { http, calls } = client([
        () => Promise.resolve(textResponse(429, "slow", { "Retry-After": "120" })),
      ]);
      const result = await http.getText(URL, { retry: true });
      expect(result).toEqual({
        ok: false,
        url: URL,
        attempts: 1,
        failure: { kind: "rate-limited", retryAfterMs: 120_000 },
      });
      expect(calls).toHaveLength(1);
    });

    it("reads an HTTP-date relative to the response Date header", async () => {
      const { http } = client([
        () =>
          Promise.resolve(
            textResponse(429, "slow", {
              "Retry-After": "Wed, 11 Nov 2026 14:07:00 GMT",
              Date: "Wed, 11 Nov 2026 14:05:00 GMT",
            }),
          ),
      ]);
      expect(await http.getText(URL, { retry: false })).toMatchObject({
        failure: { kind: "rate-limited", retryAfterMs: 120_000 },
      });
    });

    it.each([
      ["soon", {}],
      ["", {}],
      ["Wed, 11 Nov 2026 14:07:00 GMT", {}],
      ["Wed, 11 Nov 2026 14:00:00 GMT", { Date: "Wed, 11 Nov 2026 14:05:00 GMT" }],
    ])("gives null for Retry-After %j", async (value, extra) => {
      const { http } = client([
        () => Promise.resolve(textResponse(429, "slow", { "Retry-After": value, ...extra })),
      ]);
      expect(await http.getText(URL, { retry: false })).toMatchObject({
        failure: { kind: "rate-limited", retryAfterMs: null },
      });
    });

    it("gives null with no Retry-After header", async () => {
      const { http } = client([() => Promise.resolve(textResponse(429, "slow"))]);
      expect(await http.getText(URL, { retry: false })).toMatchObject({
        failure: { kind: "rate-limited", retryAfterMs: null },
      });
    });
  });

  describe("size cap (requirement 10.6)", () => {
    it("rejects Content-Length 5,242,881 and cancels the body", async () => {
      const state = { pulled: false, cancelled: false };
      const { http } = client([
        () =>
          Promise.resolve(
            fakeResponse({
              status: 200,
              headers: { "Content-Length": String(MAX_BODY_BYTES + 1) },
              body: hangingBody(state),
            }),
          ),
      ]);
      expect(await http.getText(URL, { retry: true })).toMatchObject({
        ok: false,
        attempts: 1,
        failure: { kind: "too-large" },
      });
      expect(state.cancelled).toBe(true);
    });

    it("rejects a stream of 5,242,881 bytes with no Content-Length", async () => {
      const big = new Uint8Array(MAX_BODY_BYTES + 1).fill(97);
      const { http } = client([
        () =>
          Promise.resolve(
            fakeResponse({
              status: 200,
              chunks: [big.subarray(0, 1_000_000), big.subarray(1_000_000)],
            }),
          ),
      ]);
      expect(await http.getText(URL, { retry: true })).toMatchObject({
        ok: false,
        failure: { kind: "too-large" },
      });
    });

    it("accepts exactly 5,242,880 bytes", async () => {
      const exact = new Uint8Array(MAX_BODY_BYTES).fill(97);
      const { http } = client([
        () =>
          Promise.resolve(
            fakeResponse({
              status: 200,
              headers: { "Content-Length": String(MAX_BODY_BYTES) },
              chunks: [exact],
            }),
          ),
      ]);
      const result = await http.getText(URL, { retry: true });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.body).toHaveLength(MAX_BODY_BYTES);
    });
  });

  it("treats a 2xx with no body stream as an empty body", async () => {
    const { http } = client([() => Promise.resolve(fakeResponse({ status: 204, chunks: null }))]);
    expect(await http.getText(URL, { retry: false })).toMatchObject({ ok: true, body: "" });
  });

  it("treats 1xx and 3xx as status failures", async () => {
    for (const status of [100, 304]) {
      const { http } = client([() => Promise.resolve(textResponse(status, ""))]);
      expect(await http.getText(URL, { retry: false })).toMatchObject({
        ok: false,
        failure: { kind: "status", status },
      });
    }
  });
});
