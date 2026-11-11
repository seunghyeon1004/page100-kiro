import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceId } from "../../src/sources/source-id.js";
import type { FixtureMeta, RecordedFile } from "./record.js";

// Names and paths of recorded fixtures (design.md, "Fixture files").

export const FIXTURES_ROOT_RELATIVE = "test/fixtures/sources";

export function bodyPath(root: string, source: SourceId, base: string): string {
  return join(root, source, `${base}.json`);
}

export function metaPath(root: string, source: SourceId, base: string): string {
  return join(root, source, `${base}.meta.json`);
}

/** Writes each body exactly as received, and its meta file with 2-space indentation and one final LF. */
export function writeRecorded(root: string, files: readonly RecordedFile[]): void {
  for (const file of files) {
    mkdirSync(join(root, file.source), { recursive: true });
    writeFileSync(bodyPath(root, file.source, file.base), file.body, "utf8");
    writeFileSync(
      metaPath(root, file.source, file.base),
      `${JSON.stringify(file.meta, null, 2)}\n`,
      "utf8",
    );
  }
}

/** All files of one source recorded on one UTC date. */
export interface FixtureSet {
  readonly source: SourceId;
  readonly date: string;
  /** File names without extension, for example `2026-11-11-featured-today`, sorted. */
  readonly bases: readonly string[];
}

/** The fixture sets of a source, newest date first. `synthetic/` is never listed. */
export function listFixtureSets(root: string, source: SourceId): FixtureSet[] {
  const dir = join(root, source);
  if (!existsSync(dir)) return [];
  const byDate = new Map<string, string[]>();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name.endsWith(".meta.json")) {
      continue;
    }
    const match = /^(\d{4}-\d{2}-\d{2})-.+\.json$/.exec(entry.name);
    const date = match?.[1];
    if (date === undefined) continue;
    byDate.set(date, [...(byDate.get(date) ?? []), entry.name.slice(0, -".json".length)]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, bases]) => ({ source, date, bases: bases.sort() }));
}

export function readBody(root: string, source: SourceId, base: string): string {
  return readFileSync(bodyPath(root, source, base), "utf8");
}

export function readMeta(root: string, source: SourceId, base: string): FixtureMeta {
  const value: unknown = JSON.parse(readFileSync(metaPath(root, source, base), "utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    !("url" in value) ||
    !("fetchedAt" in value) ||
    !("status" in value) ||
    !("query" in value) ||
    typeof value.url !== "string" ||
    typeof value.fetchedAt !== "string" ||
    typeof value.status !== "number" ||
    typeof value.query !== "object" ||
    value.query === null
  ) {
    throw new Error(`${base}.meta.json is not a fixture meta file`);
  }
  const query: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value.query)) {
    if (typeof entry === "string") query[key] = entry;
  }
  return { url: value.url, fetchedAt: value.fetchedAt, status: value.status, query };
}
