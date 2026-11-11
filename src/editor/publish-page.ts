import { problemsOf } from "../compilers/compile-all.js";
import type { CompileProblem, CompileResult } from "../compilers/compile-types.js";
import type { NonEmpty } from "../grid/types.js";
import { toNonEmpty } from "../grid/non-empty.js";
import type { CompiledPage } from "../pages/compiled-page.js";
import { findPage } from "../pages/registry.js";

// Publishing an assembled page (ai-editor requirement 9.2, design.md, "AI pages"): the checks
// that `compileAll` applies to every page, then the editor mark.

export type PublishResult =
  | { readonly ok: true; readonly page: CompiledPage }
  | { readonly ok: false; readonly problems: NonEmpty<CompileProblem> };

function failure(message: string): PublishResult {
  return {
    ok: false,
    problems: [{ code: "page-check", subpage: null, row: null, col: null, message }],
  };
}

/**
 * `assembled` is what the page's `assemble` returned. On success the page carries `editor`
 * (`ai` for a draft), except a no-data page, which stays `rules`. Never throws.
 */
export function publishPage(
  number: number,
  assembled: CompileResult,
  now: Date,
  editor: "ai" | "rules",
): PublishResult {
  try {
    if (!assembled.ok) return { ok: false, problems: assembled.problems };
    const def = findPage(number);
    if (def === undefined) return failure(`page ${String(number)} is not in the registry`);
    const page: CompiledPage =
      assembled.outcome === "no-data" ? assembled.page : { ...assembled.page, editor };
    const problems = toNonEmpty(problemsOf(def, page, now));
    return problems === undefined ? { ok: true, page } : { ok: false, problems };
  } catch (error) {
    return failure(`publish threw ${error instanceof Error ? error.name : "unknown"}`);
  }
}
