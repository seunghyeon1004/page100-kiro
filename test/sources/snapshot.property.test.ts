import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CITIES } from "../../src/sources/cities.js";
import { Snapshot, parseSnapshot } from "../../src/sources/snapshot.js";

// Property 11 (design.md): a generated snapshot survives JSON text and parseSnapshot unchanged.

// Strings with any code units, lone surrogates included (JSON.stringify escapes them).
const text = fc.string({ unit: "binary", maxLength: 12 });
// Finite doubles that are not -0.
const num = fc
  .double({ noNaN: true, noDefaultInfinity: true })
  .map((n) => (Object.is(n, -0) ? 0 : n));
const nullable = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: null });
const iso = fc
  .date({ min: new Date(0), max: new Date(Date.UTC(2199, 11, 31)), noInvalidDate: true })
  .map((d) => d.toISOString());

const articleRef = fc.record({ title: text, extract: nullable(text), url: nullable(text) });
const dayEntry = fc.record({ year: num, text });
const dayEntries = fc.array(dayEntry, { maxLength: 3 });
const forecast = fc.record({
  date: text,
  weatherCode: nullable(num),
  maxC: nullable(num),
  minC: nullable(num),
  precipitationPct: nullable(num),
});
const cityWeather = fc.record({
  cityId: fc.constantFrom(...CITIES.map((c) => c.id)),
  observedAt: iso,
  temperatureC: nullable(num),
  weatherCode: nullable(num),
  windKmh: nullable(num),
  daily: fc.array(forecast, { maxLength: 3 }),
});
const hnStory = fc.record({
  id: num,
  title: text,
  by: nullable(text),
  score: nullable(num),
  comments: nullable(num),
  time: iso,
  url: nullable(text),
});
const quake = fc.record({
  id: text,
  magnitude: nullable(num),
  place: nullable(text),
  time: iso,
  depthKm: nullable(num),
  latitude: num,
  longitude: num,
});
const launch = fc.record({
  id: text,
  rocket: nullable(text),
  mission: text,
  net: iso,
  status: nullable(text),
});

const snapshot = fc.record({
  version: fc.constant(1 as const),
  sources: fc.record({
    "wikimedia-feed": fc.record({
      fetchedAt: iso,
      value: fc.record({
        date: text,
        news: nullable(
          fc.array(fc.record({ text, articles: fc.array(articleRef, { maxLength: 2 }) }), {
            maxLength: 3,
          }),
        ),
        mostRead: nullable(
          fc.array(fc.record({ rank: num, title: text, views: num, extract: nullable(text) }), {
            maxLength: 3,
          }),
        ),
        featuredArticle: nullable(articleRef),
      }),
    }),
    "wikimedia-onthisday": fc.record({
      fetchedAt: iso,
      value: fc.record({
        month: num,
        day: num,
        events: dayEntries,
        births: dayEntries,
        deaths: dayEntries,
      }),
    }),
    "open-meteo": fc.record({
      fetchedAt: iso,
      value: fc.record({ cities: fc.array(cityWeather, { maxLength: 3 }) }),
    }),
    frankfurter: fc.record({
      fetchedAt: iso,
      value: fc.record({
        base: fc.constant("USD" as const),
        date: text,
        rates: fc.array(fc.record({ code: text, rate: num }), { maxLength: 3 }),
        series: fc.array(
          fc.record({
            code: text,
            points: fc.array(fc.record({ date: text, rate: num }), { maxLength: 3 }),
          }),
          { maxLength: 3 },
        ),
      }),
    }),
    "hacker-news": fc.record({
      fetchedAt: iso,
      value: fc.record({
        top: fc.array(hnStory, { maxLength: 3 }),
        show: fc.array(hnStory, { maxLength: 3 }),
        ask: fc.array(hnStory, { maxLength: 3 }),
      }),
    }),
    usgs: fc.record({
      fetchedAt: iso,
      value: fc.record({ generatedAt: iso, quakes: fc.array(quake, { maxLength: 3 }) }),
    }),
    "launch-library": fc.record({
      fetchedAt: iso,
      value: fc.record({ launches: fc.array(launch, { maxLength: 3 }) }),
    }),
  }),
});

describe("snapshot properties", () => {
  it("Property 11: parseSnapshot(JSON.parse(JSON.stringify(s))) succeeds and deep-equals s", () => {
    fc.assert(
      fc.property(snapshot, (s) => {
        // The generated value is itself valid: this guards the arbitrary against drifting from the schema.
        expect(Snapshot.safeParse(s).success).toBe(true);
        const result = parseSnapshot(JSON.parse(JSON.stringify(s)));
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.snapshot).toEqual(s);
      }),
    );
  });

  it("rejects version 2, a missing source and a non-ISO fetchedAt, with issue paths", () => {
    const sample = fc.sample(snapshot, 1)[0];
    if (sample === undefined) throw new Error("no sample");
    const plain = JSON.parse(JSON.stringify(sample)) as {
      version: number;
      sources: Record<string, { fetchedAt: string }>;
    };
    expect(parseSnapshot({ ...plain, version: 2 })).toEqual({ ok: false, issuePaths: ["version"] });
    const rest = Object.fromEntries(Object.entries(plain.sources).filter(([k]) => k !== "usgs"));
    expect(parseSnapshot({ ...plain, sources: rest })).toEqual({
      ok: false,
      issuePaths: ["sources.usgs"],
    });
    const bad = {
      ...plain,
      sources: { ...plain.sources, usgs: { ...plain.sources.usgs, fetchedAt: "yesterday" } },
    };
    expect(parseSnapshot(bad)).toEqual({ ok: false, issuePaths: ["sources.usgs.fetchedAt"] });
    expect(parseSnapshot(null)).toEqual({ ok: false, issuePaths: ["(root)"] });
  });
});
