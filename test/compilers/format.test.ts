import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatChange,
  formatDate,
  formatDayMonth,
  formatFullDate,
  formatInteger,
  formatKm,
  formatMagnitude,
  formatPercent,
  formatPrecipitation,
  formatRate,
  formatTemperature,
  formatTime,
  formatTimeUtc,
  formatWind,
  formatYear,
} from "../../src/compilers/format.js";

describe("formatters: the examples of requirement 2.4", () => {
  it("writes each example", () => {
    expect(formatInteger(12400, 99_999_999)).toBe("12,400");
    expect(formatTemperature(-3)).toBe("-3°C");
    expect(formatWind(22.4)).toBe("22 km/h");
    expect(formatPrecipitation(3.45)).toBe("3.5 mm");
    expect(formatRate(0.92131)).toBe("0.9213");
    expect(formatRate(151.271)).toBe("151.27");
    expect(formatRate(1382.4)).toBe("1,382");
    expect(formatRate(9.99996)).toBe("10.00");
    expect(formatChange(0.1549)).toBe("+0.15%");
    expect(formatChange(-1.024)).toBe("-1.02%");
    expect(formatMagnitude(5.25)).toBe("M5.3");
    expect(formatKm(10.2)).toBe("10 km");
    expect(formatPercent(86.5)).toBe("87%");
    expect(formatYear(-44)).toBe("44 BC");
    expect(formatYear(1066)).toBe("1066");
    expect(formatTime("2026-11-11T14:05:09Z")).toBe("14:05");
    expect(formatTimeUtc("2026-11-11T14:05:09Z")).toBe("14:05 UTC");
    expect(formatDate("2026-11-11T14:05:09Z")).toBe("Wed 11 Nov");
    expect(formatCalendarDate("2026-11-11")).toBe("Wed 11 Nov");
    expect(formatFullDate("2026-11-11")).toBe("11 Nov 2026");
    expect(formatDayMonth(11, 11)).toBe("11 Nov");
  });
});

describe("formatters: signs, bands and edges", () => {
  it("drops the sign of a result that prints as zero (2.3)", () => {
    expect(formatTemperature(-0.4)).toBe("0°C");
    expect(formatChange(-0.001)).toBe("0.00%");
    expect(formatChange(0)).toBe("0.00%");
    expect(formatTemperature(Object.is(-0, -0) ? -0 : 0)).toBe("0°C");
  });

  it("chooses 4, 2 or 0 decimals by the printed band (2.5)", () => {
    expect(formatRate(9.9999)).toBe("9.9999");
    expect(formatRate(10)).toBe("10.00");
    expect(formatRate(999.99)).toBe("999.99");
    expect(formatRate(999.996)).toBe("1,000");
    expect(formatRate(1000)).toBe("1,000");
    expect(formatRate(999_999.4)).toBe("999,999");
  });

  it("rounds half away from zero", () => {
    expect(formatTemperature(2.5)).toBe("3°C");
    expect(formatTemperature(-2.5)).toBe("-3°C");
    expect(formatMagnitude(-1.25)).toBe("M-1.3");
  });

  it("prints n/a at and beyond each range edge (2.2)", () => {
    expect(formatTemperature(100)).toBe("100°C");
    expect(formatTemperature(100.1)).toBe("n/a");
    expect(formatTemperature(-100)).toBe("-100°C");
    expect(formatTemperature(-100.1)).toBe("n/a");
    expect(formatWind(999)).toBe("999 km/h");
    expect(formatWind(999.5)).toBe("n/a");
    expect(formatWind(-1)).toBe("n/a");
    expect(formatPrecipitation(999)).toBe("999.0 mm");
    expect(formatPrecipitation(999.1)).toBe("n/a");
    expect(formatRate(0)).toBe("n/a");
    expect(formatRate(-1)).toBe("n/a");
    expect(formatRate(999_999.5)).toBe("n/a");
    expect(formatChange(999.99)).toBe("+999.99%");
    expect(formatChange(-999.99)).toBe("-999.99%");
    expect(formatChange(1000)).toBe("n/a");
    expect(formatMagnitude(10)).toBe("M10.0");
    expect(formatMagnitude(10.1)).toBe("n/a");
    expect(formatMagnitude(-2)).toBe("M-2.0");
    expect(formatMagnitude(-2.1)).toBe("n/a");
    expect(formatKm(1000)).toBe("1,000 km");
    expect(formatKm(1000.5)).toBe("n/a");
    expect(formatKm(-100)).toBe("-100 km");
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(100.5)).toBe("n/a");
    expect(formatPercent(-0.1)).toBe("n/a");
  });

  it("formats the largest integer and rejects one past the maximum", () => {
    expect(formatInteger(1e8, 99_999_999)).toBe("n/a");
    expect(formatInteger(99_999_999, 99_999_999)).toBe("99,999,999");
    expect(formatInteger(5, 1e12)).toBe("5");
    expect(formatInteger(100, 99)).toBe("n/a");
    expect(formatInteger(-1, 99)).toBe("n/a");
  });

  it("prints n/a for null, NaN and the infinities", () => {
    for (const bad of [null, Number.NaN, Infinity, -Infinity]) {
      expect(formatTemperature(bad)).toBe("n/a");
      expect(formatRate(bad)).toBe("n/a");
      expect(formatInteger(bad, 99)).toBe("n/a");
      expect(formatYear(bad)).toBe("n/a");
    }
    expect(formatTime(null)).toBe("n/a");
    expect(formatTime("not a time")).toBe("n/a");
    expect(formatTime(new Date(Number.NaN))).toBe("n/a");
    expect(formatTime("1969-12-31T23:59:59Z")).toBe("n/a");
    expect(formatTime("2200-01-01T00:00:00Z")).toBe("n/a");
    expect(formatTimeUtc("2026-11-11")).toBe("n/a");
  });

  it("checks calendar dates and day-months", () => {
    expect(formatCalendarDate("2026-02-30")).toBe("n/a");
    expect(formatCalendarDate("2026-13-01")).toBe("n/a");
    expect(formatCalendarDate(null)).toBe("n/a");
    expect(formatFullDate("1969-12-31")).toBe("n/a");
    expect(formatDayMonth(2, 29)).toBe("29 Feb");
    expect(formatDayMonth(2, 30)).toBe("n/a");
    expect(formatDayMonth(4, 31)).toBe("n/a");
    expect(formatDayMonth(0, 1)).toBe("n/a");
    expect(formatDayMonth(1.5, 1)).toBe("n/a");
    expect(formatDayMonth(1, 5)).toBe("05 Jan");
  });

  it("formats years", () => {
    expect(formatYear(0)).toBe("n/a");
    expect(formatYear(1.5)).toBe("n/a");
    expect(formatYear(9999)).toBe("9999");
    expect(formatYear(-9999)).toBe("9999 BC");
    expect(formatYear(10_000)).toBe("n/a");
  });

  it("accepts a Date and a zoned ISO string for times", () => {
    expect(formatTimeUtc(new Date("2026-11-11T14:05:09Z"))).toBe("14:05 UTC");
    expect(formatTime("2026-11-11T16:05:09+02:00")).toBe("14:05");
  });
});
