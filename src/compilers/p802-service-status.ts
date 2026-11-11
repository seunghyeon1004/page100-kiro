import { REGISTRY } from "../pages/registry.js";
import type { EditorKind } from "../pages/page-def.js";
import { CYAN, WHITE, YELLOW, finishPage } from "./compile-helpers.js";
import type { CompileResult } from "./compile-types.js";
import { createContentBuilder } from "./content-builder.js";
import { NOT_AVAILABLE, formatInteger, formatTime } from "./format.js";
import type { ServiceStatus } from "./service-status.js";

// Page 802: service status (rule-compilers requirement 16.2, design.md, "Page layouts").

const EDITOR_LABEL: Readonly<Record<EditorKind, string>> = {
  rules: "Rules",
  ai: "AI",
  static: "Static",
};

const COUNTER_MAX = 99_999;

/** The compile time and editor of a page: the last entry for the number wins; `n/a` without one. */
function lookup(status: ServiceStatus, number: number): { time: string; editor: string } {
  const entry = status.pages.findLast((p) => p.number === number);
  if (entry === undefined) return { time: NOT_AVAILABLE, editor: NOT_AVAILABLE };
  return { time: formatTime(entry.compiledAt), editor: EDITOR_LABEL[entry.editor] };
}

export function compile802(status: ServiceStatus, now: Date): CompileResult {
  const b = createContentBuilder();
  const calls = `${formatInteger(status.modelCalls.used, COUNTER_MAX)} of ${formatInteger(status.modelCalls.cap, COUNTER_MAX)}`;
  const lines = [
    `AI editor: ${status.aiEditor ? "on" : "off"}`,
    `Model calls today: ${calls}`,
    `Drafts today, accepted: ${formatInteger(status.drafts.accepted, COUNTER_MAX)}`,
    `Drafts today, rejected: ${formatInteger(status.drafts.rejected, COUNTER_MAX)}`,
  ];
  lines.forEach((line, i) => {
    b.text(i, 1, line, i === 0 ? YELLOW : WHITE);
  });
  b.alt({ kind: "paragraph", text: lines.slice(0, 2).join(". ") });
  b.alt({ kind: "paragraph", text: lines.slice(2).join(". ") });

  for (const col of [1, 21]) {
    b.text(4, col, "Page", CYAN);
    b.text(4, col + 5, "UTC", CYAN);
    b.text(4, col + 11, "Editor", CYAN);
  }
  const rows: string[][] = [];
  REGISTRY.forEach((def, i) => {
    const info = lookup(status, def.number);
    const left = i < 15;
    const col = left ? 1 : 21;
    const row = 5 + (left ? i : i - 15);
    b.text(row, col, String(def.number), YELLOW);
    b.text(row, col + 5, info.time, WHITE);
    b.text(row, col + 11, info.editor, WHITE);
    rows.push([String(def.number), info.time, info.editor]);
  });
  b.alt({ kind: "table", headers: ["Page", "UTC", "Editor"], rows });
  return finishPage(802, [b.build()], now);
}
