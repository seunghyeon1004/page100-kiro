import fc from "fast-check";
import { describe, it } from "vitest";
import { isRepertoireCodePoint, REPERTOIRE } from "../../src/grid/repertoire.js";

describe("repertoire properties (Property 3)", () => {
  it("Property 3: the range test agrees with the array for all integers and arbitrary doubles", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: -16, max: 0x110010 }), fc.double()),
        (n) => isRepertoireCodePoint(n) === REPERTOIRE.includes(n),
      ),
    );
  });
});
