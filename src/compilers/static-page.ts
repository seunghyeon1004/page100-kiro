import { toNonEmpty } from "../grid/non-empty.js";
import type { Cell, NonEmpty, Rows } from "../grid/types.js";
import { validateContentRows } from "../grid/validate-content-rows.js";
import { parseContent } from "../markup/parse-content.js";
import type { AltBlock } from "../pages/alt-block.js";
import { REGISTRY, findPage } from "../pages/registry.js";
import type { CompileProblem, CompileResult } from "./compile-types.js";
import { collapseSpaces } from "./content-builder.js";

// Static pages (rule-compilers requirement 17, design.md, "Static pages"): the text of a file in
// `pages/` parsed, validated and given its text alternative.

/** The numbers of the registry's static pages, in ascending order. */
export const STATIC_PAGE_NUMBERS: readonly number[] = REGISTRY.filter(
  (def) => def.editor === "static",
).map((def) => def.number);

/** The page number of a file name such as `800.page`, or `undefined` when it is not a static page. */
export function staticPageNumber(fileName: string): number | undefined {
  const match = /^(\d{3})\.page$/.exec(fileName);
  const number = match?.[1] === undefined ? undefined : Number(match[1]);
  return number !== undefined && STATIC_PAGE_NUMBERS.includes(number) ? number : undefined;
}

/** The row's visible text: concealed and mosaic cells read as spaces, spaces collapsed. */
function visibleText(row: readonly Cell[]): string {
  return collapseSpaces(
    row.map((cell) => (cell.kind === "text" && !cell.conceal ? cell.ch : " ")).join(""),
  );
}

/**
 * The row's concealed text: every run of non-space characters that holds a concealed cell, read
 * in full, so that a word half concealed still appears whole (design.md, "Static alt").
 */
function concealedText(row: readonly Cell[]): string {
  const tokens: string[] = [];
  let token = "";
  let hidden = false;
  const flush = (): void => {
    if (token !== "" && hidden) tokens.push(token);
    token = "";
    hidden = false;
  };
  for (const cell of row) {
    if (cell.kind === "mosaic" || cell.ch === " ") {
      flush();
    } else {
      token += cell.ch;
      if (cell.conceal) hidden = true;
    }
  }
  flush();
  return tokens.join(" ");
}

/** The static alt rule of the design: paragraphs from runs of rows with text, concealed blocks after. */
export function staticAlt(content: Rows, title: string): NonEmpty<AltBlock> {
  const blocks: AltBlock[] = [];
  let paragraph: string[] = [];
  let pending: string[] = [];
  const flush = (): void => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    for (const text of pending) {
      blocks.push({ kind: "concealed", summary: "Show hidden text", text });
    }
    paragraph = [];
    pending = [];
  };
  for (const row of content) {
    const visible = visibleText(row);
    const hidden = concealedText(row);
    if (visible === "") {
      flush();
      if (hidden !== "")
        blocks.push({ kind: "concealed", summary: "Show hidden text", text: hidden });
      continue;
    }
    paragraph.push(visible);
    if (hidden !== "") pending.push(hidden);
  }
  flush();
  return toNonEmpty(blocks) ?? [{ kind: "paragraph", text: title }];
}

/** Parses and validates the text of a static page file and builds its compiled page. Never throws. */
export function compileStatic(number: number, text: string): CompileResult {
  const def = findPage(number);
  const parsed = parseContent(text);
  if (!parsed.ok) {
    const [first, ...rest] = parsed.errors;
    const toProblem = (e: typeof first): CompileProblem => ({
      code: "markup",
      subpage: null,
      row: e.row,
      col: e.col,
      message: e.message,
    });
    return { ok: false, problems: [toProblem(first), ...rest.map(toProblem)] };
  }
  const checked = validateContentRows(parsed.value);
  if (!checked.ok) {
    const [first, ...rest] = checked.violations;
    const toProblem = (v: typeof first): CompileProblem => ({
      code: "grid",
      subpage: null,
      row: v.row,
      col: v.col,
      message: v.message,
    });
    return { ok: false, problems: [toProblem(first), ...rest.map(toProblem)] };
  }
  if (def?.editor !== "static") {
    return {
      ok: false,
      problems: [
        {
          code: "page-check",
          subpage: null,
          row: null,
          col: null,
          message: `page ${String(number)} is not a static page`,
        },
      ],
    };
  }
  return {
    ok: true,
    outcome: "compiled",
    page: {
      number,
      subpages: [{ content: checked.content, alt: staticAlt(checked.content, def.title) }],
      dataAt: null,
      editor: "static",
    },
  };
}
