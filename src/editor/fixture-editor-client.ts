import type { EditorFixture } from "./editor-fixture.js";
import type { DraftRequest, DraftResult, EditorClient } from "./editor-types.js";

// Answers from recorded drafts (ai-editor requirement 13.2). Reads no file: the caller parses the
// fixture files and passes them in.

export class FixtureEditorClient implements EditorClient {
  readonly maxRequestsPerDraft = 1;
  private readonly byKey: ReadonlyMap<string, EditorFixture>;

  constructor(fixtures: readonly EditorFixture[]) {
    this.byKey = new Map(fixtures.map((fixture) => [fixture.inputKey, fixture]));
  }

  draft(request: DraftRequest): Promise<DraftResult> {
    const recorded = this.byKey.get(request.inputKey)?.attempts[request.attempt]?.result;
    if (recorded === undefined) {
      return Promise.resolve({ ok: false, reason: "no-fixture", status: null, requests: 1 });
    }
    return Promise.resolve(
      recorded.ok
        ? { ok: true, rows: recorded.rows, requests: 1 }
        : { ok: false, reason: recorded.reason, status: recorded.status, requests: 1 },
    );
  }
}
