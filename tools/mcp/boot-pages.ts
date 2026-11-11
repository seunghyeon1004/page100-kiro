import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileAll } from "../../src/compilers/compile-all.js";
import type { CompileAllResult } from "../../src/compilers/compile-all.js";
import type { PageFiles } from "../../src/compilers/compile-types.js";
import type { ServiceStatus } from "../../src/compilers/service-status.js";
import { REGISTRY } from "../../src/pages/registry.js";
import { parseSnapshot } from "../../src/sources/snapshot.js";

/** The repository root. Every file this server reads is under it, at a fixed relative path. */
const ROOT = resolve(import.meta.dirname, "..", "..");

export interface BootPages {
  /** The time pages are compiled at: the newest fetch time in the boot snapshot. */
  readonly now: Date;
  readonly result: CompileAllResult;
}

function readPageFile(number: number): string {
  const path = join(ROOT, "pages", `${String(number)}.page`);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function bootStatus(now: Date): ServiceStatus {
  return {
    aiEditor: false,
    modelCalls: { used: 0, cap: 0 },
    drafts: { accepted: 0, rejected: 0 },
    pages: REGISTRY.map((def) => ({ number: def.number, compiledAt: now, editor: def.editor })),
  };
}

/**
 * Compiles every page from `src/sources/snapshot/snapshot.json` and the files of `pages/`, read
 * afresh on each call so that an edit to a page file shows at once. No network, no clock: the
 * time is the newest fetch time in the snapshot. Throws if the snapshot does not parse.
 */
export function compileBootPages(): BootPages {
  const text = readFileSync(join(ROOT, "src", "sources", "snapshot", "snapshot.json"), "utf8");
  const parsed = parseSnapshot(JSON.parse(text));
  if (!parsed.ok) {
    throw new Error(`snapshot.json does not parse: ${parsed.issuePaths.join(", ")}`);
  }
  const { snapshot } = parsed;
  const fetched = Object.values(snapshot.sources).map((entry) => Date.parse(entry.fetchedAt));
  const now = new Date(Math.max(...fetched));
  const files: PageFiles = {
    666: readPageFile(666),
    800: readPageFile(800),
    801: readPageFile(801),
    899: readPageFile(899),
  };
  return { now, result: compileAll(snapshot, bootStatus(now), now, files) };
}
