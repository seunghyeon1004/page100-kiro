import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { DelayFn, FetchFn, HttpFailure, HttpResponse } from "../../src/sources/http.js";
import { MAX_BODY_BYTES, createHttpClient } from "../../src/sources/http.js";
import { USER_AGENT } from "../../src/sources/user-agent.js";
import { fakeResponse, hangingBody, neverResolves } from "./fake-http.js";

// A JSON string literal of exactly `size` bytes (size of at least 2), built once per size.
const bodies = new Map<number, Uint8Array>();
function jsonBody(size: number): Uint8Array {
  const cached = bodies.get(size);
  if (cached !== undefined) return cached;
  const bytes = new Uint8Array(size).fill(97);
  if (size >= 2) {
    bytes[0] = 34;
    bytes[size - 1] = 34;
  }
  bodies.set(size, bytes);
  return bytes;
}

type Behaviour =
  | { readonly kind: "reject" }
  | { readonly kind: "hang" }
  | { readonly kind: "hang-body" }
  | {
      readonly kind: "response";
      readonly status: number;
      readonly contentLength: number | null;
      readonly size: number;
      readonly retryAfter: string | null;
    };

const SIZES = [0, 2, 10, MAX_BODY_BYTES - 1, MAX_BODY_BYTES, MAX_BODY_BYTES + 1];

const behaviour: fc.Arbitrary<Behaviour> = fc.oneof(
  { weight: 1, arbitrary: fc.constant<Behaviour>({ kind: "reject" }) },
  { weight: 1, arbitrary: fc.constant<Behaviour>({ kind: "hang" }) },
  { weight: 1, arbitrary: fc.constant<Behaviour>({ kind: "hang-body" }) },
  {
    weight: 8,
    arbitrary: fc
      .record({
        status: fc.oneof(
          fc.integer({ min: 100, max: 599 }),
          fc.constantFrom(200, 404, 429, 500, 503),
        ),
        contentLength: fc.option(fc.constantFrom(...SIZES), { nil: null }),
        size: fc.constantFrom(...SIZES),
        retryAfter: fc.option(fc.constantFrom("0", "120", "soon"), { nil: null }),
      })
      .map((r): Behaviour => ({ kind: "response", ...r })),
  },
);

type Expected = { ok: true } | { ok: false; failure: HttpFailure };

/** What one attempt should give, written from requirements 10.3 to 10.6. */
function oracle(b: Behaviour): Expected {
  if (b.kind === "reject") return { ok: false, failure: { kind: "network" } };
  if (b.kind === "hang" || b.kind === "hang-body")
    return { ok: false, failure: { kind: "timeout" } };
  if (b.status === 429) {
    const ms = b.retryAfter === "0" ? 0 : b.retryAfter === "120" ? 120_000 : null;
    return { ok: false, failure: { kind: "rate-limited", retryAfterMs: ms } };
  }
  if (b.status < 200 || b.status > 299)
    return { ok: false, failure: { kind: "status", status: b.status } };
  if (b.contentLength !== null && b.contentLength > MAX_BODY_BYTES) {
    return { ok: false, failure: { kind: "too-large" } };
  }
  if (b.size > MAX_BODY_BYTES) return { ok: false, failure: { kind: "too-large" } };
  return { ok: true };
}

function retryable(e: Expected): boolean {
  if (e.ok) return false;
  const f = e.failure;
  return f.kind === "network" || f.kind === "timeout" || (f.kind === "status" && f.status >= 500);
}

function responseFor(b: Behaviour): Promise<HttpResponse> {
  if (b.kind === "reject") return Promise.reject(new Error("down"));
  if (b.kind === "hang") return neverResolves();
  if (b.kind === "hang-body") {
    const state = { pulled: false, cancelled: false };
    return Promise.resolve(fakeResponse({ status: 200, body: hangingBody(state) }));
  }
  const headers: Record<string, string> = {};
  if (b.contentLength !== null) headers["Content-Length"] = String(b.contentLength);
  if (b.retryAfter !== null) headers["Retry-After"] = b.retryAfter;
  const bytes = jsonBody(b.size);
  const half = Math.floor(bytes.length / 2);
  return Promise.resolve(
    fakeResponse({
      status: b.status,
      headers,
      chunks: [bytes.subarray(0, half), bytes.subarray(half)],
    }),
  );
}

interface Run {
  readonly requests: {
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly method: string;
    readonly credentials: string;
  }[];
  readonly waits: number[];
}

function run(behaviours: readonly [Behaviour, Behaviour]) {
  const state: Run = { requests: [], waits: [] };
  let timers = 0;
  const fetch: FetchFn = (url, init) => {
    const index = state.requests.length;
    state.requests.push({
      url,
      headers: init.headers,
      method: init.method,
      credentials: init.credentials,
    });
    const b = behaviours[index];
    return b === undefined ? Promise.reject(new Error("third attempt")) : responseFor(b);
  };
  const delay: DelayFn = (ms) => {
    state.waits.push(ms);
    if (ms !== 10_000) return Promise.resolve();
    timers += 1;
    const b = behaviours[timers - 1];
    const fires = b?.kind === "hang" || b?.kind === "hang-body";
    return fires ? Promise.resolve() : neverResolves();
  };
  return { http: createHttpClient({ fetch, delay }), state };
}

describe("HTTP client properties", () => {
  it("Property 10: every request resolves, makes at most 2 attempts with the right headers, and succeeds only for 2xx within the cap", async () => {
    await fc.assert(
      fc.asyncProperty(behaviour, behaviour, fc.boolean(), async (first, second, retry) => {
        const expectedFirst = oracle(first);
        const retried = retry && retryable(expectedFirst);
        const expectedFinal = retried ? oracle(second) : expectedFirst;
        const attempts = retried ? 2 : 1;

        for (const method of ["getText", "getJson"] as const) {
          const { http, state } = run([first, second]);
          const result = await http[method]("https://example.test/x", { retry });

          expect(result.attempts).toBe(attempts);
          expect(state.requests).toHaveLength(attempts);
          expect(state.waits.filter((ms) => ms === 30_000)).toHaveLength(retried ? 1 : 0);
          for (const request of state.requests) {
            expect(request.method).toBe("GET");
            expect(request.credentials).toBe("omit");
            expect(request.headers).toEqual({
              Accept: "application/json",
              "User-Agent": USER_AGENT,
            });
          }

          if (method === "getText") {
            expect(result.ok).toBe(expectedFinal.ok);
            if (!result.ok && !expectedFinal.ok)
              expect(result.failure).toEqual(expectedFinal.failure);
          } else if (result.ok) {
            expect(expectedFinal.ok).toBe(true);
          } else if (!expectedFinal.ok) {
            expect(result.failure).toEqual(expectedFinal.failure);
          } else {
            // The attempt succeeded as text, so the only failure left is a body that is not JSON.
            expect(result.failure).toEqual({ kind: "not-json" });
          }
        }
      }),
    );
  });
});
