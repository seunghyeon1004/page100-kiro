import type { CompileProblem } from "../compilers/compile-types.js";
import type { DraftRows, EditorialInput } from "../compilers/editorial-input.js";
import type { NonEmpty } from "../grid/types.js";
import type { CompiledPage } from "../pages/compiled-page.js";
import type { CallBudget } from "./call-budget.js";
import { checkEditorDraft } from "./check-editor-draft.js";
import type { DraftCache } from "./draft-cache.js";
import { draftRequest, replyRowsOf } from "./draft-request.js";
import type { DraftResult, EditorClient } from "./editor-types.js";
import type { PublishResult } from "./publish-page.js";

// editPage: the retry loop for one page (ai-editor requirement 9, design.md, "editPage").

export interface EditorDeps {
  readonly client: EditorClient;
  readonly budget: CallBudget;
  readonly cache: DraftCache;
  /** Receives only the log lines of design.md, "Logging". */
  readonly log: (line: string) => void;
}

/** One AI page, ready to edit. `publish` lays out rows and runs every page check. */
export interface PageJob {
  readonly input: EditorialInput;
  readonly rules: DraftRows;
  readonly publish: (rows: DraftRows, editor: "ai" | "rules") => PublishResult;
}

export type EditReason =
  | "accepted"
  | "cached"
  | "remembered"
  | "rejected"
  | "refused"
  | "no-budget"
  | "client-failed"
  | "stopped"
  | "no-slots";

export interface EditOutcome {
  readonly rows: DraftRows;
  readonly editor: "ai" | "rules";
  readonly reason: EditReason;
  /** The published page, or `null` when even the rules draft did not publish. */
  readonly page: CompiledPage | null;
  /** The problems of the rules draft when `page` is `null`. */
  readonly problems: readonly CompileProblem[];
  readonly accepted: number;
  readonly rejected: number;
  readonly requests: number;
  /** True after a rate-limit or authentication failure: no later page makes a call. */
  readonly stopEdition: boolean;
}

interface Tally {
  accepted: number;
  rejected: number;
  requests: number;
}

function say(deps: EditorDeps, line: string): void {
  try {
    deps.log(line);
  } catch {
    // A failing log sink must not stop the edition.
  }
}

function safePublish(job: PageJob, rows: DraftRows, editor: "ai" | "rules"): PublishResult {
  try {
    return job.publish(rows, editor);
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    return {
      ok: false,
      problems: [
        { code: "threw", subpage: null, row: null, col: null, message: `publish threw ${name}` },
      ],
    };
  }
}

/** The outcome that publishes the rules draft. */
function fallback(
  job: PageJob,
  reason: EditReason,
  tally: Tally,
  stopEdition: boolean,
): EditOutcome {
  const published = safePublish(job, job.rules, "rules");
  return {
    rows: job.rules,
    editor: "rules",
    reason,
    page: published.ok ? published.page : null,
    problems: published.ok ? [] : published.problems,
    ...tally,
    stopEdition,
  };
}

function failureText(result: Extract<DraftResult, { ok: false }>): string {
  const status = result.status === null ? "" : `, status ${String(result.status)}`;
  return `failed, ${result.reason}${status}`;
}

const RETRY_VIOLATION: Readonly<Record<"max-tokens" | "malformed", string>> = {
  "max-tokens": "reply stopped at the token limit",
  malformed: "reply was not a JSON object with a rows array",
};

async function run(
  job: PageJob,
  deps: EditorDeps,
  now: Date,
  stopped: boolean,
): Promise<EditOutcome> {
  const { input } = job;
  const page = input.page;
  const tally: Tally = { accepted: 0, rejected: 0, requests: 0 };

  if (input.slots.length === 0) {
    say(deps, `editor p${String(page)}: no slots`);
    return fallback(job, "no-slots", tally, false);
  }
  if (stopped) {
    say(deps, `editor p${String(page)}: stopped`);
    return fallback(job, "stopped", tally, true);
  }

  const cached = deps.cache.get(input);
  if (cached?.kind === "rejected") {
    say(deps, `editor p${String(page)}: remembered`);
    return fallback(job, "remembered", tally, false);
  }
  if (cached?.kind === "accepted") {
    const checked = checkEditorDraft(
      draftRequest(input, job.rules, 0, null),
      replyRowsOf(cached.rows),
    );
    if (checked.ok) {
      const published = safePublish(job, checked.rows, "ai");
      if (published.ok) {
        say(deps, `editor p${String(page)}: cached`);
        return {
          rows: checked.rows,
          editor: published.page.editor === "ai" ? "ai" : "rules",
          reason: "cached",
          page: published.page,
          problems: [],
          ...tally,
          stopEdition: false,
        };
      }
    }
    deps.cache.drop(input);
  }

  const state: { previous: { rows: readonly string[]; violations: NonEmpty<string> } | null } = {
    previous: null,
  };
  for (const attempt of [0, 1, 2] as const) {
    const reserved = deps.client.maxRequestsPerDraft;
    if (!deps.budget.tryReserve(reserved, now)) {
      say(deps, `editor p${String(page)}: no budget`);
      return fallback(job, "no-budget", tally, false);
    }
    const request = draftRequest(input, job.rules, attempt, state.previous);
    let result: DraftResult;
    try {
      result = await deps.client.draft(request);
    } catch {
      result = { ok: false, reason: "unknown", status: null, requests: reserved };
    }
    const used = Math.min(Math.max(result.requests, 0), reserved);
    deps.budget.settle(reserved, used);
    tally.requests += used;

    if (!result.ok) {
      say(deps, `editor p${String(page)} a${String(attempt)}: ${failureText(result)}`);
      switch (result.reason) {
        case "refusal":
          tally.rejected += 1;
          deps.cache.set(input, { kind: "rejected" });
          return fallback(job, "refused", tally, false);
        case "rate-limited":
        case "auth":
          return fallback(job, "client-failed", tally, true);
        case "max-tokens":
        case "malformed":
          tally.rejected += 1;
          state.previous = {
            rows: state.previous?.rows ?? [],
            violations: [RETRY_VIOLATION[result.reason]],
          };
          continue;
        default:
          return fallback(job, "client-failed", tally, false);
      }
    }

    const checked = checkEditorDraft(request, result.rows);
    let violations: NonEmpty<string>;
    if (checked.ok) {
      const published = safePublish(job, checked.rows, "ai");
      if (published.ok) {
        tally.accepted += 1;
        deps.cache.set(input, { kind: "accepted", rows: checked.rows });
        say(deps, `editor p${String(page)} a${String(attempt)}: accepted`);
        return {
          rows: checked.rows,
          editor: published.page.editor === "ai" ? "ai" : "rules",
          reason: "accepted",
          page: published.page,
          problems: [],
          ...tally,
          stopEdition: false,
        };
      }
      const [first, ...rest] = published.problems.map((p) => p.message);
      violations = [first ?? "page did not publish", ...rest];
    } else {
      violations = checked.violations;
    }
    tally.rejected += 1;
    say(
      deps,
      `editor p${String(page)} a${String(attempt)}: rejected, ${String(violations.length)} violations`,
    );
    state.previous = { rows: result.rows, violations };
  }

  deps.cache.set(input, { kind: "rejected" });
  return fallback(job, "rejected", tally, false);
}

/**
 * Edits one page: at most three drafts, then the rules draft. `stopped` is true when an earlier
 * page of the edition met a rate limit or authentication failure. Never throws.
 */
export async function editPage(
  job: PageJob,
  deps: EditorDeps,
  now: Date,
  stopped = false,
): Promise<EditOutcome> {
  try {
    return await run(job, deps, now, stopped);
  } catch {
    return fallback(job, "client-failed", { accepted: 0, rejected: 0, requests: 0 }, false);
  }
}
