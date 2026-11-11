import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FetchFn, HttpResponse } from "../../src/sources/http.js";
import type { SourceId } from "../../src/sources/source-id.js";
import { textResponse } from "./fake-http.js";

// Reads the recorded fixtures under test/fixtures/sources. Recorded files are never edited.

export const FIXTURES_ROOT = resolve(import.meta.dirname, "..", "fixtures", "sources");

/** File names (without `.json`) of the recorded bodies of a source, sorted. Meta and synthetic files are left out. */
export function recordedBases(source: SourceId): string[] {
  return readdirSync(join(FIXTURES_ROOT, source), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".json") && !e.name.endsWith(".meta.json"))
    .map((e) => e.name.slice(0, -".json".length))
    .sort();
}

export function recordedText(source: SourceId, base: string): string {
  return readFileSync(join(FIXTURES_ROOT, source, `${base}.json`), "utf8");
}

export function recorded(source: SourceId, base: string): unknown {
  return JSON.parse(recordedText(source, base));
}

export interface RecordedMeta {
  readonly url: string;
  readonly fetchedAt: string;
  readonly status: number;
  readonly query: Readonly<Record<string, string>>;
}

export function recordedMeta(source: SourceId, base: string): RecordedMeta {
  return JSON.parse(
    readFileSync(join(FIXTURES_ROOT, source, `${base}.meta.json`), "utf8"),
  ) as RecordedMeta;
}

export interface SyntheticFixture {
  readonly name: string;
  readonly comment: string;
  readonly body: unknown;
}

/** The hand-made edge cases of a source (`{ "comment": ..., "body": ... }`). */
export function syntheticFixtures(source: SourceId): SyntheticFixture[] {
  const dir = join(FIXTURES_ROOT, source, "synthetic");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const file = JSON.parse(readFileSync(join(dir, name), "utf8")) as {
        comment: string;
        body: unknown;
      };
      return { name, comment: file.comment, body: file.body };
    });
}

/**
 * A fetch that serves the recorded bodies of one source by the URL in their meta file, and 404 for
 * any other URL. `overrides` replaces the answer for a URL.
 */
export function recordedFetch(
  source: SourceId,
  overrides: Readonly<Record<string, () => Promise<HttpResponse>>> = {},
): { fetch: FetchFn; requested: string[] } {
  const bodies = new Map<string, string>();
  for (const base of recordedBases(source)) {
    bodies.set(recordedMeta(source, base).url, recordedText(source, base));
  }
  const requested: string[] = [];
  const fetch: FetchFn = (url) => {
    requested.push(url);
    const override = overrides[url];
    if (override !== undefined) return override();
    const body = bodies.get(url);
    return Promise.resolve(
      body === undefined ? textResponse(404, "no fixture") : textResponse(200, body),
    );
  };
  return { fetch, requested };
}
