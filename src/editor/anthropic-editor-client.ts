import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { classifyError } from "./classify-error.js";
import { DraftReply } from "./editor-types.js";
import type { DraftRequest, DraftResult, EditorClient } from "./editor-types.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { userMessage } from "./user-message.js";

// The Anthropic client (ai-editor requirements 4 and 5, design.md, "Anthropic client"). The only
// file that constructs the SDK client. `draft` always resolves.

/** The shape of `fetch` that the SDK takes. The server passes the global `fetch`. */
export type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface AnthropicClientOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly fetch: FetchFunction;
  /** Per-request timeout; tests use a short one. */
  readonly timeoutMs?: number;
  /** SDK retries per request; production uses 1. A test raises it to show the request limit. */
  readonly maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_REQUESTS_PER_DRAFT = 2;
/** Fixed, so that an `ANTHROPIC_BASE_URL` in the environment cannot redirect the key. */
const BASE_URL = "https://api.anthropic.com";

export class AnthropicEditorClient implements EditorClient {
  readonly maxRequestsPerDraft = MAX_REQUESTS_PER_DRAFT;
  private readonly sdk: Anthropic;
  private readonly model: string;
  /** Drafts run one at a time, so one counter serves them all. */
  private readonly counter = { count: 0, limit: MAX_REQUESTS_PER_DRAFT };
  private tail: Promise<void> = Promise.resolve();

  constructor(options: AnthropicClientOptions) {
    this.model = options.model;
    const inner = options.fetch;
    const counter = this.counter;
    const counting: FetchFunction = (input, init) => {
      if (counter.count >= counter.limit) return Promise.reject(new TypeError("request limit"));
      counter.count += 1;
      return inner(input, init);
    };
    this.sdk = new Anthropic({
      apiKey: options.apiKey,
      baseURL: BASE_URL,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? 1,
      logLevel: "off",
      fetch: counting,
    });
  }

  draft(request: DraftRequest): Promise<DraftResult> {
    const result = this.tail.then(() => this.run(request));
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async run(request: DraftRequest): Promise<DraftResult> {
    this.counter.count = 0;
    try {
      const message = await this.sdk.messages.parse({
        model: this.model,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage(request) }],
        output_config: { effort: "low", format: zodOutputFormat(DraftReply) },
      });
      const requests = this.counter.count;
      // The stop reason is read before any output (requirement 5.1).
      if (message.stop_reason === "refusal") {
        return { ok: false, reason: "refusal", status: null, requests };
      }
      if (message.stop_reason === "max_tokens") {
        return { ok: false, reason: "max-tokens", status: null, requests };
      }
      if (message.stop_reason === "end_turn" && message.parsed_output !== null) {
        return { ok: true, rows: message.parsed_output.rows, requests };
      }
      return { ok: false, reason: "malformed", status: null, requests };
    } catch (error) {
      const { reason, status } = classifyError(error);
      return { ok: false, reason, status, requests: this.counter.count };
    }
  }
}
