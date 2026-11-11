import { rulesDraft } from "../../src/compilers/editorial-input.js";
import { replyRowsOf } from "../../src/editor/draft-request.js";
import type {
  DraftFailureReason,
  DraftRequest,
  DraftResult,
  EditorClient,
} from "../../src/editor/editor-types.js";

// A scripted EditorClient: the one thing the editor tests replace (the draft checks, the budget,
// editPage and the page checks are always real). It answers from a list of steps and records
// every request it gets.

export type Step =
  | { readonly kind: "rows"; readonly rows: readonly string[]; readonly requests?: number }
  | {
      readonly kind: "from";
      readonly make: (request: DraftRequest) => readonly string[];
      readonly requests?: number;
    }
  | {
      readonly kind: "fail";
      readonly reason: DraftFailureReason;
      readonly status?: number | null;
      readonly requests?: number;
    }
  | { readonly kind: "throw" }
  | { readonly kind: "reject" };

/** The rows the rules draft gives for a request's own slots, in reply form. */
export function echoRules(request: DraftRequest): string[] {
  return replyRowsOf(
    rulesDraft({
      page: request.page,
      totalRows: request.totalRows,
      slots: request.slots.map((s) => ({
        id: s.id,
        mode: s.mode,
        text: s.text,
        maxRows: s.maxRows,
        width: s.width,
      })),
    }),
  );
}

export class ScriptedClient implements EditorClient {
  readonly calls: DraftRequest[] = [];
  /** The requests each answer reported; a throw or rejection counts as the whole reservation. */
  readonly reported: number[] = [];
  private next = 0;

  constructor(
    private readonly steps: readonly Step[],
    readonly maxRequestsPerDraft = 2,
  ) {}

  draft(request: DraftRequest): Promise<DraftResult> {
    this.calls.push(request);
    const step = this.steps[this.next++];
    if (step === undefined) {
      this.reported.push(1);
      return Promise.resolve({ ok: false, reason: "unknown", status: null, requests: 1 });
    }
    switch (step.kind) {
      case "rows":
        this.reported.push(step.requests ?? 1);
        return Promise.resolve({ ok: true, rows: step.rows, requests: step.requests ?? 1 });
      case "from":
        this.reported.push(step.requests ?? 1);
        return Promise.resolve({
          ok: true,
          rows: step.make(request),
          requests: step.requests ?? 1,
        });
      case "fail":
        this.reported.push(step.requests ?? 1);
        return Promise.resolve({
          ok: false,
          reason: step.reason,
          status: step.status ?? null,
          requests: step.requests ?? 1,
        });
      case "throw":
        this.reported.push(this.maxRequestsPerDraft);
        throw new Error("scripted throw");
      case "reject":
        this.reported.push(this.maxRequestsPerDraft);
        return Promise.reject(new Error("scripted rejection"));
    }
  }
}

/** A step that answers with the rules draft of the request. */
export const echo: Step = { kind: "from", make: echoRules };

/** Steps by page number: a separate script for each page, as `runEdition` needs. */
export class PagedClient implements EditorClient {
  readonly calls: DraftRequest[] = [];
  private readonly clients = new Map<number, ScriptedClient>();

  constructor(
    private readonly steps: ReadonlyMap<number, readonly Step[]>,
    readonly maxRequestsPerDraft = 2,
  ) {}

  /** The requests reported by every answer so far. */
  get made(): number {
    return [...this.clients.values()].reduce(
      (sum, c) => sum + c.reported.reduce((a, b) => a + b, 0),
      0,
    );
  }

  draft(request: DraftRequest): Promise<DraftResult> {
    this.calls.push(request);
    let client = this.clients.get(request.page);
    if (client === undefined) {
      client = new ScriptedClient(this.steps.get(request.page) ?? [], this.maxRequestsPerDraft);
      this.clients.set(request.page, client);
    }
    return client.draft(request);
  }
}
