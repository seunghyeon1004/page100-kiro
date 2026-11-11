import { z } from "zod";
import type { HttpClient } from "./http.js";
import { cleanNumber, NormalNumber } from "./normal-number.js";
import type { FetchOutcome, NonEmpty, ParseOutcome, SourceFailure } from "./outcome.js";
import { issuePathsOf } from "./outcome.js";
import { SERIES_SYMBOLS, sourceRequests } from "./source-requests.js";

// Wire shapes from test/fixtures/sources/frankfurter/2026-11-11-latest.json
// (`{ amount, base, date, rates: { CODE: number } }`) and 2026-11-11-series.json
// (`{ amount, base, start_date, end_date, rates: { "YYYY-MM-DD": { CODE: number } } }`). Every date
// of the recorded series carries all six symbols, so all six are required.

const LatestWire = z.object({
  base: z.literal("USD"),
  date: z.string(),
  rates: z.record(z.string(), z.number()),
});

const SeriesDayWire = z.object({
  EUR: z.number(),
  GBP: z.number(),
  JPY: z.number(),
  KRW: z.number(),
  CNY: z.number(),
  INR: z.number(),
});

const SeriesWire = z.object({
  base: z.literal("USD"),
  rates: z.record(z.string(), SeriesDayWire),
});

export const Rate = z.strictObject({ code: z.string(), rate: NormalNumber });
export type Rate = z.infer<typeof Rate>;

export const SeriesPoint = z.strictObject({ date: z.string(), rate: NormalNumber });
export type SeriesPoint = z.infer<typeof SeriesPoint>;

export const RateSeries = z.strictObject({ code: z.string(), points: z.array(SeriesPoint) });
export type RateSeries = z.infer<typeof RateSeries>;

export const Rates = z.strictObject({
  base: z.literal("USD"),
  date: z.string(),
  rates: z.array(Rate),
  series: z.array(RateSeries),
});
export type Rates = z.infer<typeof Rates>;

/** The two response bodies Page 100 needs from Frankfurter. */
export interface FrankfurterBodies {
  readonly latest: unknown;
  readonly series: unknown;
}

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function prefixed(prefix: string, error: z.ZodError): string[] {
  return issuePathsOf(error).map((p) => (p === "(root)" ? prefix : `${prefix}.${p}`));
}

/**
 * Checks both bodies and normalises them (requirements 12.1, 12.2, 13.3). Rates are sorted by code;
 * each series is sorted by date ascending, and the series are in the order of `SERIES_SYMBOLS`.
 * Issue paths start with `latest` or `series`. Never throws.
 */
export function parseFrankfurter(bodies: FrankfurterBodies): ParseOutcome<Rates> {
  const latest = LatestWire.safeParse(bodies.latest);
  const series = SeriesWire.safeParse(bodies.series);
  const problems = [
    ...(latest.success ? [] : prefixed("latest", latest.error)),
    ...(series.success ? [] : prefixed("series", series.error)),
  ];
  const [first, ...rest] = problems;
  if (first !== undefined) {
    const issuePaths: NonEmpty<string> = [first, ...rest];
    return { ok: false, issuePaths };
  }
  if (!latest.success || !series.success) return { ok: false, issuePaths: ["(root)"] };

  const dates = Object.keys(series.data.rates).sort(byText);
  return {
    ok: true,
    value: {
      base: "USD",
      date: latest.data.date,
      rates: Object.entries(latest.data.rates)
        .sort(([a], [b]) => byText(a, b))
        .map(([code, rate]) => ({ code, rate: cleanNumber(rate) })),
      series: SERIES_SYMBOLS.map((code) => ({
        code,
        points: dates.flatMap((date) => {
          const day = series.data.rates[date];
          return day === undefined ? [] : [{ date, rate: cleanNumber(day[code]) }];
        }),
      })),
    },
  };
}

/** Fetches the latest rates and the 30-day series; succeeds only when both parse. Never throws. */
export async function fetchFrankfurter(http: HttpClient, now: Date): Promise<FetchOutcome<Rates>> {
  const [latestRequest, seriesRequest] = sourceRequests("frankfurter", now);
  if (latestRequest === undefined || seriesRequest === undefined) {
    // Unreachable: sourceRequests always lists both requests. Kept so that this function never throws.
    return { ok: false, source: "frankfurter", url: "", failure: { kind: "network" } };
  }
  const [latest, series] = await Promise.all([
    http.getJson(latestRequest.url, { retry: true }),
    http.getJson(seriesRequest.url, { retry: true }),
  ]);
  if (!latest.ok) {
    return { ok: false, source: "frankfurter", url: latestRequest.url, failure: latest.failure };
  }
  if (!series.ok) {
    return { ok: false, source: "frankfurter", url: seriesRequest.url, failure: series.failure };
  }
  const parsed = parseFrankfurter({ latest: latest.body, series: series.body });
  if (!parsed.ok) {
    const failure: SourceFailure = { kind: "schema", issuePaths: parsed.issuePaths };
    const inSeries = parsed.issuePaths.every((p) => p.startsWith("series"));
    return {
      ok: false,
      source: "frankfurter",
      url: inSeries ? seriesRequest.url : latestRequest.url,
      failure,
    };
  }
  return { ok: true, value: parsed.value, fetchedAt: now.toISOString() };
}
