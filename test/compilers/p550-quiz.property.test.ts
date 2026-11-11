import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compile550 } from "../../src/compilers/p550-quiz.js";
import { formatYear } from "../../src/compilers/format.js";
import type { CompileResult } from "../../src/compilers/compile-types.js";
import { OnThisDay } from "../../src/sources/wikimedia-onthisday.js";
import { NOW, pageOf, pageProblems } from "./boot-snapshot.js";

// Property 8 (design.md). Event texts are built from words and from the years of the other events,
// so that years do collide with numbers in other texts.

const YEARS = [-500, -44, 10, 33, 476, 1066, 1492, 1789, 1914, 1939, 1969, 2001, 2024];
const year = fc.oneof(fc.constantFrom(...YEARS), fc.integer({ min: -3000, max: 2100 }));
const piece = fc.oneof(
  fc.constantFrom(
    "War",
    "ends",
    "The",
    "king",
    "dies",
    "in",
    "a",
    "city",
    "after",
    "Treaty",
    "signed",
    "of",
  ),
  fc.constantFrom(...YEARS.map((y) => String(Math.abs(y)))),
  fc.constantFrom("1,066", "2.5", "12", "7", "100"),
);
const text = fc.array(piece, { minLength: 1, maxLength: 14 }).map((ps) => `${ps.join(" ")}.`);
const events = fc.array(fc.record({ year, text }), { maxLength: 12 });
const now = fc.date({
  min: new Date(Date.UTC(1970, 0, 1)),
  max: new Date(Date.UTC(2100, 11, 31)),
  noInvalidDate: true,
});

/** Number tokens of a string, found here with their own regex: digits with inner commas or points removed. */
function tokens(s: string): string[] {
  return (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((t) => t.replace(/[.,]/g, ""));
}

function runs(result: CompileResult): { visible: string[]; hidden: string[] } {
  const visible: string[] = [];
  const hidden: string[] = [];
  for (const row of pageOf(result).subpages[0].content) {
    visible.push(row.map((c) => (c.kind === "text" && !c.conceal ? c.ch : " ")).join(""));
    hidden.push(
      row
        .map((c) => (c.kind === "text" && c.conceal ? c.ch : " "))
        .join("")
        .trim(),
    );
  }
  return { visible, hidden };
}

describe("quiz properties", () => {
  it("Property 8: no question year is a number in any unconcealed cell run, and the concealed cells read formatYear(year)", () => {
    fc.assert(
      fc.property(events, now, (list, at) => {
        const parsed = OnThisDay.safeParse({
          month: 11,
          day: 11,
          events: list,
          births: [],
          deaths: [],
        });
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        const result = compile550({ fetchedAt: NOW.toISOString(), value: parsed.data }, at);
        expect(result.ok).toBe(true);
        if (!result.ok || result.outcome === "no-data") return;
        expect(pageProblems(result)).toEqual([]);

        const { visible, hidden } = runs(result);
        const answers = hidden.filter((h) => h !== "");
        const allowed = new Set(parsed.data.events.map((e) => formatYear(e.year)));
        expect(answers.length).toBeGreaterThanOrEqual(1);
        expect(answers.length).toBeLessThanOrEqual(5);
        const visibleTokens = visible.flatMap(tokens);
        for (const answer of answers) {
          expect(allowed.has(answer), answer).toBe(true);
          const digits = /\d+/.exec(answer)?.[0] ?? "";
          expect(visibleTokens, `year ${answer}`).not.toContain(digits);
        }
      }),
    );
  });
});
