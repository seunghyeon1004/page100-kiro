import fc from "fast-check";
import { describe, it } from "vitest";
import { mosaicBitsOf, mosaicCodePoint } from "../../src/grid/mosaic-code-point.js";

describe("mosaic properties (Property 2)", () => {
  it("Property 2: the mapping inverts exactly, and only integers from 0 to 63 have a code point", () => {
    // Every pattern v from 0 to 63 round-trips.
    for (let v = 0; v <= 63; v++) {
      const cp = mosaicCodePoint(v);
      if (cp === undefined || mosaicBitsOf(cp) !== v) {
        throw new Error(`pattern ${String(v)} does not round-trip`);
      }
    }

    // Every code point from 0 to U+10FFFF that is a mosaic form maps back to itself.
    for (let cp = 0; cp <= 0x10ffff; cp++) {
      const v = mosaicBitsOf(cp);
      if (v !== undefined && mosaicCodePoint(v) !== cp) {
        throw new Error(`code point ${String(cp)} does not round-trip`);
      }
    }

    // Numbers that are not integers from 0 to 63 have no code point.
    fc.assert(
      fc.property(
        fc.double().filter((x) => !(Number.isInteger(x) && x >= 0 && x <= 63)),
        (x) => mosaicCodePoint(x) === undefined,
      ),
    );

    // Random integers in and around the range agree with the same test.
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 200 }), (v) => {
        const cp = mosaicCodePoint(v);
        return v >= 0 && v <= 63 ? cp !== undefined : cp === undefined;
      }),
    );
  });
});
