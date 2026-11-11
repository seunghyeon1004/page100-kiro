import type { DraftRequest, RequestSlot } from "./editor-types.js";

// The user message (ai-editor requirement 6, design.md, "Prompt"). The slot texts and the previous
// rows are data: each sits in one block as JSON with every `<` written `\u003c`, so neither
// closing tag can occur inside a block. A function of the request alone.

const MAX_VIOLATIONS = 20;

/** `JSON.stringify` with every `<` written as `\u003c`. */
export function encodeBlock(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function rowsText(count: number): string {
  return `${String(count)} ${count === 1 ? "row" : "rows"}`;
}

function slotLine(slot: RequestSlot, index: number): string {
  const low = slot.optional ? 0 : 1;
  const range =
    low === slot.maxRows
      ? `exactly ${rowsText(low)}`
      : `${String(low)} to ${rowsText(slot.maxRows)}`;
  const kind = slot.mode === "headline" ? "headline" : "body text";
  const optional = slot.optional ? " (may be left empty)" : "";
  return `Slot ${String(index + 1)}, id ${slot.id}: ${kind}, ${range}, at most ${String(slot.width)} characters per row${optional}.`;
}

/** A violation on one line, with `<` encoded; violations are code-written, this is a second guard. */
function violationLine(violation: string): string {
  return `- ${violation.replace(/\s+/g, " ").replaceAll("<", "\\u003c")}`;
}

export function userMessage(request: DraftRequest): string {
  const lines: string[] = [
    `Page ${String(request.page)}. At most ${rowsText(request.totalRows)} in total.`,
    ...request.slots.map(slotLine),
    "<source_data>",
    encodeBlock(request.slots.map((slot) => ({ id: slot.id, text: slot.text }))),
    "</source_data>",
  ];
  if (request.attempt > 0 && request.previous !== null) {
    lines.push(
      "Your previous draft broke these rules:",
      ...request.previous.violations.slice(0, MAX_VIOLATIONS).map(violationLine),
      "<previous_draft>",
      encodeBlock(request.previous.rows),
      "</previous_draft>",
      "Write a corrected draft.",
    );
  }
  return lines.join("\n");
}
