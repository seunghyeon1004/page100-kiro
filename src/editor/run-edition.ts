import type { CompileProblem } from "../compilers/compile-types.js";
import type { NonEmpty } from "../grid/types.js";
import { toNonEmpty } from "../grid/non-empty.js";
import type { CompiledPage } from "../pages/compiled-page.js";
import type { Snapshot } from "../sources/snapshot.js";
import { AI_PAGES, jobFor } from "./ai-pages.js";
import { editPage } from "./edit-page.js";
import type { EditOutcome, EditReason, EditorDeps } from "./edit-page.js";

// runEdition: one pass over the twelve AI pages (ai-editor requirement 12, design.md, "Budget,
// cache and status"). Reads no clock: `now` is the edition time.

export interface EditorStatus {
  /** `YYYY-MM-DD` (UTC) of the day `accepted` and `rejected` count; `""` before the first edition. */
  readonly day: string;
  readonly callsToday: number;
  readonly capPerDay: number;
  readonly callsThisBoot: number;
  readonly capPerBoot: number;
  /** Drafts accepted and rejected on `day`. */
  readonly accepted: number;
  readonly rejected: number;
  /** The AI pages the last edition published with the rules draft. */
  readonly fallbackPages: readonly number[];
}

export type EditionOutcome =
  | { readonly number: number; readonly editor: "ai" | "rules"; readonly reason: EditReason }
  | { readonly number: number; readonly outcome: "failed"; readonly codes: NonEmpty<string> };

export interface EditionResult {
  readonly pages: readonly CompiledPage[];
  readonly outcomes: readonly EditionOutcome[];
  readonly status: EditorStatus;
}

export function emptyEditorStatus(): EditorStatus {
  return {
    day: "",
    callsToday: 0,
    capPerDay: 0,
    callsThisBoot: 0,
    capPerBoot: 0,
    accepted: 0,
    rejected: 0,
    fallbackPages: [],
  };
}

function dayOf(now: Date): string | null {
  const ms = now.getTime();
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

function codesOf(problems: readonly CompileProblem[]): NonEmpty<string> {
  const codes = [...new Set(problems.map((p) => p.code))];
  return toNonEmpty(codes) ?? ["page-check"];
}

function summary(pages: number, calls: number, accepted: number, rejected: number): string {
  return `editor edition: ${String(pages)} pages, ${String(calls)} calls, ${String(accepted)} accepted, ${String(rejected)} rejected`;
}

/**
 * Edits every AI page of the snapshot, one draft call at a time. A page whose rules draft does not
 * publish is `failed` and left out; no other page changes. Never throws.
 */
export async function runEdition(
  snapshot: Snapshot,
  status: EditorStatus,
  now: Date,
  deps: EditorDeps,
): Promise<EditionResult> {
  const pages: CompiledPage[] = [];
  const outcomes: EditionOutcome[] = [];
  const fallbackPages: number[] = [];
  let accepted = 0;
  let rejected = 0;
  let calls = 0;
  let stopped = false;

  for (const aiPage of AI_PAGES) {
    let outcome: EditOutcome;
    try {
      outcome = await editPage(jobFor(aiPage, snapshot, now), deps, now, stopped);
    } catch {
      outcomes.push({ number: aiPage.number, outcome: "failed", codes: ["threw"] });
      continue;
    }
    accepted += outcome.accepted;
    rejected += outcome.rejected;
    calls += outcome.requests;
    stopped = stopped || outcome.stopEdition;
    if (outcome.page === null) {
      outcomes.push({ number: aiPage.number, outcome: "failed", codes: codesOf(outcome.problems) });
      continue;
    }
    pages.push(outcome.page);
    outcomes.push({ number: aiPage.number, editor: outcome.editor, reason: outcome.reason });
    if (outcome.page.editor === "rules") fallbackPages.push(aiPage.number);
  }

  try {
    deps.cache.endEdition();
    deps.log(summary(pages.length, calls, accepted, rejected));
  } catch {
    // The edition result stands even if the cache or the log sink fails.
  }

  const today = dayOf(now);
  const sameDay = today === null || today === status.day;
  let usage = {
    day: status.day as string | null,
    callsToday: status.callsToday,
    capPerDay: status.capPerDay,
    callsThisBoot: status.callsThisBoot,
    capPerBoot: status.capPerBoot,
  };
  try {
    usage = deps.budget.usage(now);
  } catch {
    // Keep the numbers of the previous status.
  }
  return {
    pages,
    outcomes,
    status: {
      day: today ?? status.day,
      callsToday: usage.callsToday,
      capPerDay: usage.capPerDay,
      callsThisBoot: usage.callsThisBoot,
      capPerBoot: usage.capPerBoot,
      accepted: (sameDay ? status.accepted : 0) + accepted,
      rejected: (sameDay ? status.rejected : 0) + rejected,
      fallbackPages,
    },
  };
}
