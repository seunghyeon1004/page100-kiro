import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PageFiles } from "../compilers/compile-types.js";
import { parseSnapshot } from "../sources/snapshot.js";
import type { Snapshot } from "../sources/snapshot.js";

// The boot reads (server-and-viewer 3.1, 3.2): the only place that touches the file system. The
// server reads nothing after boot.

/** One recorded editor draft file, unparsed (`createApp` parses it and skips one that is invalid). */
export interface FixtureText {
  readonly name: string;
  readonly text: string;
}

export interface AppFiles {
  readonly snapshot: Snapshot;
  readonly pageFiles: PageFiles;
  readonly css: string;
  readonly js: string;
  readonly font: Uint8Array;
  readonly fixtures: readonly FixtureText[];
}

export type AppFilesResult =
  | { readonly ok: true; readonly files: AppFiles }
  | { readonly ok: false; readonly problem: string };

const SNAPSHOT_FILE = "src/sources/snapshot/snapshot.json";
const PAGE_FILES = ["666", "800", "801", "899"] as const;
const CSS_FILE = "public/app.css";
const JS_FILE = "public/app.js";
const FONT_FILE = "public/fonts/bedstead-extended-subset.woff2";
const FIXTURE_DIR = "test/fixtures/editor";

/** The app root: the parent of `src/server` or `dist/server`. */
export function appRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/** Parses the text of the snapshot file; the problem names the file and the issue paths, never a value. */
export function parseSnapshotText(
  text: string,
):
  | { readonly ok: true; readonly snapshot: Snapshot }
  | { readonly ok: false; readonly problem: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, problem: `${SNAPSHOT_FILE} is not JSON` };
  }
  const parsed = parseSnapshot(value);
  if (parsed.ok) return parsed;
  return {
    ok: false,
    problem: `${SNAPSHOT_FILE} is not a snapshot: issues ${parsed.issuePaths.join(",")}`,
  };
}

function readText(root: string, relative: string): string | undefined {
  const path = resolve(root, relative);
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads exactly the files of requirement 3.1 below `root`. WHERE `withFixtures`, also every
 * `test/fixtures/editor/*.json` (none is not a problem: the Docker image has none).
 */
export function readAppFiles(root: string, withFixtures: boolean): AppFilesResult {
  const snapshotText = readText(root, SNAPSHOT_FILE);
  if (snapshotText === undefined) return { ok: false, problem: `${SNAPSHOT_FILE} is missing` };
  const snapshot = parseSnapshotText(snapshotText);
  if (!snapshot.ok) return snapshot;

  const pages: Record<string, string> = {};
  for (const name of PAGE_FILES) {
    const text = readText(root, `pages/${name}.page`);
    if (text === undefined) return { ok: false, problem: `pages/${name}.page is missing` };
    pages[name] = text;
  }
  const css = readText(root, CSS_FILE);
  if (css === undefined) return { ok: false, problem: `${CSS_FILE} is missing` };
  const js = readText(root, JS_FILE);
  if (js === undefined) return { ok: false, problem: `${JS_FILE} is missing` };
  let font: Uint8Array;
  try {
    font = new Uint8Array(readFileSync(resolve(root, FONT_FILE)));
  } catch {
    return { ok: false, problem: `${FONT_FILE} is missing` };
  }

  const fixtures: FixtureText[] = [];
  if (withFixtures && existsSync(resolve(root, FIXTURE_DIR))) {
    for (const name of readdirSync(resolve(root, FIXTURE_DIR)).sort()) {
      if (!name.endsWith(".json")) continue;
      const text = readText(root, `${FIXTURE_DIR}/${name}`);
      if (text !== undefined) fixtures.push({ name, text });
    }
  }

  return {
    ok: true,
    files: {
      snapshot: snapshot.snapshot,
      pageFiles: {
        666: pages["666"] ?? "",
        800: pages["800"] ?? "",
        801: pages["801"] ?? "",
        899: pages["899"] ?? "",
      },
      css,
      js,
      font,
      fixtures,
    },
  };
}
