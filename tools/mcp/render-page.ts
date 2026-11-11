import { buildScreen } from "../../src/pages/build-screen.js";
import { lookupPage } from "../../src/pages/page-lookup.js";
import { compileBootPages } from "./boot-pages.js";
import { formatViolations, invalidReport } from "./format-violations.js";
import { screenReport } from "./screen-text.js";
import type { ToolReply } from "./tool-reply.js";

/**
 * One screen of a page compiled from the boot snapshot and `pages/*.page`. `subpage` is 1-based,
 * as in the banner indicator `n/m`, and defaults to 1.
 */
export function renderPage(pageNumber: number, subpage = 1): ToolReply {
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

  const { now, result } = compileBootPages();
  const outcome = result.outcomes.find((o) => o.number === def.number);
  if (outcome?.outcome === "failed") {
    return {
      text: `page ${String(def.number)} failed to compile:\n${formatViolations(
        outcome.problems.map((p) => ({
          code: p.code,
          row: p.row,
          col: p.col,
          message:
            p.subpage === null ? p.message : `subpage ${String(p.subpage + 1)}: ${p.message}`,
        })),
      )}`,
      isError: true,
    };
  }
  const compiled = result.pages.find((p) => p.number === def.number);
  if (compiled === undefined) {
    return { text: `page ${String(def.number)} was not compiled`, isError: true };
  }
  const count = compiled.subpages.length;
  const entry = compiled.subpages[subpage - 1];
  if (entry === undefined) {
    return {
      text: `page ${String(def.number)} has ${String(count)} subpage${count === 1 ? "" : "s"}; subpage ${String(subpage)} does not exist`,
      isError: true,
    };
  }
  const screen = buildScreen(def, compiled, subpage - 1, {
    now,
    stale: false,
    lastGoodAt: compiled.dataAt,
  });
  if (!screen.ok) {
    return {
      text:
        screen.error === "frame-invalid"
          ? invalidReport(screen.violations)
          : `the frame could not be built: ${screen.error}`,
      isError: true,
    };
  }
  const heading =
    `PAGE ${String(def.number)} (${def.title}), subpage ${String(subpage)} of ${String(count)}, ` +
    `compiled from the boot snapshot at ${now.toISOString()}`;
  return { text: screenReport(heading, screen.page, entry.alt), isError: false };
}
