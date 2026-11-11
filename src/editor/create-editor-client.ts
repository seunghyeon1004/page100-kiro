import { AnthropicEditorClient } from "./anthropic-editor-client.js";
import type { FetchFunction } from "./anthropic-editor-client.js";
import type { EditorFixture } from "./editor-fixture.js";
import type { EditorClient, EditorSettings } from "./editor-types.js";
import { FixtureEditorClient } from "./fixture-editor-client.js";

/**
 * The client the settings call for, or `null` when the editor is off (ai-editor requirement 3.4):
 * `fixtures` with no fixtures, or `auto` with no key. No SDK client is built in those cases.
 */
export function createEditorClient(
  settings: EditorSettings,
  fetch: FetchFunction,
  fixtures: readonly EditorFixture[],
): EditorClient | null {
  if (settings.editorClient === "fixtures") {
    return fixtures.length === 0 ? null : new FixtureEditorClient(fixtures);
  }
  const apiKey = settings.anthropicApiKey;
  if (apiKey === null || apiKey === "") return null;
  return new AnthropicEditorClient({ apiKey, model: settings.editorModel, fetch });
}
