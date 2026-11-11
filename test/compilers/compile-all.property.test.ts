import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compileAll } from "../../src/compilers/compile-all.js";
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
  formatRate,
  formatTemperature,
  formatTime,
  formatTimeUtc,
  formatWind,
  formatYear,
} from "../../src/compilers/format.js";
import { moonAt } from "../../src/compilers/moon.js";
import type { ServiceStatus } from "../../src/compilers/service-status.js";
import type { Snapshot } from "../../src/sources/snapshot.js";
import { buildScreen } from "../../src/pages/build-screen.js";
import { checkCompiledPage } from "../../src/pages/check-compiled-page.js";
import { REGISTRY, findPage } from "../../src/pages/registry.js";
import { pageFilesArb, snapshotArb, statusArb, time } from "./compile-arbitraries.js";

// Properties 1, 2, 3 and 5 (design.md).

const inputs = fc.tuple(snapshotArb, statusArb, time, pageFilesArb);

describe("compileAll properties", () => {
  it("Property 1: no throw, 30 outcomes in registry order, none failed, and every subpage frames with both stale values", () => {
    fc.assert(
      fc.property(inputs, ([snapshot, status, now, files]) => {
        const result = compileAll(snapshot, status, now, files);
        expect(result.outcomes.map((o) => o.number)).toEqual(REGISTRY.map((d) => d.number));
        expect(result.outcomes).toHaveLength(30);
        const failed = result.outcomes.filter((o) => o.outcome === "failed");
        expect(failed).toEqual([]);
        expect(result.pages.map((p) => p.number)).toEqual(REGISTRY.map((d) => d.number));
        for (const page of result.pages) {
          const def = findPage(page.number);
          expect(def).toBeDefined();
          if (def === undefined) continue;
          expect(page.subpages.length).toBeGreaterThanOrEqual(1);
          expect(page.subpages.length).toBeLessThanOrEqual(9);
          page.subpages.forEach((_, i) => {
            for (const stale of [false, true]) {
              const screen = buildScreen(def, page, i, { now, stale, lastGoodAt: page.dataAt });
              expect(
                screen.ok,
                `page ${String(page.number)} subpage ${String(i)} stale ${String(stale)}`,
              ).toBe(true);
            }
          });
        }
      }),
    );
  });

  it("Property 2: checkCompiledPage is empty for every returned page", () => {
    fc.assert(
      fc.property(inputs, ([snapshot, status, now, files]) => {
        for (const page of compileAll(snapshot, status, now, files).pages) {
          const def = findPage(page.number);
          if (def === undefined) throw new Error("page not in registry");
          expect(checkCompiledPage(def, page), `page ${String(page.number)}`).toEqual([]);
        }
      }),
    );
  });

  it("Property 3: two calls give deep-equal results, and no input is changed", () => {
    fc.assert(
      fc.property(inputs, ([snapshot, status, now, files]) => {
        const before = structuredClone({ snapshot, status, files });
        const nowMs = now.getTime();
        const first = compileAll(snapshot, status, now, files);
        const second = compileAll(snapshot, status, now, files);
        expect(second).toEqual(first);
        expect({ snapshot, status, files }).toEqual(before);
        expect(now.getTime()).toBe(nowMs);
      }),
    );
  });

  it("Property 5: every number token in the content rows is one the design allows for that page", () => {
    fc.assert(
      fc.property(inputs, ([snapshot, status, now, files]) => {
        const result = compileAll(snapshot, status, now, files);
        for (const outcome of result.outcomes) {
          if (outcome.outcome === "failed")
            throw new Error(`page ${String(outcome.number)} failed`);
          if (STATIC.has(outcome.number)) continue;
          const page = result.pages.find((p) => p.number === outcome.number);
          if (page === undefined) throw new Error(`page ${String(outcome.number)} missing`);
          const allowed = allowedTokens(outcome.number, outcome.outcome, snapshot, status, now);
          page.subpages.forEach((subpage, i) => {
            for (const row of subpage.content) {
              const line = row.map((c) => (c.kind === "text" ? c.ch : " ")).join("");
              for (const token of line.match(TOKEN) ?? []) {
                expect(
                  allowed.has(token),
                  `page ${String(outcome.number)} subpage ${String(i)}: token ${token} in "${line.trim()}"`,
                ).toBe(true);
              }
            }
          });
        }
      }),
    );
  });
});

// The allowed tokens of Property 5, per page (design.md, "Numbers per page"). Each is made here with
// the shared formatters from the data, plus the number tokens of source text that a page may show.

const TOKEN = /\d+(?:[.,]\d+)*/g;
const STATIC = new Set([666, 800, 801, 899]);

function tokens(...strings: (string | null)[]): string[] {
  return strings.flatMap((s) => (s === null ? [] : (s.match(TOKEN) ?? [])));
}

function range(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}

function allowedTokens(
  number: number,
  outcome: "compiled" | "no-data",
  snapshot: Snapshot,
  status: ServiceStatus,
  now: Date,
): Set<string> {
  if (outcome === "no-data") return new Set(["100", "110"]);
  const feed = snapshot.sources["wikimedia-feed"].value;
  const day = snapshot.sources["wikimedia-onthisday"].value;
  const weather = snapshot.sources["open-meteo"].value;
  const rates = snapshot.sources.frankfurter.value;
  const quakes = snapshot.sources.usgs.value;
  const launches = snapshot.sources["launch-library"].value;
  const registry = REGISTRY.map((d) => String(d.number));
  const out: string[] = [];

  if (number === 100) out.push(...registry);
  else if (number === 802) {
    out.push(
      ...registry,
      ...tokens(
        formatInteger(status.modelCalls.used, 99_999),
        formatInteger(status.modelCalls.cap, 99_999),
      ),
    );
    out.push(
      ...tokens(
        formatInteger(status.drafts.accepted, 99_999),
        formatInteger(status.drafts.rejected, 99_999),
      ),
    );
    for (const p of status.pages) out.push(...tokens(formatTime(p.compiledAt)));
  } else if (number >= 110 && number <= 118) {
    out.push(...range(110, 118), ...tokens(formatFullDate(feed.date)));
    for (const story of feed.news ?? []) {
      out.push(...tokens(story.text));
      for (const a of story.articles) out.push(...tokens(a.title, a.extract));
    }
  } else if (number === 120) {
    for (const m of feed.mostRead ?? []) {
      out.push(...tokens(formatInteger(m.rank, 999), formatInteger(m.views, 99_999_999), m.title));
    }
  } else if (number === 700) {
    out.push(...tokens(feed.featuredArticle?.title ?? null, feed.featuredArticle?.extract ?? null));
  } else if (number === 200 || number === 201) {
    for (const c of weather.cities) {
      out.push(...tokens(formatTemperature(c.temperatureC), formatWind(c.windKmh)));
      for (const d of c.daily) {
        out.push(
          ...tokens(
            formatCalendarDate(d.date),
            formatTemperature(d.maxC),
            formatTemperature(d.minC),
            formatPercent(d.precipitationPct),
          ),
        );
      }
    }
  } else if (number === 300 || number === 301) {
    out.push(...tokens(formatFullDate(rates.date)));
    for (const r of rates.rates) out.push(...tokens(formatRate(r.rate)));
    for (const s of rates.series) {
      for (const p of s.points) out.push(...tokens(formatCalendarDate(p.date), formatRate(p.rate)));
      // The change on the day: the latest rate against the last point dated before Rates.date.
      const latest = rates.rates.find((r) => r.code === s.code)?.rate ?? null;
      const before = s.points
        .filter((q) => q.date < rates.date)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const previous = before.at(-1);
      if (latest !== null && previous !== undefined && previous.rate > 0) {
        out.push(...tokens(formatChange((latest / previous.rate - 1) * 100)));
      }
    }
  } else if (number >= 400 && number <= 402) {
    const list =
      number === 400
        ? snapshot.sources["hacker-news"].value.top
        : number === 401
          ? snapshot.sources["hacker-news"].value.show
          : snapshot.sources["hacker-news"].value.ask;
    out.push(...range(1, Math.max(1, list.length)));
    for (const story of list) {
      out.push(
        ...tokens(
          formatInteger(story.score, 999_999),
          formatInteger(story.comments, 999_999),
          story.title,
        ),
      );
    }
  } else if (number === 500 || number === 501 || number === 550) {
    out.push(...tokens(formatDayMonth(day.month, day.day)));
    if (number === 550) out.push(...range(1, 5));
    for (const list of [day.events, day.births, day.deaths]) {
      for (const e of list) out.push(...tokens(formatYear(e.year), e.text));
    }
  } else if (number === 600) {
    out.push(...range(0, quakes.quakes.length));
    for (const q of quakes.quakes) {
      out.push(
        ...tokens(formatTime(q.time), formatMagnitude(q.magnitude), formatKm(q.depthKm), q.place),
      );
    }
  } else if (number === 601) {
    const moon = moonAt(now);
    if (moon !== undefined) {
      out.push(
        ...tokens(
          formatPercent(moon.illuminated * 100),
          formatDate(moon.nextFull),
          formatTimeUtc(moon.nextFull),
          formatDate(moon.nextNew),
          formatTimeUtc(moon.nextNew),
        ),
      );
    }
  } else if (number === 610) {
    for (const l of launches.launches) {
      out.push(...tokens(formatDate(l.net), formatTimeUtc(l.net), l.mission, l.rocket, l.status));
    }
  }
  return new Set(out);
}
