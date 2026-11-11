import type { DraftRequest, DraftResult, EditorClient } from "../../src/editor/editor-types.js";
import { userMessage } from "../../src/editor/user-message.js";

// Wraps an EditorClient and keeps what each request asked and what came back (ai-editor design.md,
// "Fixtures and recording"). Only the rebuilt user message and the result are kept: no header, key
// or SDK object is ever held.

export interface RecordedAttempt {
  readonly request: DraftRequest;
  readonly user: string;
  readonly result: DraftResult;
}

export interface RecordingClient extends EditorClient {
  readonly recorded: readonly RecordedAttempt[];
}

export function recordingClient(inner: EditorClient): RecordingClient {
  const recorded: RecordedAttempt[] = [];
  return {
    maxRequestsPerDraft: inner.maxRequestsPerDraft,
    recorded,
    async draft(request) {
      const result = await inner.draft(request);
      recorded.push({ request, user: userMessage(request), result });
      return result;
    },
  };
}

/** True when the text holds the key, `x-api-key` or `authorization` (any case): ai-editor 14.3. */
export function containsSecret(text: string, key: string): boolean {
  const lower = text.toLowerCase();
  return (
    (key !== "" && text.includes(key)) ||
    lower.includes("x-api-key") ||
    lower.includes("authorization")
  );
}
