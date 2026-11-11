import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AnthropicError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import type { DraftFailureReason } from "./editor-types.js";

// Error classification (ai-editor requirement 5.2). Only a reason and a status leave this
// function: the error, its message, headers and body are dropped (requirement 5.3).

export interface ClassifiedError {
  readonly reason: DraftFailureReason;
  readonly status: number | null;
}

function statusOf(error: unknown): number | null {
  if (!(error instanceof APIError)) return null;
  const status: unknown = error.status;
  return typeof status === "number" && Number.isInteger(status) ? status : null;
}

/** Most specific class first: each of these has a parent that is also tested. */
export function classifyError(error: unknown): ClassifiedError {
  const status = statusOf(error);
  if (error instanceof RateLimitError) return { reason: "rate-limited", status };
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return { reason: "auth", status };
  }
  if (error instanceof APIConnectionTimeoutError) return { reason: "timeout", status: null };
  if (error instanceof APIConnectionError) return { reason: "connection", status: null };
  if (error instanceof APIError && status !== null) return { reason: "status", status };
  if (error instanceof AnthropicError) return { reason: "malformed", status };
  return { reason: "unknown", status: null };
}
