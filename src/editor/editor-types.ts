import { z } from "zod";
import type { NonEmpty } from "../grid/types.js";

// The types the AI editor shares (ai-editor design.md, "Types"). Nothing here runs.

/** One piece of text the editor may rewrite, as the request describes it. */
export interface RequestSlot {
  readonly id: string;
  readonly mode: "headline" | "body";
  readonly maxRows: number;
  readonly width: number;
  /** True for a slot to which the rules draft gives zero rows: the draft may leave it empty. */
  readonly optional: boolean;
  /** Source text, folded into the repertoire. */
  readonly text: string;
}

/** What a client is asked to draft: one page, and on attempts 1 and 2 the draft that was rejected. */
export interface DraftRequest {
  readonly page: number;
  readonly totalRows: number;
  readonly slots: readonly RequestSlot[];
  readonly inputKey: string;
  readonly attempt: 0 | 1 | 2;
  readonly previous: {
    readonly rows: readonly string[];
    readonly violations: NonEmpty<string>;
  } | null;
}

export type DraftFailureReason =
  | "refusal"
  | "max-tokens"
  | "malformed"
  | "rate-limited"
  | "auth"
  | "status"
  | "timeout"
  | "connection"
  | "unknown"
  | "no-fixture";

/** `requests` is the number of calls made; `status` is an HTTP status or `null`. */
export type DraftResult =
  | { readonly ok: true; readonly rows: readonly string[]; readonly requests: number }
  | {
      readonly ok: false;
      readonly reason: DraftFailureReason;
      readonly status: number | null;
      readonly requests: number;
    };

/** A client never rejects: every failure is a `DraftResult` with `ok: false` (requirement 5.4). */
export interface EditorClient {
  readonly maxRequestsPerDraft: number;
  draft(request: DraftRequest): Promise<DraftResult>;
}

/** The reply the model is asked for. */
export const DraftReply = z.object({ rows: z.array(z.string()) });
export type DraftReply = z.infer<typeof DraftReply>;

/** The settings the server spec builds from the environment (requirement 2.4). */
export interface EditorSettings {
  readonly anthropicApiKey: string | null;
  readonly editorModel: string;
  readonly maxModelCallsPerDay: number;
  readonly editorMaxCallsPerBoot: number;
  readonly editorClient: "auto" | "fixtures";
}
