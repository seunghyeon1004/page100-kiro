import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { serialisePage } from "../../src/markup/serialise-page.js";
import { buildScreen } from "../../src/pages/build-screen.js";
import { frameLines } from "./frame-markup.js";
import { defWithCompiled, frameDate } from "./page-arbitraries.js";

/** A generated case: a def, its compiled page, an index in range, and the frame options. */
const screenCase = defWithCompiled.chain(({ def, compiled }) =>
  fc
    .record({
      index: fc.integer({ min: 0, max: compiled.subpages.length - 1 }),
      now: frameDate,
      lastGoodAt: fc.option(frameDate, { nil: null }),
      stale: fc.boolean(),
    })
    .map((rest) => ({ def, compiled, ...rest })),
);

describe("buildScreen properties", () => {
  it("Property 1: buildScreen succeeds, keeps the content rows, mutates nothing and is deterministic", () => {
    fc.assert(
      fc.property(screenCase, ({ def, compiled, index, now, lastGoodAt, stale }) => {
        const opts = { now, stale, lastGoodAt };
        const before = structuredClone({ def, compiled, opts });
        const first = buildScreen(def, compiled, index, opts);
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        expect(first.page).toHaveLength(24);
        expect(first.page.slice(2, 22)).toEqual(compiled.subpages[index]?.content);
        expect({ def, compiled, opts }).toEqual(before);
        expect(buildScreen(def, compiled, index, opts)).toEqual(first);
      }),
    );
  });

  it("Property 2: lines 0, 1, 22 and 23 equal markup written independently from the frame table", () => {
    fc.assert(
      fc.property(screenCase, ({ def, compiled, index, now, lastGoodAt, stale }) => {
        const result = buildScreen(def, compiled, index, { now, stale, lastGoodAt });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const out = serialisePage(result.page).split("\n");
        const [row0, row1, row22, row23] = frameLines({
          def,
          subpageIndex: index,
          subpageCount: compiled.subpages.length,
          now,
          stale,
          lastGoodAt,
        });
        expect(out[0]).toBe(row0);
        expect(out[1]).toBe(row1);
        expect(out[22]).toBe(row22);
        expect(out[23]).toBe(row23);
      }),
    );
  });
});
