import { serialisePage } from "../markup/serialise-page.js";
import { stampClock } from "../pages/stamp-clock.js";
import type { EditorStatus } from "../editor/run-edition.js";
import type { StoreReader } from "./store.js";
import type { View } from "./views.js";

// The JSON formats (server-and-viewer 11.3, design.md, "Other formats and not-found screens").

/** Every subpage, each stamped with the request clock. `s` is ignored. */
export function renderJson(view: View): string {
  const { page } = view;
  return JSON.stringify({
    number: page.number,
    title: page.def.title,
    editor: page.editor,
    dataAt: page.dataAt === null ? null : page.dataAt.toISOString(),
    stale: page.stale,
    subpages: page.screens.map((screen, i) => ({
      rows: serialisePage(stampClock(screen, view.now)).split("\n").slice(0, 24),
      alt: page.alts[i],
    })),
  });
}

/** `/api/status`: the editor status and one line per held page, in page order. */
export function renderStatusJson(store: StoreReader): string {
  const editor: EditorStatus | null = store.editorStatus();
  return JSON.stringify({
    aiEditor: store.aiEditor(),
    editor,
    pages: store.list().map((page) => ({
      number: page.number,
      compiledAt: page.compiledAt.toISOString(),
      editor: page.editor,
      stale: page.stale,
      publishFailures: store.failures(page.number),
    })),
  });
}
