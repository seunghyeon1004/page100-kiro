import { createCallBudget } from "../../src/editor/call-budget.js";
import { createDraftCache } from "../../src/editor/draft-cache.js";
import type { EditorFixture } from "../../src/editor/editor-fixture.js";
import type { DraftRequest, EditorClient } from "../../src/editor/editor-types.js";
import { FixtureEditorClient } from "../../src/editor/fixture-editor-client.js";
import { emptyEditorStatus, runEdition } from "../../src/editor/run-edition.js";
import { NOW, SNAPSHOT } from "../compilers/boot-snapshot.js";

// Replays fixtures through the FixtureEditorClient and runEdition on the boot snapshot.

export async function replay(fixtures: readonly EditorFixture[]) {
  const inner = new FixtureEditorClient(fixtures);
  const calls: DraftRequest[] = [];
  const client: EditorClient = {
    maxRequestsPerDraft: inner.maxRequestsPerDraft,
    draft: (request) => {
      calls.push(request);
      return inner.draft(request);
    },
  };
  const result = await runEdition(SNAPSHOT, emptyEditorStatus(), NOW, {
    client,
    budget: createCallBudget(10_000, 10_000),
    cache: createDraftCache(),
    log: () => undefined,
  });
  return { result, calls };
}
