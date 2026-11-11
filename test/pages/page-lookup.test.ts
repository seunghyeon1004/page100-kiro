import { describe, expect, it } from "vitest";
import { lookupPage, nextInService, previousInService } from "../../src/pages/page-lookup.js";

describe("lookupPage (requirement 3.1)", () => {
  it("finds an in-service page", () => {
    const result = lookupPage("120");
    expect(result.kind).toBe("in-service");
    if (result.kind === "in-service") expect(result.def.number).toBe(120);
  });

  it("reports the nearest pages for a number that is not in service", () => {
    expect(lookupPage("123")).toEqual({
      kind: "not-in-service",
      number: 123,
      lower: 120,
      higher: 200,
    });
    expect(lookupPage("101")).toEqual({
      kind: "not-in-service",
      number: 101,
      lower: 100,
      higher: 110,
    });
    expect(lookupPage("898")).toEqual({
      kind: "not-in-service",
      number: 898,
      lower: 802,
      higher: 899,
    });
  });

  it.each(["", "99", "099", "900", "1000", "12a", " 123", "123 ", "123\n", "١٢٣", "12.5", "-12"])(
    "says %j is not a page number",
    (input) => {
      expect(lookupPage(input)).toEqual({ kind: "not-a-page-number" });
    },
  );
});

describe("previousInService and nextInService (requirements 3.2 and 3.3)", () => {
  it("steps to the neighbours", () => {
    expect(previousInService(110)).toBe(100);
    expect(nextInService(100)).toBe(110);
    expect(previousInService(123)).toBe(120);
    expect(nextInService(123)).toBe(200);
  });

  it("wraps around at both ends", () => {
    expect(previousInService(100)).toBe(899);
    expect(nextInService(899)).toBe(100);
  });

  it("returns undefined outside 100 to 899 and for non-integers", () => {
    for (const n of [99, 900, 100.5, Number.NaN, -1, 0, Number.POSITIVE_INFINITY]) {
      expect(previousInService(n), String(n)).toBeUndefined();
      expect(nextInService(n), String(n)).toBeUndefined();
    }
  });
});
