import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_PAGES } from "../../src/editor/ai-pages.js";
import { inputKey } from "../../src/editor/draft-cache.js";
import { EditorFixture } from "../../src/editor/editor-fixture.js";
import { SNAPSHOT } from "../compilers/boot-snapshot.js";
import { replay } from "./replay.js";

// Recorded editor drafts (ai-editor tasks.md, task 14). The OWNER records them with
// `npx tsx scripts/record-editor-fixtures.ts` and a real key. Until test/fixtures/editor/ holds a
// .json file this whole file is skipped, and no other test depends on recordings.

const DIR = resolve(import.meta.dirname, "..", "fixtures", "editor");
const FILES = existsSync(DIR) ? readdirSync(DIR).filter((name) => name.endsWith(".json")) : [];

describe.skipIf(FILES.length === 0)(
  "recorded editor fixtures (task 14; skipped while test/fixtures/editor/ has no .json file)",
  () => {
    const texts = FILES.map((name) => ({ name, text: readFileSync(join(DIR, name), "utf8") }));

    it("parses every file with EditorFixture, and names it <yyyy-mm-dd>-p<NNN>.json (13.1)", () => {
      for (const { name, text } of texts) {
        const fixture = EditorFixture.parse(JSON.parse(text));
        const day = fixture.recordedAt.slice(0, 10);
        expect(name).toBe(`${day}-p${String(fixture.page).padStart(3, "0")}.json`);
      }
    });

    it("holds no key, x-api-key or authorization (14.3)", () => {
      for (const { name, text } of texts) {
        expect(/sk-ant-|x-api-key|authorization/i.test(text), name).toBe(false);
      }
    });

    it("replays through FixtureEditorClient and runEdition on the boot snapshot (13.2)", async () => {
      const fixtures = texts.map(({ text }) => EditorFixture.parse(JSON.parse(text)));
      const { result, calls } = await replay(fixtures);
      expect(result.outcomes).toHaveLength(12);
      const keys = new Map(
        AI_PAGES.map((page) => [page.number, inputKey(page.prepare(SNAPSHOT).input)]),
      );
      const matching = fixtures.filter((f) => keys.get(f.page) === f.inputKey);
      // A fixture that no longer matches the boot snapshot means it is stale: record again.
      expect(matching.length, "no fixture matches the boot snapshot").toBeGreaterThan(0);
      for (const fixture of matching) {
        const forPage = calls.filter((c) => c.page === fixture.page);
        expect(forPage.map((c) => c.attempt)).toEqual(fixture.attempts.map((_, i) => i));
      }
    });
  },
);
