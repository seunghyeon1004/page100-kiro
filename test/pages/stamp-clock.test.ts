import { describe, expect, it } from "vitest";
import { buildScreen } from "../../src/pages/build-screen.js";
import type { CompiledPage } from "../../src/pages/compiled-page.js";
import { stampClock } from "../../src/pages/stamp-clock.js";
import { notInServicePage } from "../../src/pages/not-in-service.js";

// server-and-viewer 9.5: the stamp equals what the frame builder gives at that time.

const T1 = new Date("2026-11-11T14:05:09.000Z");
const T2 = new Date("2027-02-03T23:59:58.000Z");

function screenAt(now: Date) {
  const nis = notInServicePage(123);
  if (!nis.ok) throw new Error("expected a page");
  const compiled: CompiledPage = nis.compiled;
  const built = buildScreen(nis.def, compiled, 0, { now, stale: false, lastGoodAt: null });
  if (!built.ok) throw new Error("expected a screen");
  return built.page;
}

describe("stampClock", () => {
  it("gives the screen the frame builder would give at the new time", () => {
    expect(stampClock(screenAt(T1), T2)).toEqual(screenAt(T2));
  });

  it("changes nothing when the time is the same", () => {
    expect(stampClock(screenAt(T1), T1)).toEqual(screenAt(T1));
  });

  it("returns the screen itself for an invalid time", () => {
    const screen = screenAt(T1);
    expect(stampClock(screen, new Date(Number.NaN))).toBe(screen);
  });

  it("leaves every row but row 0 as it was, and row 0 before col 21", () => {
    const before = screenAt(T1);
    const after = stampClock(before, T2);
    expect(after.slice(1)).toEqual(before.slice(1));
    expect(after[0]?.slice(0, 21)).toEqual(before[0]?.slice(0, 21));
  });

  it("does not change its input", () => {
    const before = screenAt(T1);
    const copy = structuredClone(before);
    stampClock(before, T2);
    expect(before).toEqual(copy);
  });
});
