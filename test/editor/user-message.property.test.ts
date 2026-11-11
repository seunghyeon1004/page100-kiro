import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { userMessage } from "../../src/editor/user-message.js";
import { requestArb } from "./editor-arbitraries.js";

// Property 7 (ai-editor design.md).

function count(text: string, part: string): number {
  return text.split(part).length - 1;
}

/** The text between `<tag>\n` and `\n</tag>`. */
function block(text: string, tag: string): string {
  const open = `<${tag}>\n`;
  const start = text.indexOf(open) + open.length;
  return text.slice(start, text.indexOf(`\n</${tag}>`, start));
}

describe("user message properties", () => {
  it("Property 7: each block tag occurs once, and each block parses back to the slot texts and rows", () => {
    fc.assert(
      fc.property(requestArb, (request) => {
        const text = userMessage(request);
        expect(count(text, "<source_data>")).toBe(1);
        expect(count(text, "</source_data>")).toBe(1);
        expect(JSON.parse(block(text, "source_data"))).toEqual(
          request.slots.map((s) => ({ id: s.id, text: s.text })),
        );
        const previous = request.attempt > 0 ? request.previous : null;
        expect(count(text, "<previous_draft>")).toBe(previous === null ? 0 : 1);
        expect(count(text, "</previous_draft>")).toBe(previous === null ? 0 : 1);
        if (previous !== null) {
          expect(JSON.parse(block(text, "previous_draft"))).toEqual(previous.rows);
        }
        expect(userMessage(request)).toBe(text);
      }),
    );
  });
});
