import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildScreen } from "../../src/pages/build-screen.js";
import { checkCompiledPage } from "../../src/pages/check-compiled-page.js";
import { notInServicePage } from "../../src/pages/not-in-service.js";
import { findPage } from "../../src/pages/registry.js";
import { frameDate } from "./page-arbitraries.js";

const notInService = fc.integer({ min: 100, max: 899 }).filter((n) => findPage(n) === undefined);

describe("not-in-service properties", () => {
  it("Property 5: every number not in service gets a sound compiled page and a valid screen", () => {
    fc.assert(
      fc.property(
        notInService,
        frameDate,
        fc.option(frameDate, { nil: null }),
        fc.boolean(),
        (n, now, lastGoodAt, stale) => {
          const result = notInServicePage(n);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(checkCompiledPage(result.def, result.compiled)).toEqual([]);
          const screen = buildScreen(result.def, result.compiled, 0, { now, stale, lastGoodAt });
          expect(screen.ok).toBe(true);
        },
      ),
    );
  });
});
