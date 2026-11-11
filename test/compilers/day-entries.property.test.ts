import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { spreadByYear } from "../../src/compilers/day-entries.js";

// Property 13 (design.md): the births and deaths of page 501 are spread across the kept list.

const years = fc.integer({ min: -9999, max: 9999 }).filter((y) => y !== 0);
/** Entries with a unique text each (the index), so a duplicate pick can be seen; some do not fold. */
const lists = fc
  .array(fc.record({ year: years, folds: fc.boolean() }), { maxLength: 60 })
  .map((items) =>
    items.map((item, i) => ({
      year: item.year,
      text: item.folds ? `Item ${String(i)}` : "\u2603",
    })),
  );

describe("spreadByYear properties", () => {
  it("Property 13: no duplicates, sorted by year, and the entries at round(i (n - 1) / 3)", () => {
    fc.assert(
      fc.property(lists, fc.integer({ min: 1, max: 6 }), (list, count) => {
        const picked = spreadByYear(list, count);
        const texts = picked.map((d) => d.text);
        expect(new Set(texts).size).toBe(texts.length);
        expect(picked.length).toBeLessThanOrEqual(count);
        for (let i = 1; i < picked.length; i++) {
          expect(picked[i]?.year ?? 0).toBeGreaterThanOrEqual(picked[i - 1]?.year ?? 0);
        }
        // The kept list: entries that fold, sorted by year, stable.
        const kept = list.filter((e) => e.text !== "\u2603").sort((a, b) => a.year - b.year);
        if (kept.length <= count) {
          expect(picked.map((d) => d.text)).toEqual(kept.map((d) => d.text));
        }
        if (count === 4 && kept.length > 4) {
          const n = kept.length;
          const expected = [0, 1, 2, 3].map((i) => kept[Math.round((i * (n - 1)) / 3)]);
          expect(picked.map((d) => d.text)).toEqual(expected.map((d) => d?.text));
        }
      }),
    );
  });
});
