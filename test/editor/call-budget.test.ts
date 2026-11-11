import { describe, expect, it } from "vitest";
import { createCallBudget } from "../../src/editor/call-budget.js";

const D1 = new Date("2026-11-11T23:59:59Z");
const D2 = new Date("2026-11-12T00:00:00Z");

describe("createCallBudget (requirements 10.1 to 10.3)", () => {
  it("reserves while both caps allow, and refuses what would pass either", () => {
    const budget = createCallBudget(5, 3);
    expect(budget.tryReserve(2, D1)).toBe(true);
    expect(budget.tryReserve(2, D1)).toBe(false); // boot cap 3 would be 4
    expect(budget.tryReserve(1, D1)).toBe(true);
    expect(budget.tryReserve(1, D1)).toBe(false);
    expect(budget.usage(D1)).toMatchObject({ callsToday: 3, callsThisBoot: 3 });
  });

  it("refuses when the daily cap is the lower one", () => {
    const budget = createCallBudget(2, 10);
    expect(budget.tryReserve(2, D1)).toBe(true);
    expect(budget.tryReserve(1, D1)).toBe(false);
  });

  it("refuses everything with a cap of 0", () => {
    expect(createCallBudget(0, 10).tryReserve(1, D1)).toBe(false);
    expect(createCallBudget(10, 0).tryReserve(1, D1)).toBe(false);
  });

  it("gives back unused calls on settle, to both counts", () => {
    const budget = createCallBudget(5, 5);
    expect(budget.tryReserve(2, D1)).toBe(true);
    budget.settle(2, 1);
    expect(budget.usage(D1)).toMatchObject({ callsToday: 1, callsThisBoot: 1 });
    expect(budget.tryReserve(2, D1)).toBe(true);
    budget.settle(2, 0);
    budget.settle(2, 7); // more than reserved: nothing is given back
    expect(budget.usage(D1)).toMatchObject({ callsToday: 1, callsThisBoot: 1 });
  });

  it("resets the daily count on a later UTC day and keeps the boot count", () => {
    const budget = createCallBudget(2, 10);
    expect(budget.tryReserve(2, D1)).toBe(true);
    expect(budget.tryReserve(1, D1)).toBe(false);
    expect(budget.tryReserve(1, D2)).toBe(true);
    expect(budget.usage(D2)).toEqual({
      day: "2026-11-12",
      callsToday: 1,
      capPerDay: 2,
      callsThisBoot: 3,
      capPerBoot: 10,
    });
  });

  it("never resets for an earlier day", () => {
    const budget = createCallBudget(2, 10);
    expect(budget.tryReserve(2, D2)).toBe(true);
    expect(budget.tryReserve(1, D1)).toBe(false);
    expect(budget.usage(D1).day).toBe("2026-11-12");
  });

  it("holds at most the boot cap however many days pass", () => {
    const budget = createCallBudget(100, 3);
    let spent = 0;
    for (let d = 0; d < 10; d++) {
      const now = new Date(Date.UTC(2026, 10, 11 + d, 12));
      if (budget.tryReserve(1, now)) spent++;
    }
    expect(spent).toBe(3);
  });

  it("is a fresh budget after a restart: a new object starts at 0", () => {
    const first = createCallBudget(2, 2);
    first.tryReserve(2, D1);
    expect(createCallBudget(2, 2).tryReserve(2, D1)).toBe(true);
  });

  it("refuses an invalid time or count and never throws", () => {
    const budget = createCallBudget(5, 5);
    expect(budget.tryReserve(1, new Date(Number.NaN))).toBe(false);
    expect(budget.tryReserve(-1, D1)).toBe(false);
    expect(budget.tryReserve(1.5, D1)).toBe(false);
    expect(budget.usage(new Date(Number.NaN))).toMatchObject({ day: null, callsToday: 0 });
  });
});
