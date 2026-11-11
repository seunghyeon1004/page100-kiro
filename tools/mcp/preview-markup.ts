import { staticAlt } from "../../src/compilers/static-page.js";
import { validateContentRows } from "../../src/grid/validate-content-rows.js";
import { parseContent } from "../../src/markup/parse-content.js";
import { buildScreen } from "../../src/pages/build-screen.js";
import type { CompiledPage } from "../../src/pages/compiled-page.js";
import { formatHeaderClock } from "../../src/pages/frame-time.js";
import { lookupPage } from "../../src/pages/page-lookup.js";
import { invalidReport } from "./format-violations.js";
import { screenReport } from "./screen-text.js";
import type { ToolReply } from "./tool-reply.js";

/** The clock of every preview, so the same markup always gives the same screen. */
export const PREVIEW_NOW = new Date("2026-11-11T14:05:09.000Z");

/**
 * Frames content markup as the 20 content rows of an in-service page, at `PREVIEW_NOW`, with the
 * real frame builder. Returns the screen, its colour letters and its text alternative, or the
 * violations.
 */
export function previewMarkup(markup: string, pageNumber: number): ToolReply {
  const found = lookupPage(String(pageNumber));
  if (found.kind === "not-a-page-number") {
    return { text: `page ${String(pageNumber)} is not a page number (100 to 899)`, isError: true };
  }
  if (found.kind === "not-in-service") {
    return {
      text: `page ${String(pageNumber)} is not in service; nearest are ${String(found.lower)} and ${String(found.higher)}`,
      isError: true,
    };
  }
  const { def } = found;

  const parsed = parseContent(markup);
  if (!parsed.ok) return { text: invalidReport(parsed.errors), isError: false };
  const checked = validateContentRows(parsed.value);
  if (!checked.ok) return { text: invalidReport(checked.violations), isError: false };

  const alt = staticAlt(checked.content, def.title);
  const dataAt = def.source === "static" ? null : PREVIEW_NOW;
  const compiled: CompiledPage = {
    number: def.number,
    subpages: [{ content: checked.content, alt }],
    dataAt,
    editor: def.editor,
  };
  const screen = buildScreen(def, compiled, 0, {
    now: PREVIEW_NOW,
    stale: false,
    lastGoodAt: dataAt,
  });
  if (!screen.ok) {
    return {
      text:
        screen.error === "frame-invalid"
          ? invalidReport(screen.violations)
          : `the frame could not be built: ${screen.error}`,
      isError: false,
    };
  }
  const heading =
    `PREVIEW of page ${String(def.number)} (${def.title}), your markup as rows 2-21, ` +
    `framed at ${formatHeaderClock(PREVIEW_NOW)} UTC`;
  return { text: screenReport(heading, screen.page, alt), isError: false };
}
