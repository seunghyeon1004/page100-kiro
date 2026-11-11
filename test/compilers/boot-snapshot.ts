import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSnapshot } from "../../src/sources/snapshot.js";
import type { Snapshot } from "../../src/sources/snapshot.js";
import type { CompileResult, PageFiles } from "../../src/compilers/compile-types.js";
import type { ServiceStatus } from "../../src/compilers/service-status.js";
import { REGISTRY } from "../../src/pages/registry.js";
import { serialiseContent } from "../../src/markup/serialise-content.js";
import { buildScreen } from "../../src/pages/build-screen.js";
import { checkCompiledPage } from "../../src/pages/check-compiled-page.js";
import { findPage } from "../../src/pages/registry.js";

// The boot snapshot read through `parseSnapshot`, as the compiler tests use it (design.md, "Example tests").

export const NOW = new Date("2026-11-11T14:05:09Z");

function load(): Snapshot {
  const text = readFileSync(
    resolve(import.meta.dirname, "..", "..", "src", "sources", "snapshot", "snapshot.json"),
    "utf8",
  );
  const parsed = parseSnapshot(JSON.parse(text));
  if (!parsed.ok) throw new Error(`boot snapshot does not parse: ${parsed.issuePaths.join(", ")}`);
  return parsed.snapshot;
}

export const SNAPSHOT: Snapshot = load();

/** A deep copy that tests may change; it is checked with `parseSnapshot` again by the caller when needed. */
export function cloneSnapshot(): Snapshot {
  const parsed = parseSnapshot(structuredClone(SNAPSHOT));
  if (!parsed.ok) throw new Error("clone does not parse");
  return parsed.snapshot;
}

/** The compiled page of a successful result; fails the test otherwise. */
export function pageOf(result: CompileResult) {
  if (!result.ok) {
    throw new Error(
      `compile failed: ${result.problems.map((p) => `${p.code} row ${String(p.row)} col ${String(p.col)}: ${p.message}`).join("; ")}`,
    );
  }
  return result.page;
}

/** The content markup of one subpage of a successful result. */
export function markupOf(result: CompileResult, subpage = 0): string {
  const page = pageOf(result);
  const sub = page.subpages[subpage];
  if (sub === undefined) throw new Error(`no subpage ${String(subpage)}`);
  return serialiseContent(sub.content);
}

/** The problems that `checkCompiledPage` and `buildScreen` (both stale values) find; empty when sound. */
export function pageProblems(result: CompileResult, now = NOW): string[] {
  const page = pageOf(result);
  const def = findPage(page.number);
  if (def === undefined) return ["not in registry"];
  const found = checkCompiledPage(def, page).map((p) => JSON.stringify(p));
  page.subpages.forEach((_, i) => {
    for (const stale of [false, true]) {
      const screen = buildScreen(def, page, i, { now, stale, lastGoodAt: page.dataAt });
      if (!screen.ok) found.push(`subpage ${String(i)} stale ${String(stale)}: ${screen.error}`);
    }
  });
  return found;
}

/** The 24 rows of a screen as plain text, 40 columns, mosaics as their Unicode characters. */
export function screenText(result: CompileResult, subpage = 0, now = NOW): string {
  const page = pageOf(result);
  const def = findPage(page.number);
  if (def === undefined) throw new Error("not in registry");
  const screen = buildScreen(def, page, subpage, { now, stale: false, lastGoodAt: page.dataAt });
  if (!screen.ok) throw new Error(`screen failed: ${screen.error}`);
  return screen.page
    .map((row) =>
      row
        .map((cell) => {
          if (cell.kind === "text") return cell.ch;
          const bits = cell.bits;
          const cp =
            bits === 21
              ? 0x258c
              : bits === 42
                ? 0x2590
                : bits === 63
                  ? 0x2588
                  : 0x1fb00 + bits - 1 - (bits > 21 ? 1 : 0) - (bits > 42 ? 1 : 0);
          return String.fromCodePoint(cp);
        })
        .join(""),
    )
    .join("\n");
}

/** Content markup with its tags removed, row by row. */
export function plainOf(markup: string): string {
  return markup.replace(/\{[a-zA-Z~?/]+\}/g, "");
}

/** The rows of the `nth` table block of a subpage's text alternative; fails the test when there is none. */
export function tableRows(result: CompileResult, subpage = 0, nth = 0): string[][] {
  const sub = pageOf(result).subpages[subpage];
  if (sub === undefined) throw new Error(`no subpage ${String(subpage)}`);
  const tables = sub.alt.flatMap((b) => (b.kind === "table" ? [b] : []));
  const table = tables[nth];
  if (table === undefined) throw new Error(`no table ${String(nth)}`);
  return table.rows.map((r) => [...r]);
}

const PAGES_DIR = resolve(import.meta.dirname, "..", "..", "pages");

/** The four files of `pages/`, as `grid:check` reads them. */
export const PAGE_FILES: PageFiles = {
  666: readFileSync(resolve(PAGES_DIR, "666.page"), "utf8"),
  800: readFileSync(resolve(PAGES_DIR, "800.page"), "utf8"),
  801: readFileSync(resolve(PAGES_DIR, "801.page"), "utf8"),
  899: readFileSync(resolve(PAGES_DIR, "899.page"), "utf8"),
};

/** A status with an entry for every registry page. */
export const STATUS: ServiceStatus = {
  aiEditor: true,
  modelCalls: { used: 3, cap: 300 },
  drafts: { accepted: 2, rejected: 1 },
  pages: REGISTRY.map((d) => ({ number: d.number, compiledAt: NOW, editor: d.editor })),
};
