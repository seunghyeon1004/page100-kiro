import type { NonEmpty } from "../grid/types.js";
import { validateContentRows } from "../grid/validate-content-rows.js";
import { parseContent } from "../markup/parse-content.js";
import type { AltBlock } from "./alt-block.js";
import type { CompiledPage } from "./compiled-page.js";
import { lookupPage } from "./page-lookup.js";
import type { PageDef } from "./page-def.js";
import { findPage } from "./registry.js";

export type NotInServiceResult =
  | { readonly ok: true; readonly def: PageDef; readonly compiled: CompiledPage }
  | { readonly ok: false; readonly reason: "in-service" | "out-of-range" }
  | { readonly ok: false; readonly reason: "content-invalid"; readonly messages: NonEmpty<string> };

function titleOf(number: number): string {
  return findPage(number)?.title ?? "";
}

/**
 * The screen for a number from 100 to 899 that is not in service (requirement 8; design.md,
 * "Not-in-service screen"). Never throws.
 */
export function notInServicePage(n: number): NotInServiceResult {
  const found = lookupPage(String(n));
  if (found.kind === "not-a-page-number") return { ok: false, reason: "out-of-range" };
  if (found.kind === "in-service") return { ok: false, reason: "in-service" };

  const { lower, higher } = found;
  // The nearest pages below and above, then page 100 unless it is already the lower page.
  const listed = lower === 100 ? [lower, higher] : [lower, higher, 100];

  const lines = [
    "",
    ` Page ${String(n)} is not in service.`,
    "",
    " Nearest pages in service:",
    "",
    ...listed.map((number) => ` {y}${String(number)}{w}  ${titleOf(number)}`),
    "",
    " Type a page number, or use the",
    " coloured links below.",
  ];

  const parsed = parseContent(lines.join("\n"));
  if (!parsed.ok) {
    return { ok: false, reason: "content-invalid", messages: [parsed.errors[0].message] };
  }
  const checked = validateContentRows(parsed.value);
  if (!checked.ok) {
    return { ok: false, reason: "content-invalid", messages: [checked.violations[0].message] };
  }

  const links: AltBlock[] = listed.map((number) => ({
    kind: "link",
    text: `${String(number)} ${titleOf(number)}`,
    target: { page: number },
  }));
  const alt: NonEmpty<AltBlock> = [
    { kind: "paragraph", text: `Page ${String(n)} is not in service.` },
    { kind: "paragraph", text: "Nearest pages in service:" },
    ...links,
    { kind: "paragraph", text: "Type a page number, or use the coloured links below." },
  ];

  const frozenLinks: PageDef["links"] = Object.freeze([
    Object.freeze({ label: "Index", target: 100 }),
    Object.freeze({ label: `P${String(lower)}`, target: lower }),
    Object.freeze({ label: `P${String(higher)}`, target: higher }),
    Object.freeze({ label: "Help", target: 800 }),
  ]);
  const def: PageDef = Object.freeze({
    number: n,
    title: "Page not in service",
    banner: "PAGE NOT IN SERVICE",
    source: "static",
    editor: "static",
    links: frozenLinks,
  });
  const compiled: CompiledPage = {
    number: n,
    subpages: [{ content: checked.content, alt }],
    dataAt: null,
    editor: "static",
  };
  return { ok: true, def, compiled };
}
