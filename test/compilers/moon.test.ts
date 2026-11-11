import { describe, expect, it } from "vitest";
import { moonAt, phaseName } from "../../src/compilers/moon.js";

// Expected times from F. Espenak, "Phases of the Moon: 2001 to 2100", astropixels.com (UT).

const FIVE_MINUTES = 5 * 60 * 1000;

function near(actual: Date | undefined, expected: string): void {
  expect(actual).toBeDefined();
  const diff = Math.abs((actual?.getTime() ?? Number.NaN) - Date.parse(expected));
  expect(diff, `${actual?.toISOString() ?? "undefined"} against ${expected}`).toBeLessThanOrEqual(
    FIVE_MINUTES,
  );
}

describe("moonAt: the known dates of the design (requirement 6.2)", () => {
  it("finds the next new moon from 2001-01-20", () => {
    near(moonAt(new Date("2001-01-20T00:00:00Z"))?.nextNew, "2001-01-24T13:07:00Z");
  });

  it("finds the next new and full moon from 2024-04-01", () => {
    const state = moonAt(new Date("2024-04-01T00:00:00Z"));
    near(state?.nextNew, "2024-04-08T18:21:00Z");
    near(state?.nextFull, "2024-04-23T23:49:00Z");
  });

  it("finds the next full and new moon from 2025-01-07", () => {
    const state = moonAt(new Date("2025-01-07T00:00:00Z"));
    near(state?.nextFull, "2025-01-13T22:27:00Z");
    near(state?.nextNew, "2025-01-29T12:36:00Z");
  });

  it("finds the next full and new moon from 2026-11-11T14:05:09Z", () => {
    const state = moonAt(new Date("2026-11-11T14:05:09Z"));
    near(state?.nextFull, "2026-11-24T14:53:00Z");
    near(state?.nextNew, "2026-12-09T00:52:00Z");
  });
});

describe("moonAt: illumination at the known phases (requirement 6.3)", () => {
  it("is at least 0.99 at full moons", () => {
    for (const t of ["2026-11-24T14:53:00Z", "2024-04-23T23:49:00Z", "2025-01-13T22:27:00Z"]) {
      expect(moonAt(new Date(t))?.illuminated, t).toBeGreaterThanOrEqual(0.99);
      expect(moonAt(new Date(t))?.phase, t).toBe("Full moon");
    }
  });

  it("is at most 0.01 at new moons", () => {
    for (const t of [
      "2024-04-08T18:21:00Z",
      "2025-01-29T12:36:00Z",
      "2026-12-09T00:52:00Z",
      "2001-01-24T13:07:00Z",
    ]) {
      expect(moonAt(new Date(t))?.illuminated, t).toBeLessThanOrEqual(0.01);
      expect(moonAt(new Date(t))?.phase, t).toBe("New moon");
    }
  });

  it("is from 0.45 to 0.55 at the quarters, waxing at the first and waning at the last", () => {
    const first = moonAt(new Date("2026-11-17T11:48:00Z"));
    const last = moonAt(new Date("2026-12-01T06:09:00Z"));
    expect(first?.illuminated).toBeGreaterThanOrEqual(0.45);
    expect(first?.illuminated).toBeLessThanOrEqual(0.55);
    expect(first?.waxing).toBe(true);
    expect(first?.phase).toBe("First quarter");
    expect(last?.illuminated).toBeGreaterThanOrEqual(0.45);
    expect(last?.illuminated).toBeLessThanOrEqual(0.55);
    expect(last?.waxing).toBe(false);
    expect(last?.phase).toBe("Last quarter");
  });
});

describe("phaseName: the eight bands (requirement 6.4)", () => {
  it("changes name exactly at the band edges", () => {
    const edges: [number, string][] = [
      [0, "New moon"],
      [22.4, "New moon"],
      [22.5, "Waxing crescent"],
      [67.4, "Waxing crescent"],
      [67.5, "First quarter"],
      [112.4, "First quarter"],
      [112.5, "Waxing gibbous"],
      [157.4, "Waxing gibbous"],
      [157.5, "Full moon"],
      [202.4, "Full moon"],
      [202.5, "Waning gibbous"],
      [247.4, "Waning gibbous"],
      [247.5, "Last quarter"],
      [292.4, "Last quarter"],
      [292.5, "Waning crescent"],
      [337.4, "Waning crescent"],
      [337.5, "New moon"],
      [359.9, "New moon"],
      [360, "New moon"],
      [-10, "New moon"],
    ];
    for (const [elongation, name] of edges)
      expect(phaseName(elongation), String(elongation)).toBe(name);
  });
});

describe("moonAt: range", () => {
  it("gives undefined outside 1970 to 2100 and for an invalid Date", () => {
    expect(moonAt(new Date("1969-12-31T23:59:59.999Z"))).toBeUndefined();
    expect(moonAt(new Date("2101-01-01T00:00:00Z"))).toBeUndefined();
    expect(moonAt(new Date(Number.NaN))).toBeUndefined();
    expect(moonAt(new Date("1970-01-01T00:00:00Z"))).toBeDefined();
    expect(moonAt(new Date("2100-12-31T23:59:59.999Z"))).toBeDefined();
  });
});
