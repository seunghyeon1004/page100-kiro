import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { lookupPage, nextInService, previousInService } from "../../src/pages/page-lookup.js";
import { REGISTRY, findPage } from "../../src/pages/registry.js";

const inService = (n: number): boolean => findPage(n) !== undefined;

describe("page lookup properties", () => {
  it("Property 3: neighbours are in service, nearest and inverse; link targets are in service; other numbers give undefined", () => {
    const neighbours = fc.property(fc.integer({ min: 100, max: 899 }), (n) => {
      const prev = previousInService(n);
      const next = nextInService(n);
      expect(prev).toBeDefined();
      expect(next).toBeDefined();
      if (prev === undefined || next === undefined) return;
      expect(inService(prev)).toBe(true);
      expect(inService(next)).toBe(true);
      // Nothing in service lies strictly between a neighbour and n, wrap aside.
      if (prev < n) {
        for (let k = prev + 1; k < n; k++) expect(inService(k)).toBe(false);
      } else {
        expect(prev).toBe(899);
        for (let k = 100; k < n; k++) expect(inService(k)).toBe(false);
      }
      if (next > n) {
        for (let k = n + 1; k < next; k++) expect(inService(k)).toBe(false);
      } else {
        expect(next).toBe(100);
        for (let k = n + 1; k <= 899; k++) expect(inService(k)).toBe(false);
      }
      if (inService(n)) {
        expect(previousInService(next)).toBe(n);
        expect(nextInService(prev)).toBe(n);
      }
    });

    const links = fc.property(fc.constantFrom(...REGISTRY), (d) => {
      for (const l of d.links) {
        expect(inService(l.target)).toBe(true);
        expect(l.target).not.toBe(d.number);
      }
    });

    const other = fc.oneof(
      fc.integer({ min: -2000, max: 99 }),
      fc.integer({ min: 900, max: 2000 }),
      fc.double({ noInteger: true }),
      fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
    );
    const outside = fc.property(other, (n) => {
      expect(previousInService(n)).toBeUndefined();
      expect(nextInService(n)).toBeUndefined();
    });

    fc.assert(neighbours);
    fc.assert(links);
    fc.assert(outside);
  });

  it("Property 4: lookupPage agrees with the oracle for every string and never throws", () => {
    const strings = fc.oneof(
      fc.string({ unit: "binary" }),
      fc.stringMatching(/^[0-9]{0,4}$/),
      fc.integer({ min: 0, max: 1100 }).map((n) => String(n).padStart(3, "0")),
      fc.constantFrom("١٢٣", " 123", "123 ", "123\n", "0x7b", "１２３"),
    );
    fc.assert(
      fc.property(strings, (s) => {
        const result = lookupPage(s);
        const looksRight = /^[0-9]{3}$/.test(s) && Number(s) >= 100 && Number(s) <= 899;
        if (!looksRight) {
          expect(result.kind).toBe("not-a-page-number");
          return;
        }
        const n = Number(s);
        if (inService(n)) {
          expect(result.kind).toBe("in-service");
          if (result.kind === "in-service") expect(result.def.number).toBe(n);
        } else {
          expect(result.kind).toBe("not-in-service");
          if (result.kind === "not-in-service") {
            expect(result.number).toBe(n);
            expect(result.lower).toBeLessThan(n);
            expect(result.higher).toBeGreaterThan(n);
            expect(result.lower).toBe(previousInService(n));
            expect(result.higher).toBe(nextInService(n));
          }
        }
      }),
    );
  });
});
