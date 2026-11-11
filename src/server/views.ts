import { toNonEmpty } from "../grid/non-empty.js";
import { validateContentRows } from "../grid/validate-content-rows.js";
import { parseContent } from "../markup/parse-content.js";
import type { AltBlock } from "../pages/alt-block.js";
import type { CompiledPage } from "../pages/compiled-page.js";
import { notInServicePage } from "../pages/not-in-service.js";
import type { PageDef } from "../pages/page-def.js";
import { framePage } from "./store.js";
import type { PublishedPage } from "./store.js";

// The views every renderer takes (server-and-viewer design.md, "Types", "Other formats and
// not-found screens").

export type Format = "html" | "frag" | "txt" | "ansi" | "json";

export interface View {
  readonly page: PublishedPage;
  /** 0-based. */
  readonly subpage: number;
  readonly now: Date;
  readonly reveal: boolean;
  readonly status: 200 | 404;
}

/** A held page as a view. The caller has checked `subpage` against the subpage count. */
export function pageView(page: PublishedPage, subpage: number, now: Date, reveal: boolean): View {
  return { page, subpage, now, reveal, status: 200 };
}

/**
 * The screen for a number from 100 to 899 that is not in service, framed by the store's own
 * function. Not stored; its `etag` is `""`. `undefined` when the number is in service or out of range.
 */
export function notInServiceView(n: number, now: Date): View | undefined {
  const result = notInServicePage(n);
  if (!result.ok) return undefined;
  const framed = framePage(result.def, result.compiled, { now, stale: false });
  if (!framed.ok) return undefined;
  return { page: { ...framed.page, etag: "" }, subpage: 0, now, reveal: false, status: 404 };
}

function plural(count: number): string {
  return count === 1 ? "subpage" : "subpages";
}

/**
 * The 404 screen for a subpage the page does not have. The requested number is never echoed.
 * `undefined` if the screen cannot be built.
 */
export function missingSubpageView(page: PublishedPage, now: Date): View | undefined {
  const { def } = page;
  const count = page.screens.length;
  const first = `Page ${String(def.number)} has ${String(count)} ${plural(count)}.`;
  const last = "Type a page number, or use the coloured links below.";
  const lines = [
    "",
    ` ${first}`,
    "",
    ` {y}${String(def.number)}{w}  ${def.title}`,
    "",
    " Type a page number, or use the",
    " coloured links below.",
  ];
  const parsed = parseContent(lines.join("\n"));
  if (!parsed.ok) return undefined;
  const checked = validateContentRows(parsed.value);
  if (!checked.ok) return undefined;
  const alt = toNonEmpty<AltBlock>([
    { kind: "paragraph", text: first },
    { kind: "link", text: `${String(def.number)} ${def.title}`, target: { page: def.number } },
    { kind: "paragraph", text: last },
  ]);
  if (alt === undefined) return undefined;
  const compiled: CompiledPage = {
    number: def.number,
    subpages: [{ content: checked.content, alt }],
    dataAt: null,
    editor: "static",
  };
  const staticDef: PageDef = { ...def, source: "static", editor: "static" };
  const framed = framePage(staticDef, compiled, { now, stale: false });
  if (!framed.ok) return undefined;
  return { page: { ...framed.page, etag: "" }, subpage: 0, now, reveal: false, status: 404 };
}
