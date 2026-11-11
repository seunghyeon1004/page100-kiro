import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SCHEDULE, isStale } from "../../src/sources/schedule.js";
import { SOURCE_IDS } from "../../src/sources/source-id.js";

describe("schedule properties", () => {
  it("Property 12: isStale is true exactly when more than twice the interval has passed", () => {
    const limit = 2 ** 41;
    fc.assert(
      fc.property(
        fc.constantFrom(...SOURCE_IDS),
        fc.integer({ min: 0, max: limit }),
        fc.integer({ min: 0, max: limit }),
        (source, t0, t1) => {
          expect(isStale(source, new Date(t0), new Date(t1))).toBe(
            t1 - t0 > 2 * SCHEDULE[source].intervalMs,
          );
        },
      ),
    );
  });

  it("the staleness boundary is exact for every source", () => {
    // Random times rarely land on the boundary, so this checks it directly.
    for (const source of SOURCE_IDS) {
      const stale = 2 * SCHEDULE[source].intervalMs;
      expect(isStale(source, new Date(1000), new Date(1000 + stale))).toBe(false);
      expect(isStale(source, new Date(1000), new Date(1000 + stale + 1))).toBe(true);
    }
  });
});
