import { describe, expect, it } from "vitest";
import { Rates, fetchFrankfurter, parseFrankfurter } from "../../src/sources/frankfurter.js";
import { createHttpClient } from "../../src/sources/http.js";
import { SERIES_SYMBOLS } from "../../src/sources/source-requests.js";
import { fakeDelay, textResponse } from "./fake-http.js";
import {
  recorded,
  recordedBases,
  recordedFetch,
  recordedMeta,
  syntheticFixtures,
} from "./fixtures.js";

const LATEST = "2026-11-11-latest";
const SERIES = "2026-11-11-series";
const NOW = new Date(recordedMeta("frankfurter", LATEST).fetchedAt);

function synthetic(name: string): unknown {
  const found = syntheticFixtures("frankfurter").find((f) => f.name === name);
  if (found === undefined) throw new Error(`no synthetic fixture ${name}`);
  return found.body;
}

function real() {
  const result = parseFrankfurter({
    latest: recorded("frankfurter", LATEST),
    series: recorded("frankfurter", SERIES),
  });
  if (!result.ok) throw new Error(`fixtures did not parse: ${result.issuePaths.join(", ")}`);
  return result.value;
}

describe("parseFrankfurter on recorded fixtures (requirements 12.1, 13.3, 18.1)", () => {
  it("has the two recorded files", () => {
    expect(recordedBases("frankfurter")).toEqual([LATEST, SERIES]);
  });

  it("parses the pair and the value passes the normalised schema", () => {
    expect(Rates.safeParse(real()).success).toBe(true);
  });

  it("reads the latest rates sorted by code", () => {
    const { base, date, rates } = real();
    expect(base).toBe("USD");
    expect(date).toBe("2026-11-10");
    expect(rates).toHaveLength(29);
    expect(rates.map((r) => r.code)).toEqual(rates.map((r) => r.code).sort());
    expect(rates.find((r) => r.code === "EUR")?.rate).toBe(0.89174);
    expect(rates.find((r) => r.code === "KRW")?.rate).toBe(1339);
  });

  it("reads six series in SERIES_SYMBOLS order, each with 22 points sorted by date ascending", () => {
    const { series } = real();
    expect(series.map((s) => s.code)).toEqual([...SERIES_SYMBOLS]);
    for (const one of series) {
      expect(one.points, one.code).toHaveLength(22);
      const dates = one.points.map((p) => p.date);
      expect(dates).toEqual([...dates].sort());
      expect(dates[0]).toBe("2026-10-12");
      expect(dates[21]).toBe("2026-11-10");
    }
    expect(series[0]?.points[0]).toEqual({ date: "2026-10-12", rate: 0.89437 });
    expect(series[0]?.points[21]).toEqual({ date: "2026-11-10", rate: 0.89174 });
  });

  it("ends the series on the date of the latest rates, with the same value", () => {
    const { date, rates, series } = real();
    for (const one of series) {
      const last = one.points[one.points.length - 1];
      expect(last?.date, one.code).toBe(date);
      expect(last?.rate, one.code).toBe(rates.find((r) => r.code === one.code)?.rate);
    }
  });
});

describe("parseFrankfurter on synthetic fixtures and bad shapes", () => {
  const latest = recorded("frankfurter", LATEST);

  it("has a comment on every synthetic fixture (requirement 16.4)", () => {
    for (const f of syntheticFixtures("frankfurter"))
      expect(f.comment.length, f.name).toBeGreaterThan(0);
  });

  it("keeps a single-date series with one point per symbol (series-one-day.json)", () => {
    const result = parseFrankfurter({ latest, series: synthetic("series-one-day.json") });
    expect(result.ok).toBe(true);
    if (result.ok) for (const s of result.value.series) expect(s.points).toHaveLength(1);
  });

  it("sorts points by date ascending (series-unsorted.json)", () => {
    const result = parseFrankfurter({ latest, series: synthetic("series-unsorted.json") });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.series[0]?.points.map((p) => p.date)).toEqual([
        "2026-11-09",
        "2026-11-10",
      ]);
    }
  });

  it("rejects a date that lacks a symbol (series-missing-symbol.json)", () => {
    expect(parseFrankfurter({ latest, series: synthetic("series-missing-symbol.json") })).toEqual({
      ok: false,
      issuePaths: ["series.rates.2026-11-10.INR"],
    });
  });

  it("names which body failed, and never echoes the body", () => {
    const bad = parseFrankfurter({
      latest: { base: "EUR", date: 5, rates: "SECRET" },
      series: null,
    });
    expect(bad).toEqual({
      ok: false,
      issuePaths: ["latest.base", "latest.date", "latest.rates", "series"],
    });
    expect(JSON.stringify(bad)).not.toContain("SECRET");
  });

  it("maps -0 to 0", () => {
    const result = parseFrankfurter({
      latest: { base: "USD", date: "2026-11-10", rates: { EUR: -0 } },
      series: synthetic("series-one-day.json"),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.is(result.value.rates[0]?.rate, 0)).toBe(true);
  });
});

describe("fetchFrankfurter", () => {
  const delay = fakeDelay().delay;
  const latestUrl = recordedMeta("frankfurter", LATEST).url;
  const seriesUrl = recordedMeta("frankfurter", SERIES).url;

  it("requests latest and the series, and succeeds when both parse", async () => {
    const { fetch, requested } = recordedFetch("frankfurter");
    const result = await fetchFrankfurter(createHttpClient({ fetch, delay }), NOW);
    expect([...requested].sort()).toEqual([latestUrl, seriesUrl].sort());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fetchedAt).toBe(NOW.toISOString());
      expect(result.value.series).toHaveLength(6);
    }
  });

  it("fails when the series request fails, even though latest worked", async () => {
    const { fetch } = recordedFetch("frankfurter", {
      [seriesUrl]: () => Promise.resolve(textResponse(404, "gone")),
    });
    expect(await fetchFrankfurter(createHttpClient({ fetch, delay }), NOW)).toEqual({
      ok: false,
      source: "frankfurter",
      url: seriesUrl,
      failure: { kind: "status", status: 404 },
    });
  });

  it("fails when latest fails, even though the series worked", async () => {
    const { fetch } = recordedFetch("frankfurter", {
      [latestUrl]: () => Promise.resolve(textResponse(429, "slow", { "Retry-After": "60" })),
    });
    expect(await fetchFrankfurter(createHttpClient({ fetch, delay }), NOW)).toEqual({
      ok: false,
      source: "frankfurter",
      url: latestUrl,
      failure: { kind: "rate-limited", retryAfterMs: 60_000 },
    });
  });

  it("fails with a schema failure when a body has the wrong shape", async () => {
    const { fetch } = recordedFetch("frankfurter", {
      [seriesUrl]: () => Promise.resolve(textResponse(200, "{}")),
    });
    const result = await fetchFrankfurter(createHttpClient({ fetch, delay }), NOW);
    expect(result).toMatchObject({
      ok: false,
      source: "frankfurter",
      url: seriesUrl,
      failure: { kind: "schema" },
    });
  });
});
