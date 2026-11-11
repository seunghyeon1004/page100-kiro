import fc from "fast-check";
import { BLANK_CELL } from "../../src/grid/blank-cell.js";
import type { Cell, ValidContent } from "../../src/grid/types.js";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import { parseContent } from "../../src/markup/parse-content.js";
import type { AltBlock } from "../../src/pages/alt-block.js";
import type { CompiledPage, Subpage } from "../../src/pages/compiled-page.js";
import type { EditorKind, PageDef } from "../../src/pages/page-def.js";
import { REGISTRY } from "../../src/pages/registry.js";
import { validContent } from "../grid/arbitraries.js";

/** 20 blank content rows, through the real validator. */
export function blankContent(): ValidContent {
  const row: Cell[] = Array.from({ length: 40 }, () => BLANK_CELL);
  const result = validateContentRows(Array.from({ length: 20 }, () => row.slice()));
  if (!result.ok) throw new Error("blank content did not validate");
  return result.content;
}

export function paragraph(text: string): AltBlock {
  return { kind: "paragraph", text };
}

/** A subpage of blank content with one alt paragraph. */
export function blankSubpage(): Subpage {
  return { content: blankContent(), alt: [paragraph("Blank")] };
}

/** A compiled page of `count` blank subpages (count of at least 1). */
export function blankCompiled(
  number: number,
  count: number,
  editor: EditorKind = "rules",
  dataAt: Date | null = null,
): CompiledPage {
  const first = blankSubpage();
  const rest = Array.from({ length: count - 1 }, () => blankSubpage());
  return { number, subpages: [first, ...rest], dataAt, editor };
}

/** The editors a compiled page may carry for a def (requirement 9.2). */
export function allowedEditors(def: PageDef): readonly EditorKind[] {
  if (def.editor === "static") return ["static"];
  if (def.editor === "rules") return ["rules"];
  return ["ai", "rules"];
}

export const registryDef: fc.Arbitrary<PageDef> = fc.constantFrom(...REGISTRY);

const subpageArb: fc.Arbitrary<Subpage> = validContent.map((content) => ({
  content,
  alt: [paragraph("Generated")],
}));

/** A def with a matching compiled page of 1 to 9 subpages of arbitrary valid content. */
export const defWithCompiled: fc.Arbitrary<{ def: PageDef; compiled: CompiledPage }> =
  registryDef.chain((def) =>
    fc
      .tuple(
        fc.constantFrom(...allowedEditors(def)),
        subpageArb,
        fc.array(subpageArb, { minLength: 0, maxLength: 8 }),
      )
      .map(([editor, first, rest]) => ({
        def,
        compiled: { number: def.number, subpages: [first, ...rest], dataAt: null, editor },
      })),
  );

/** UTC instants from 1970 to 2199, always valid Dates. */
export const frameDate: fc.Arbitrary<Date> = fc.date({
  min: new Date(Date.UTC(1970, 0, 1)),
  max: new Date(Date.UTC(2199, 11, 31, 23, 59, 59, 999)),
  noInvalidDate: true,
});

/** Content from markup lines, through the real parser and validator. */
export function contentOf(markup: string): ValidContent {
  const parsed = parseContent(markup);
  if (!parsed.ok) throw new Error(`markup did not parse: ${parsed.errors[0].message}`);
  const checked = validateContentRows(parsed.value);
  if (!checked.ok) throw new Error(`markup did not validate: ${checked.violations[0].message}`);
  return checked.content;
}
