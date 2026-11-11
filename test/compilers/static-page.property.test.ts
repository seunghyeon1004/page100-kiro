import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileStatic } from "../../src/compilers/static-page.js";
import type { AltBlock } from "../../src/pages/alt-block.js";
import { checkAltAgreement } from "../../src/pages/alt-agreement.js";
import { serialiseContent } from "../../src/markup/serialise-content.js";
import type { Rows } from "../../src/grid/types.js";
import { validContent } from "../grid/arbitraries.js";

// Property 12 (design.md). `expectedAlt` follows the "Static alt" rule of the design, written here
// with a different method from the one in src: one pass over the cells of each row.

function expectedAlt(content: Rows, title: string): AltBlock[] {
  const blocks: AltBlock[] = [];
  let open: string[] | undefined;
  let pending: string[] = [];
  const close = (): void => {
    if (open !== undefined) blocks.push({ kind: "paragraph", text: open.join(" ") });
    for (const text of pending)
      blocks.push({ kind: "concealed", summary: "Show hidden text", text });
    open = undefined;
    pending = [];
  };
  for (const row of content) {
    const visible = row
      .map((c) => (c.kind === "text" && !c.conceal ? c.ch : " "))
      .join("")
      .split(" ")
      .filter((w) => w !== "")
      .join(" ");
    const hidden: string[] = [];
    let start = 0;
    while (start < row.length) {
      const first = row[start];
      if (first === undefined || first.kind === "mosaic" || first.ch === " ") {
        start++;
        continue;
      }
      let end = start;
      let concealed = false;
      let word = "";
      while (end < row.length) {
        const c = row[end];
        if (c === undefined || c.kind === "mosaic" || c.ch === " ") break;
        word += c.ch;
        concealed ||= c.conceal;
        end++;
      }
      if (concealed) hidden.push(word);
      start = end;
    }
    const hiddenText = hidden.join(" ");
    if (visible === "") {
      close();
      if (hiddenText !== "")
        blocks.push({ kind: "concealed", summary: "Show hidden text", text: hiddenText });
    } else {
      open = [...(open ?? []), visible];
      if (hiddenText !== "") pending.push(hiddenText);
    }
  }
  close();
  return blocks.length > 0 ? blocks : [{ kind: "paragraph", text: title }];
}

describe("static page properties", () => {
  it("Property 12: valid content compiles, keeps its rows, gets the static alt, and the alt agrees with the grid", () => {
    fc.assert(
      fc.property(validContent, (content) => {
        const result = compileStatic(800, serialiseContent(content));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const subpage = result.page.subpages[0];
        expect(subpage.content).toEqual(content);
        expect(subpage.alt).toEqual(expectedAlt(content, "How to use Page 100"));
        expect(checkAltAgreement(subpage.content, subpage.alt)).toEqual({ ok: true });
      }),
    );
  });
});
