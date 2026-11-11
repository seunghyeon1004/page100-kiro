import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { recordEditor } from "./lib/record-editor.js";

// Records the AI editor's drafts as fixtures in test/fixtures/editor/. The OWNER runs this, with a
// real key in the environment: `ANTHROPIC_API_KEY=... npx tsx scripts/record-editor-fixtures.ts`.
// It calls the model API (at most EDITOR_MAX_CALLS_PER_BOOT calls). Kiro never runs it.
// This is the only place that passes the environment to the recorder (ai-editor Departure 6).

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURES = resolve(ROOT, "test", "fixtures", "editor");

process.exitCode = await recordEditor(process.env, fetch, {
  print: (line) => {
    console.log(line);
  },
  readSnapshot: (): unknown => {
    const parsed: unknown = JSON.parse(
      readFileSync(resolve(ROOT, "src", "sources", "snapshot", "snapshot.json"), "utf8"),
    );
    return parsed;
  },
  now: () => new Date(),
  writeFixture: (name, text) => {
    mkdirSync(FIXTURES, { recursive: true });
    writeFileSync(resolve(FIXTURES, name), text, "utf8");
  },
});
