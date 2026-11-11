import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { moonAt } from "../../src/compilers/moon.js";

// Property 7 (design.md).

const times = fc.date({
  min: new Date(Date.UTC(1970, 0, 1)),
  max: new Date(Date.UTC(2100, 11, 31, 23, 59, 59, 999)),
  noInvalidDate: true,
});
const DAY = 86_400_000;
const LAST = Date.UTC(2100, 11, 31, 23, 59, 59, 999);

describe("moon properties", () => {
  it("Property 7: the state is defined, the next phases are within 30 days, and the moon is full or new at them", () => {
    fc.assert(
      fc.property(times, (t) => {
        const state = moonAt(t);
        expect(state).toBeDefined();
        if (state === undefined) return;
        expect(state.illuminated).toBeGreaterThanOrEqual(0);
        expect(state.illuminated).toBeLessThanOrEqual(1);
        for (const next of [state.nextFull, state.nextNew]) {
          expect(next.getTime()).toBeGreaterThan(t.getTime());
          expect(next.getTime() - t.getTime()).toBeLessThanOrEqual(30 * DAY);
        }
        // The two phases are about half a lunation apart.
        const gap = Math.abs(state.nextFull.getTime() - state.nextNew.getTime()) / DAY;
        expect(gap).toBeLessThan(30);
        const atFull = moonAt(state.nextFull);
        const atNew = moonAt(state.nextNew);
        // moonAt answers only up to 2100-12-31, so a phase after that has no state to check.
        if (state.nextFull.getTime() <= LAST)
          expect(atFull?.illuminated).toBeGreaterThanOrEqual(0.99);
        else expect(atFull).toBeUndefined();
        if (state.nextNew.getTime() <= LAST) expect(atNew?.illuminated).toBeLessThanOrEqual(0.01);
        else expect(atNew).toBeUndefined();
      }),
    );
  });
});
