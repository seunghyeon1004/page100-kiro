import type { EditorKind } from "../pages/page-def.js";
import { findPage } from "../pages/registry.js";
import type { CompileProblem, CompileResult } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";

// The page that says a page has no data (rule-compilers requirement 7.5, design.md, "No-data page").

/** `dataAt` is `null` and the outcome `no-data`. `no-story` is for pages 111 to 118. */
export function noDataPage(number: number, kind: "no-data" | "no-story"): CompileResult {
  const def = findPage(number);
  const b = createContentBuilder();
  if (kind === "no-story") {
    b.markup(1, " {y}No story on this page today.");
    b.markup(3, " {y}110{w}  World news index");
    b.alt({ kind: "paragraph", text: "No story on this page today." });
    b.alt({ kind: "link", text: "110 World news index", target: { page: 110 } });
  } else {
    b.markup(1, " {y}No data yet.");
    b.markup(3, " This page fills in after the next good");
    b.markup(4, " update from its source.");
    b.markup(6, " {y}100{w}  Index");
    b.alt({ kind: "paragraph", text: "No data yet." });
    b.alt({
      kind: "paragraph",
      text: "This page fills in after the next good update from its source.",
    });
    b.alt({ kind: "link", text: "100 Index", target: { page: 100 } });
  }
  const built = b.build();
  if (!built.ok) return built;
  if (def === undefined) {
    const problem: CompileProblem = {
      code: "page-check",
      subpage: null,
      row: null,
      col: null,
      message: `page ${String(number)} is not in the registry`,
    };
    return { ok: false, problems: [problem] };
  }
  // An AI page is compiled by the rules when it has no data.
  const editor: EditorKind = def.editor === "ai" ? "rules" : def.editor;
  return {
    ok: true,
    outcome: "no-data",
    page: { number, subpages: [built.subpage], dataAt: null, editor },
  };
}
