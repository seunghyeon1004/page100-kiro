import type { NonEmpty } from "../grid/types.js";
import { checkAltAgreement } from "./alt-agreement.js";
import type { CompiledPage } from "./compiled-page.js";
import { MAX_SUBPAGES } from "./build-screen.js";
import type { EditorKind, PageDef } from "./page-def.js";

export type CompiledProblem =
  | { readonly code: "number" }
  | { readonly code: "subpage-count"; readonly count: number }
  | { readonly code: "editor"; readonly actual: EditorKind }
  | {
      readonly code: "table-width";
      readonly subpage: number;
      readonly block: number;
      readonly row: number;
    }
  | {
      readonly code: "alt-missing";
      readonly subpage: number;
      readonly words: NonEmpty<string>;
    };

function editorAllowed(expected: EditorKind, actual: EditorKind): boolean {
  return expected === "ai" ? actual === "ai" || actual === "rules" : actual === expected;
}

/** The problems of a compiled page against its def (requirement 9.2). Empty when the page is sound. */
export function checkCompiledPage(def: PageDef, compiled: CompiledPage): CompiledProblem[] {
  const problems: CompiledProblem[] = [];
  if (compiled.number !== def.number) problems.push({ code: "number" });
  if (compiled.subpages.length > MAX_SUBPAGES) {
    problems.push({ code: "subpage-count", count: compiled.subpages.length });
  }
  if (!editorAllowed(def.editor, compiled.editor)) {
    problems.push({ code: "editor", actual: compiled.editor });
  }

  compiled.subpages.forEach((subpage, subpageIndex) => {
    subpage.alt.forEach((block, blockIndex) => {
      if (block.kind !== "table") return;
      block.rows.forEach((row, rowIndex) => {
        if (row.length !== block.headers.length) {
          problems.push({
            code: "table-width",
            subpage: subpageIndex,
            block: blockIndex,
            row: rowIndex,
          });
        }
      });
    });
    const agreement = checkAltAgreement(subpage.content, subpage.alt);
    if (!agreement.ok) {
      problems.push({ code: "alt-missing", subpage: subpageIndex, words: agreement.missing });
    }
  });

  return problems;
}
