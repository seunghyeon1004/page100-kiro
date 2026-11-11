import { describe, expect, it } from "vitest";
import { formatHeaderClock, formatUtcTime } from "../../src/pages/frame-time.js";

describe("formatHeaderClock (requirement 6.1)", () => {
  it("truncates seconds: 2026-11-11T14:05:09.999Z is Wed 11 Nov 14:05:09", () => {
    expect(formatHeaderClock(new Date("2026-11-11T14:05:09.999Z"))).toBe("Wed 11 Nov 14:05:09");
  });

  it("pads day and time to two digits", () => {
    expect(formatHeaderClock(new Date("2023-01-01T00:00:00.000Z"))).toBe("Sun 01 Jan 00:00:00");
  });

  it("uses UTC at the end of the year", () => {
    expect(formatHeaderClock(new Date("2026-12-31T23:59:59.000Z"))).toBe("Thu 31 Dec 23:59:59");
  });

  it("is always 19 characters", () => {
    expect(formatHeaderClock(new Date(0))).toHaveLength(19);
    expect(formatHeaderClock(new Date(0))).toBe("Thu 01 Jan 00:00:00");
  });
});

describe("formatUtcTime (requirement 7.2)", () => {
  it("writes HH:MM UTC", () => {
    expect(formatUtcTime(new Date("2026-11-11T14:05:09.999Z"))).toBe("14:05 UTC");
    expect(formatUtcTime(new Date("2026-11-11T03:07:00.000Z"))).toBe("03:07 UTC");
  });
});
