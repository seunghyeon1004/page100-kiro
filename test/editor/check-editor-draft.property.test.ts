import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { NUMBER_WORDS } from "../../src/compilers/fit-text.js";
import { checkEditorDraft } from "../../src/editor/check-editor-draft.js";
import { foldText } from "../../src/grid/fold-text.js";
import { draftCaseArb } from "./editor-arbitraries.js";

// Property 1 (ai-editor design.md). The oracle below is written from the requirements, not from
// the checker: it reads the reply and the request and decides each rule on its own.

const MONTHS_AND_DAYS = new Set(
  "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec Mon Tue Wed Thu Fri Sat Sun".split(" "),
);

function letterRuns(text: string): string[] {
  return text.match(/\p{L}+/gu) ?? [];
}

function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((t) => t.split(",").join(""));
}

/** Words of a row the name rule must find in the input: capitalised, not first, not after a sentence end. */
function namesToFind(row: string): string[] {
  const tokens = row.split(" ");
  const found: string[] = [];
  tokens.forEach((token, i) => {
    if (i === 0) return;
    const before = tokens.slice(0, i);
    if (before.every((t) => /^[^\p{L}\p{N}]*$/u.test(t))) return;
    if (/[.!?]["')\]]?$/.test(before[i - 1] ?? "")) return;
    for (const run of letterRuns(token)) {
      const first = Array.from(run)[0] ?? "";
      const capitalised = first !== first.toLowerCase();
      const allCaps = Array.from(run).length >= 2 && run === run.toUpperCase();
      if (capitalised && !allCaps && !MONTHS_AND_DAYS.has(run)) found.push(run);
    }
  });
  return found;
}

describe("draft check properties", () => {
  it("Property 1: a draft the checker accepts meets every rule of 7.1 to 7.8 and 7.10, by an independent oracle", () => {
    let accepted = 0;
    let rejected = 0;
    fc.assert(
      fc.property(draftCaseArb, ({ request, reply }) => {
        const result = checkEditorDraft(request, reply);
        if (!result.ok) {
          rejected++;
          expect(result.violations.length).toBeGreaterThan(0);
          return;
        }
        accepted++;
        const { slots, totalRows } = request;
        expect(result.rows).toHaveLength(slots.length);
        const inputs = slots.map((s) => s.text);
        const knownNumbers = new Set(inputs.flatMap(numbersIn));
        const knownWords = new Set(inputs.flatMap(letterRuns).map((w) => w.toLowerCase()));
        let total = 0;
        slots.forEach((slot, s) => {
          const rows = result.rows[s] ?? [];
          expect(rows.length).toBeLessThanOrEqual(slot.maxRows);
          if (!slot.optional) expect(rows.length).toBeGreaterThanOrEqual(1);
          total += rows.length;
          for (const row of rows) {
            const folded = foldText(row);
            expect(folded.ok && folded.text === row).toBe(true);
            expect(Array.from(row).length).toBeLessThanOrEqual(slot.width);
            expect(row.trim()).not.toBe("");
            expect(row).toBe(row.trim());
            expect(row).not.toContain("  ");
            expect(row).not.toContain("{");
            for (const n of numbersIn(row)) expect(knownNumbers.has(n), `number ${n}`).toBe(true);
            for (const w of letterRuns(row).map((x) => x.toLowerCase())) {
              if (NUMBER_WORDS.includes(w)) expect(knownWords.has(w), `word ${w}`).toBe(true);
            }
            for (const name of namesToFind(row)) {
              expect(knownWords.has(name.toLowerCase()), `name ${name}`).toBe(true);
            }
          }
        });
        expect(total).toBeLessThanOrEqual(totalRows);
      }),
    );
    // The generator must reach both outcomes, or the property proves nothing.
    expect(accepted).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  });
});
