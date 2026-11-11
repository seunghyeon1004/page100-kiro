import { describe, expect, it } from "vitest";
import { serialisePage } from "../../src/markup/serialise-page.js";
import { buildScreen } from "../../src/pages/build-screen.js";
import type { ScreenResult } from "../../src/pages/build-screen.js";
import { findPage } from "../../src/pages/registry.js";
import { blankCompiled } from "./page-arbitraries.js";

const NOW = new Date("2026-11-11T14:05:09.999Z");
const GOOD = new Date("2026-11-11T14:00:42.000Z");

function def(number: number) {
  const found = findPage(number);
  if (found === undefined) throw new Error(`page ${String(number)} is not in the registry`);
  return found;
}

function lines(result: ScreenResult): string[] {
  if (!result.ok) throw new Error(`buildScreen failed: ${result.error}`);
  return serialisePage(result.page).split("\n");
}

describe("buildScreen rows 0 and 1 (requirements 6.1 and 6.2)", () => {
  it("writes page 201, subpage 2 of 6, at 2026-11-11T14:05:09.999Z", () => {
    const out = lines(
      buildScreen(def(201), blankCompiled(201, 6), 1, { now: NOW, stale: false, lastGoodAt: GOOD }),
    );
    expect(out[0]).toBe("P201 {c}Page 100{w}        {y}Wed 11 Nov 14:05:09");
    expect(out[1]).toBe(`{B}{y}FIVE-DAY OUTLOOK{w}${" ".repeat(21)}2/6`);
  });

  it("shows no subpage indicator for a single subpage", () => {
    const out = lines(
      buildScreen(def(201), blankCompiled(201, 1), 0, { now: NOW, stale: false, lastGoodAt: GOOD }),
    );
    expect(out[1]).toBe(`{B}{y}FIVE-DAY OUTLOOK{w}${" ".repeat(24)}`);
    expect(out[1]).not.toContain("/");
  });

  it("shows 9/9 on the ninth of nine subpages", () => {
    const out = lines(
      buildScreen(def(200), blankCompiled(200, 9), 8, { now: NOW, stale: false, lastGoodAt: GOOD }),
    );
    expect(out[1]?.endsWith("9/9")).toBe(true);
  });
});

describe("buildScreen row 22 (requirements 7.1 to 7.3)", () => {
  it("writes the attribution and the last good time for a fresh page", () => {
    const out = lines(
      buildScreen(def(201), blankCompiled(201, 1), 0, { now: NOW, stale: false, lastGoodAt: GOOD }),
    );
    expect(out[22]).toBe("{c}Weather: Open-Meteo, CC BY 4.0{w} 14:00 UTC");
  });

  it("writes only the attribution when there is no last good time", () => {
    const out = lines(
      buildScreen(def(300), blankCompiled(300, 1), 0, { now: NOW, stale: false, lastGoodAt: null }),
    );
    expect(out[22]).toBe("{c}Rates: ECB via Frankfurter");
  });

  it("writes the delay message when stale, with the last good time", () => {
    const out = lines(
      buildScreen(def(300), blankCompiled(300, 1), 0, { now: NOW, stale: true, lastGoodAt: GOOD }),
    );
    expect(out[22]).toBe("{y}Data delayed: last good 14:00 UTC");
  });

  it("writes Data delayed alone when stale with no last good time", () => {
    const out = lines(
      buildScreen(def(300), blankCompiled(300, 1), 0, { now: NOW, stale: true, lastGoodAt: null }),
    );
    expect(out[22]).toBe("{y}Data delayed");
  });

  it("names Computed by Page 100 on page 601", () => {
    const out = lines(
      buildScreen(def(601), blankCompiled(601, 1), 0, { now: NOW, stale: false, lastGoodAt: GOOD }),
    );
    expect(out[22]).toBe("{c}Computed by Page 100{w}           14:00 UTC");
  });

  it("leaves row 22 blank on a static page, even when stale", () => {
    for (const stale of [false, true]) {
      const out = lines(
        buildScreen(def(800), blankCompiled(800, 1, "static"), 0, {
          now: NOW,
          stale,
          lastGoodAt: GOOD,
        }),
      );
      expect(out[22]).toBe("");
    }
  });
});

describe("buildScreen row 23 (requirement 7.5)", () => {
  it("writes the four coloured blocks of page 201", () => {
    const out = lines(
      buildScreen(def(201), blankCompiled(201, 1), 0, { now: NOW, stale: false, lastGoodAt: GOOD }),
    );
    expect(out[23]).toBe("{R}{k} Index    {G} Now      {Y} News     {B}{w} Rates    ");
  });
});

describe("buildScreen errors (requirements 5.1 and 5.2)", () => {
  const opts = { now: NOW, stale: false, lastGoodAt: GOOD };

  it("reports page-mismatch when the compiled page has another number", () => {
    expect(buildScreen(def(201), blankCompiled(200, 1), 0, opts)).toEqual({
      ok: false,
      error: "page-mismatch",
    });
  });

  it("reports subpage-count for 10 subpages", () => {
    expect(buildScreen(def(201), blankCompiled(201, 10), 0, opts)).toEqual({
      ok: false,
      error: "subpage-count",
    });
  });

  it.each([-1, 1.5, 6, Number.NaN, Number.POSITIVE_INFINITY])(
    "reports subpage-index for index %s of 6",
    (index) => {
      expect(buildScreen(def(201), blankCompiled(201, 6), index, opts)).toEqual({
        ok: false,
        error: "subpage-index",
      });
    },
  );

  it("reports time-invalid for an invalid now or lastGoodAt", () => {
    const compiled = blankCompiled(201, 1);
    expect(buildScreen(def(201), compiled, 0, { ...opts, now: new Date(Number.NaN) })).toEqual({
      ok: false,
      error: "time-invalid",
    });
    expect(
      buildScreen(def(201), compiled, 0, { ...opts, lastGoodAt: new Date(Number.NaN) }),
    ).toEqual({ ok: false, error: "time-invalid" });
  });

  it("runs the checks in the order mismatch, count, index, time", () => {
    const bad = { now: new Date(Number.NaN), stale: false, lastGoodAt: null };
    expect(buildScreen(def(201), blankCompiled(200, 10), 99, bad)).toMatchObject({
      error: "page-mismatch",
    });
    expect(buildScreen(def(201), blankCompiled(201, 10), 99, bad)).toMatchObject({
      error: "subpage-count",
    });
    expect(buildScreen(def(201), blankCompiled(201, 2), 99, bad)).toMatchObject({
      error: "subpage-index",
    });
    expect(buildScreen(def(201), blankCompiled(201, 2), 1, bad)).toMatchObject({
      error: "time-invalid",
    });
  });

  it("returns 24 rows whose content rows equal the chosen subpage (5.4)", () => {
    const compiled = blankCompiled(201, 3);
    const result = buildScreen(def(201), compiled, 2, opts);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.page).toHaveLength(24);
      expect(result.page.slice(2, 22)).toEqual(compiled.subpages[2]?.content);
    }
  });
});
