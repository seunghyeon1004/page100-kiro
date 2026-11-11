import { describe, expect, it } from "vitest";
import { SOURCE_IDS } from "../../src/sources/source-id.js";
import { JITTER_FRACTION, SCHEDULE, isStale } from "../../src/sources/schedule.js";

const MIN = 60_000;

describe("SCHEDULE (requirement 14.1)", () => {
  it("has the intervals of design.md, 'Schedule'", () => {
    expect(
      SOURCE_IDS.map((id) => [id, SCHEDULE[id].intervalMs, SCHEDULE[id].staleAfterMs]),
    ).toEqual([
      ["wikimedia-feed", 30 * MIN, 60 * MIN],
      ["wikimedia-onthisday", 86_400_000, 172_800_000],
      ["open-meteo", 30 * MIN, 60 * MIN],
      ["frankfurter", 60 * MIN, 120 * MIN],
      ["hacker-news", 10 * MIN, 20 * MIN],
      ["usgs", 10 * MIN, 20 * MIN],
      ["launch-library", 60 * MIN, 120 * MIN],
    ]);
  });

  it("allows retry for every source except Launch Library", () => {
    for (const id of SOURCE_IDS) expect(SCHEDULE[id].retry, id).toBe(id !== "launch-library");
  });

  it("marks the scheduler notes", () => {
    expect(SCHEDULE["wikimedia-onthisday"].alignToUtcMidnight).toBe(true);
    expect(SCHEDULE["launch-library"].strictInterval).toBe(true);
    expect(SCHEDULE.usgs.alignToUtcMidnight).toBe(false);
    expect(SCHEDULE.usgs.strictInterval).toBe(false);
  });

  it("has a jitter fraction of 0.1", () => {
    expect(JITTER_FRACTION).toBe(0.1);
  });
});

describe("isStale (requirement 14.2)", () => {
  const t0 = new Date("2026-11-11T12:00:00.000Z");

  it("is false at exactly twice the interval and true one millisecond later", () => {
    const edge = new Date(t0.getTime() + 60 * MIN);
    expect(isStale("usgs", t0, new Date(t0.getTime() + 20 * MIN))).toBe(false);
    expect(isStale("usgs", t0, new Date(t0.getTime() + 20 * MIN + 1))).toBe(true);
    expect(isStale("open-meteo", t0, edge)).toBe(false);
    expect(isStale("open-meteo", t0, new Date(edge.getTime() + 1))).toBe(true);
  });

  it("uses 48 hours for on this day", () => {
    expect(isStale("wikimedia-onthisday", t0, new Date(t0.getTime() + 172_800_000))).toBe(false);
    expect(isStale("wikimedia-onthisday", t0, new Date(t0.getTime() + 172_800_001))).toBe(true);
  });
});
