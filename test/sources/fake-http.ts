import type { DelayFn, FetchFn, HttpRequestInit, HttpResponse } from "../../src/sources/http.js";

// Fakes for the injected `fetch` and `delay`. Tests never touch the network (requirement 18.2).

export interface FetchCall {
  readonly url: string;
  readonly init: HttpRequestInit;
}

/** A response built by hand, so that any status (including 1xx and 204) can be served. */
export function fakeResponse(options: {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly chunks?: readonly Uint8Array[] | null;
  readonly body?: ReadableStream<Uint8Array> | null;
}): HttpResponse {
  const lower = new Map(
    Object.entries(options.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v] as const),
  );
  let body: ReadableStream<Uint8Array> | null;
  if (options.body !== undefined) {
    body = options.body;
  } else if (options.chunks === null) {
    body = null;
  } else {
    const chunks = options.chunks ?? [];
    body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
  }
  return {
    status: options.status,
    headers: { get: (name) => lower.get(name.toLowerCase()) ?? null },
    body,
  };
}

export function textResponse(
  status: number,
  text: string,
  headers: Readonly<Record<string, string>> = {},
): HttpResponse {
  return fakeResponse({ status, headers, chunks: [new TextEncoder().encode(text)] });
}

/** A stream that never produces a chunk and records whether anything asked for one. */
export function hangingBody(state: { pulled: boolean; cancelled: boolean }) {
  return new ReadableStream<Uint8Array>({
    pull() {
      state.pulled = true;
      return new Promise<void>(() => undefined);
    },
    cancel() {
      state.cancelled = true;
    },
  });
}

/** A fetch that serves the handlers in order, one per call, and records every call. */
export function sequenceFetch(handlers: readonly (() => Promise<HttpResponse>)[]): {
  fetch: FetchFn;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetch: FetchFn = (url, init) => {
    calls.push({ url, init });
    const handler = handlers[calls.length - 1];
    if (handler === undefined) return Promise.reject(new Error("unexpected extra request"));
    return handler();
  };
  return { fetch, calls };
}

export const neverResolves = (): Promise<never> => new Promise<never>(() => undefined);

/**
 * A delay for the client. The 30 s retry wait resolves at once. The 10 s timer fires on the
 * attempts listed in `timeoutOnAttempts` (1-based, in the order the client starts them) and
 * otherwise never resolves.
 */
export function fakeDelay(timeoutOnAttempts: readonly number[] = []): {
  delay: DelayFn;
  waits: number[];
} {
  const waits: number[] = [];
  let timers = 0;
  const delay: DelayFn = (ms) => {
    waits.push(ms);
    if (ms === 10_000) {
      timers += 1;
      return timeoutOnAttempts.includes(timers) ? Promise.resolve() : neverResolves();
    }
    return Promise.resolve();
  };
  return { delay, waits };
}
