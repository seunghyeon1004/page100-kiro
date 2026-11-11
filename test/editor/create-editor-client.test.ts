import { describe, expect, it } from "vitest";
import { AnthropicEditorClient } from "../../src/editor/anthropic-editor-client.js";
import { createEditorClient } from "../../src/editor/create-editor-client.js";
import { EditorFixture } from "../../src/editor/editor-fixture.js";
import type { EditorSettings } from "../../src/editor/editor-types.js";
import { FixtureEditorClient } from "../../src/editor/fixture-editor-client.js";
import { fakeFetch } from "./fake-fetch.js";

const SETTINGS: EditorSettings = {
  anthropicApiKey: null,
  editorModel: "test-model",
  maxModelCallsPerDay: 60,
  editorMaxCallsPerBoot: 30,
  editorClient: "auto",
};

const FIXTURE = EditorFixture.parse({
  version: 1,
  page: 111,
  inputKey: "a".repeat(64),
  model: "m",
  recordedAt: "2026-11-11T14:05:09.000Z",
  system: "s",
  attempts: [{ user: "u", result: { ok: true, rows: ["x"], requests: 1 } }],
});

describe("createEditorClient (requirement 3.4)", () => {
  const { fetch, calls } = fakeFetch([]);

  it("returns null for auto without a key, and for an empty key", () => {
    expect(createEditorClient(SETTINGS, fetch, [])).toBeNull();
    expect(createEditorClient({ ...SETTINGS, anthropicApiKey: "" }, fetch, [])).toBeNull();
  });

  it("returns null for fixtures with no fixtures, whatever the key", () => {
    expect(createEditorClient({ ...SETTINGS, editorClient: "fixtures" }, fetch, [])).toBeNull();
    expect(
      createEditorClient(
        { ...SETTINGS, editorClient: "fixtures", anthropicApiKey: "k" },
        fetch,
        [],
      ),
    ).toBeNull();
  });

  it("returns a FixtureEditorClient for fixtures with a fixture, ignoring the key", () => {
    const withKey = { ...SETTINGS, editorClient: "fixtures" as const, anthropicApiKey: "k" };
    expect(createEditorClient(withKey, fetch, [FIXTURE])).toBeInstanceOf(FixtureEditorClient);
    expect(
      createEditorClient({ ...withKey, anthropicApiKey: null }, fetch, [FIXTURE]),
    ).toBeInstanceOf(FixtureEditorClient);
  });

  it("returns an AnthropicEditorClient for auto with a key, even when fixtures exist", () => {
    const client = createEditorClient({ ...SETTINGS, anthropicApiKey: "k" }, fetch, [FIXTURE]);
    expect(client).toBeInstanceOf(AnthropicEditorClient);
    expect(client?.maxRequestsPerDraft).toBe(2);
  });

  it("makes no request while building any client", () => {
    expect(calls).toHaveLength(0);
  });
});
