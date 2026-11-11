// A scripted fetch for the SDK (ai-editor design.md, "Correctness properties"): the transport is
// replaced, the SDK is real. It records every request and answers from a list of replies.

export type Reply =
  | {
      readonly kind: "json";
      readonly status: number;
      readonly body: unknown;
      readonly headers?: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: "text";
      readonly status: number;
      readonly body: string;
      readonly headers?: Readonly<Record<string, string>>;
    }
  | { readonly kind: "throw"; readonly error: Error }
  | { readonly kind: "hang" };

export interface FetchCall {
  readonly url: string;
  readonly method: string;
  /** Header names in lower case. */
  readonly headers: Readonly<Record<string, string>>;
  readonly bodyText: string;
  /** The body parsed as JSON, or `null`. */
  readonly body: unknown;
}

/** An error response in the API's shape, with `retry-after-ms: 1` so SDK retries are almost immediate (the SDK ignores a value of 0 and backs off). */
export function errorReply(
  status: number,
  message = "error",
  extra: Record<string, string> = {},
): Reply {
  return {
    kind: "json",
    status,
    body: { type: "error", error: { type: "api_error", message } },
    headers: { "retry-after-ms": "1", ...extra },
  };
}

/** A Messages API response whose single text block is `text`. */
export function messageReply(text: string, stopReason = "end_turn", content?: unknown[]): Reply {
  return {
    kind: "json",
    status: 200,
    body: {
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "test-model",
      content: content ?? [{ type: "text", text }],
      stop_reason: stopReason,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    },
  };
}

/** A reply whose text is `{"rows": [...]}`. */
export function rowsReply(rows: readonly string[]): Reply {
  return messageReply(JSON.stringify({ rows }));
}

function headersOf(
  init: RequestInit | undefined,
  input: string | URL | Request,
): Record<string, string> {
  const out: Record<string, string> = {};
  const source = input instanceof Request ? input.headers : undefined;
  source?.forEach((value, name) => {
    out[name.toLowerCase()] = value;
  });
  new Headers(init?.headers).forEach((value, name) => {
    out[name.toLowerCase()] = value;
  });
  return out;
}

export function fakeFetch(replies: readonly Reply[]) {
  const calls: FetchCall[] = [];
  let next = 0;
  const fetchFn = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const bodyText = typeof init?.body === "string" ? init.body : "";
    let body: unknown = null;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = null;
    }
    calls.push({
      url: input instanceof Request ? input.url : String(input),
      method: init?.method ?? "GET",
      headers: headersOf(init, input),
      bodyText,
      body,
    });
    const reply = replies[next++];
    if (reply === undefined) return Promise.reject(new TypeError("fake fetch has no more replies"));
    switch (reply.kind) {
      case "json":
        return Promise.resolve(
          new Response(JSON.stringify(reply.body), {
            status: reply.status,
            headers: { "content-type": "application/json", ...reply.headers },
          }),
        );
      case "text":
        return Promise.resolve(
          new Response(reply.body, {
            status: reply.status,
            headers: { "content-type": "text/plain", ...reply.headers },
          }),
        );
      case "throw":
        return Promise.reject(reply.error);
      case "hang":
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const aborted = new Error("aborted");
            aborted.name = "AbortError";
            reject(aborted);
          });
        });
    }
  };
  return { fetch: fetchFn, calls };
}
