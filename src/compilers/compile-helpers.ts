import { foldText } from "../grid/fold-text.js";
import { toNonEmpty } from "../grid/non-empty.js";
import type { NonEmpty } from "../grid/types.js";
import type { CompiledPage, Subpage } from "../pages/compiled-page.js";
import type { EditorKind } from "../pages/page-def.js";
import { findPage } from "../pages/registry.js";
import type { CellStyle } from "./cell-style.js";
import type { CompileProblem, CompileResult } from "./compile-types.js";
import type { BuildResult } from "./content-builder.js";

// Small helpers shared by the page compilers.

export const YELLOW: CellStyle = { fg: "yellow", bg: "black" };
export const CYAN: CellStyle = { fg: "cyan", bg: "black" };
export const WHITE: CellStyle = { fg: "white", bg: "black" };
export const GREEN: CellStyle = { fg: "green", bg: "black" };
export const RED: CellStyle = { fg: "red", bg: "black" };

/** The text folded into the repertoire, or `undefined` when it does not fold (requirement 7.4). */
export function folded(text: string): string | undefined {
  const result = foldText(text);
  return result.ok ? result.text : undefined;
}

/** The time of a source entry as a Date, or `null` when it is not a valid time. */
export function entryTime(fetchedAt: string): Date | null {
  const date = new Date(fetchedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The editor a rule-compiled page carries: the registry's editor, with `ai` pages compiled by the rules. */
export function compiledEditor(number: number): EditorKind {
  const editor = findPage(number)?.editor ?? "rules";
  return editor === "ai" ? "rules" : editor;
}

/**
 * Turns the built subpages of a page into a compile result: the page when every subpage built,
 * otherwise every problem with its subpage index.
 */
export function finishPage(
  number: number,
  built: readonly BuildResult[],
  dataAt: Date | null,
): CompileResult {
  const problems: CompileProblem[] = [];
  const subpages: Subpage[] = [];
  built.forEach((result, index) => {
    if (result.ok) subpages.push(result.subpage);
    else problems.push(...result.problems.map((p) => ({ ...p, subpage: index })));
  });
  const failed = toNonEmpty(problems);
  if (failed !== undefined) return { ok: false, problems: failed };
  const list: NonEmpty<Subpage> | undefined = toNonEmpty(subpages);
  if (list === undefined) {
    return {
      ok: false,
      problems: [
        { code: "grid", subpage: null, row: null, col: null, message: "page has no subpage" },
      ],
    };
  }
  const page: CompiledPage = { number, subpages: list, dataAt, editor: compiledEditor(number) };
  return { ok: true, page, outcome: "compiled" };
}
