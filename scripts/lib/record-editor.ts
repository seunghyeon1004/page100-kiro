import { AnthropicEditorClient } from "../../src/editor/anthropic-editor-client.js";
import type { FetchFunction } from "../../src/editor/anthropic-editor-client.js";
import { createCallBudget } from "../../src/editor/call-budget.js";
import { createDraftCache } from "../../src/editor/draft-cache.js";
import { EditorFixture } from "../../src/editor/editor-fixture.js";
import type { EditorSettings } from "../../src/editor/editor-types.js";
import { emptyEditorStatus, runEdition } from "../../src/editor/run-edition.js";
import { SYSTEM_PROMPT } from "../../src/editor/system-prompt.js";
import { parseSnapshot } from "../../src/sources/snapshot.js";
import { containsSecret, recordingClient } from "./recording-client.js";
import type { RecordedAttempt } from "./recording-client.js";

// The recording script's logic (ai-editor requirement 14). The owner runs the entry point,
// scripts/record-editor-fixtures.ts, with a real key. It writes one fixture per AI page that made
// a call, after checking that no file holds the key.

/** What the script needs from the machine; the entry point gives the real one. */
export interface RecordHost {
  print(line: string): void;
  /** The text of src/sources/snapshot/snapshot.json, parsed as JSON. */
  readSnapshot(): unknown;
  now(): Date;
  /** Writes `test/fixtures/editor/<name>`. */
  writeFixture(name: string, text: string): void;
}

export type Env = Readonly<Record<string, string | undefined>>;

const DEFAULT_MODEL = "claude-opus-5-5";
const INTEGER = /^\d{1,5}$/;
const LIMIT = 10_000;

type Parsed =
  | { readonly ok: true; readonly settings: EditorSettings }
  | { readonly ok: false; readonly line: string };

/** Reads the four variables of requirement 14.5. A problem line names the variable, never its value. */
function settingsFrom(env: Env): Parsed {
  const whole = (name: string, fallback: number): number | undefined => {
    const text = env[name];
    if (text === undefined || text === "") return fallback;
    if (!INTEGER.test(text)) return undefined;
    const n = Number(text);
    return n <= LIMIT ? n : undefined;
  };
  const perDay = whole("MAX_MODEL_CALLS_PER_DAY", 60);
  if (perDay === undefined) {
    return { ok: false, line: "MAX_MODEL_CALLS_PER_DAY must be an integer from 0 to 10000" };
  }
  const perBoot = whole("EDITOR_MAX_CALLS_PER_BOOT", 30);
  if (perBoot === undefined) {
    return { ok: false, line: "EDITOR_MAX_CALLS_PER_BOOT must be an integer from 0 to 10000" };
  }
  const key = env.ANTHROPIC_API_KEY;
  const model = env.EDITOR_MODEL;
  return {
    ok: true,
    settings: {
      anthropicApiKey: key === undefined || key === "" ? null : key,
      editorModel: model === undefined || model === "" ? DEFAULT_MODEL : model,
      maxModelCallsPerDay: perDay,
      editorMaxCallsPerBoot: perBoot,
      editorClient: "anthropic",
    },
  };
}

function fileName(recordedAt: string, page: number): string {
  return `${recordedAt.slice(0, 10)}-p${String(page).padStart(3, "0")}.json`;
}

/** One fixture per page, from the attempts in the order they were made. */
function fixturesOf(
  recorded: readonly RecordedAttempt[],
  model: string,
  recordedAt: string,
): { name: string; text: string }[] {
  const pages = [...new Set(recorded.map((r) => r.request.page))];
  return pages.map((page) => {
    const attempts = recorded.filter((r) => r.request.page === page);
    const first = attempts[0];
    const fixture = EditorFixture.parse({
      version: 1,
      page,
      inputKey: first?.request.inputKey,
      model,
      recordedAt,
      system: SYSTEM_PROMPT,
      attempts: attempts.map((a) => ({ user: a.user, result: a.result })),
    });
    return { name: fileName(recordedAt, page), text: `${JSON.stringify(fixture, null, 2)}\n` };
  });
}

/** Returns the exit code: 0 when the fixtures are written, 1 otherwise. */
export async function recordEditor(
  env: Env,
  fetch: FetchFunction,
  host: RecordHost,
): Promise<number> {
  const parsed = settingsFrom(env);
  if (!parsed.ok) {
    host.print(parsed.line);
    return 1;
  }
  const { settings } = parsed;
  const key = settings.anthropicApiKey;
  if (key === null) {
    host.print("ANTHROPIC_API_KEY is not set");
    return 1;
  }
  const snapshot = parseSnapshot(host.readSnapshot());
  if (!snapshot.ok) {
    host.print("the boot snapshot does not parse");
    return 1;
  }

  const now = host.now();
  const client = recordingClient(
    new AnthropicEditorClient({ apiKey: key, model: settings.editorModel, fetch }),
  );
  await runEdition(snapshot.snapshot, emptyEditorStatus(), now, {
    client,
    budget: createCallBudget(settings.maxModelCallsPerDay, settings.editorMaxCallsPerBoot),
    cache: createDraftCache(),
    log: (line) => {
      host.print(line);
    },
  });

  const files = fixturesOf(client.recorded, settings.editorModel, now.toISOString());
  if (files.some((file) => containsSecret(file.text, key))) {
    host.print("a fixture would hold a secret; nothing was written");
    return 1;
  }
  for (const file of files) host.writeFixture(file.name, file.text);
  host.print(`wrote ${String(files.length)} fixtures`);
  return 0;
}
