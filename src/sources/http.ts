import { USER_AGENT } from "./user-agent.js";

/** Response bodies over this many bytes are rejected: 5 MiB (requirement 10.6). */
export const MAX_BODY_BYTES = 5_242_880;
export const REQUEST_TIMEOUT_MS = 10_000;
export const RETRY_DELAY_MS = 30_000;

export type HttpFailure =
  | { readonly kind: "network" }
  | { readonly kind: "timeout" }
  | { readonly kind: "status"; readonly status: number }
  | { readonly kind: "rate-limited"; readonly retryAfterMs: number | null }
  | { readonly kind: "too-large" }
  | { readonly kind: "not-json" };

/** The part of a `Response` the client reads. A real `Response` satisfies it. */
export interface HttpResponse {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  readonly body: ReadableStream<Uint8Array> | null;
}

export interface HttpRequestInit {
  readonly method: "GET";
  readonly headers: Readonly<Record<string, string>>;
  readonly credentials: "omit";
  readonly redirect: "follow";
  readonly signal: AbortSignal;
}

/** The injected `fetch`. */
export type FetchFn = (url: string, init: HttpRequestInit) => Promise<HttpResponse>;

/** Resolves after `ms`. Must never resolve once `signal` aborts. */
export type DelayFn = (ms: number, signal: AbortSignal) => Promise<void>;

export interface HttpClientDeps {
  readonly fetch: FetchFn;
  readonly delay: DelayFn;
  /** The User-Agent to send; defaults to `USER_AGENT` (server-and-viewer 5.9). */
  readonly userAgent?: string;
}

export interface RequestOptions {
  readonly retry: boolean;
}

export type HttpResult<T> =
  | {
      readonly ok: true;
      readonly url: string;
      readonly status: number;
      readonly attempts: 1 | 2;
      readonly body: T;
    }
  | {
      readonly ok: false;
      readonly url: string;
      readonly attempts: 1 | 2;
      readonly failure: HttpFailure;
    };

export interface HttpClient {
  getText(url: string, options: RequestOptions): Promise<HttpResult<string>>;
  getJson(url: string, options: RequestOptions): Promise<HttpResult<unknown>>;
}

/** A delay backed by `setTimeout`. Aborting the signal clears the timer, and the promise never resolves. */
export const realDelay: DelayFn = (ms, signal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
    });
  });

type Attempt =
  | { readonly ok: true; readonly status: number; readonly body: string }
  | { readonly ok: false; readonly failure: HttpFailure };

const NETWORK: Attempt = { ok: false, failure: { kind: "network" } };
const TIMEOUT: Attempt = { ok: false, failure: { kind: "timeout" } };
const TOO_LARGE: Attempt = { ok: false, failure: { kind: "too-large" } };

/** `Retry-After` as milliseconds: delta-seconds, or an HTTP-date minus the response `Date` (requirement 10.5). */
function retryAfterMs(response: HttpResponse): number | null {
  const value = response.headers.get("retry-after")?.trim();
  if (value === undefined) return null;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const at = Date.parse(value);
  const sent = Date.parse(response.headers.get("date") ?? "");
  if (!Number.isFinite(at) || !Number.isFinite(sent) || at - sent < 0) return null;
  return at - sent;
}

function discard(
  body: ReadableStream<Uint8Array> | ReadableStreamDefaultReader<Uint8Array> | null,
): void {
  if (body === null) return;
  try {
    void body.cancel().catch(() => undefined);
  } catch {
    // A locked or already closed stream has nothing left to cancel.
  }
}

function joinChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

export function createHttpClient(deps: HttpClientDeps): HttpClient {
  async function readBody(
    response: HttpResponse,
    timedOut: Promise<{ readonly kind: "timeout" }>,
    abort: AbortController,
  ): Promise<Attempt> {
    const { body } = response;
    if (body === null) return { ok: true, status: response.status, body: "" };
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const next = await Promise.race([
        reader.read().then(
          (result) => ({ kind: "chunk" as const, result }),
          () => ({ kind: "network" as const }),
        ),
        timedOut,
      ]);
      if (next.kind === "timeout") {
        abort.abort();
        discard(reader);
        return TIMEOUT;
      }
      if (next.kind === "network") return NETWORK;
      if (next.result.done) break;
      const chunk = next.result.value;
      total += chunk.byteLength;
      if (total > MAX_BODY_BYTES) {
        discard(reader);
        return TOO_LARGE;
      }
      chunks.push(chunk);
    }
    return {
      ok: true,
      status: response.status,
      body: new TextDecoder("utf-8").decode(joinChunks(chunks, total)),
    };
  }

  async function attemptOnce(url: string): Promise<Attempt> {
    const abort = new AbortController();
    const timerAbort = new AbortController();
    const timedOut = deps
      .delay(REQUEST_TIMEOUT_MS, timerAbort.signal)
      .then(() => ({ kind: "timeout" as const }));
    try {
      const sent = Promise.resolve()
        .then(() =>
          deps.fetch(url, {
            method: "GET",
            headers: { Accept: "application/json", "User-Agent": deps.userAgent ?? USER_AGENT },
            credentials: "omit",
            redirect: "follow",
            signal: abort.signal,
          }),
        )
        .then(
          (response) => ({ kind: "response" as const, response }),
          () => ({ kind: "network" as const }),
        );
      const first = await Promise.race([sent, timedOut]);
      if (first.kind === "timeout") {
        abort.abort();
        return TIMEOUT;
      }
      if (first.kind === "network") return NETWORK;

      const { response } = first;
      const { status } = response;
      if (status === 429) {
        discard(response.body);
        return {
          ok: false,
          failure: { kind: "rate-limited", retryAfterMs: retryAfterMs(response) },
        };
      }
      if (status < 200 || status > 299) {
        discard(response.body);
        return { ok: false, failure: { kind: "status", status } };
      }
      const length = response.headers.get("content-length")?.trim();
      if (length !== undefined && /^\d+$/.test(length) && Number(length) > MAX_BODY_BYTES) {
        discard(response.body);
        return TOO_LARGE;
      }
      return await readBody(response, timedOut, abort);
    } finally {
      timerAbort.abort();
    }
  }

  function retryable(failure: HttpFailure): boolean {
    return (
      failure.kind === "network" ||
      failure.kind === "timeout" ||
      (failure.kind === "status" && failure.status >= 500 && failure.status <= 599)
    );
  }

  async function getText(url: string, options: RequestOptions): Promise<HttpResult<string>> {
    let attempts: 1 | 2 = 1;
    let result = await attemptOnce(url);
    if (!result.ok && options.retry && retryable(result.failure)) {
      await deps.delay(RETRY_DELAY_MS, new AbortController().signal);
      attempts = 2;
      result = await attemptOnce(url);
    }
    return result.ok
      ? { ok: true, url, status: result.status, attempts, body: result.body }
      : { ok: false, url, attempts, failure: result.failure };
  }

  async function getJson(url: string, options: RequestOptions): Promise<HttpResult<unknown>> {
    const text = await getText(url, options);
    if (!text.ok) return text;
    try {
      const body: unknown = JSON.parse(text.body);
      return { ...text, body };
    } catch {
      return { ok: false, url, attempts: text.attempts, failure: { kind: "not-json" } };
    }
  }

  return { getText, getJson };
}
