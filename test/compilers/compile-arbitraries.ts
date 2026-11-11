import fc from "fast-check";
import { CITIES } from "../../src/sources/cities.js";
import { SERIES_SYMBOLS } from "../../src/sources/source-requests.js";
import { parseSnapshot } from "../../src/sources/snapshot.js";
import type { Snapshot } from "../../src/sources/snapshot.js";
import type { PageFiles } from "../../src/compilers/compile-types.js";
import type { ServiceStatus } from "../../src/compilers/service-status.js";
import { OTHER_CODES } from "../../src/compilers/currency-names.js";
import { serialiseContent } from "../../src/markup/serialise-content.js";
import { REGISTRY } from "../../src/pages/registry.js";
import { validContent } from "../grid/arbitraries.js";

// Arbitraries for the compiler properties (design.md, "Correctness properties"). Values are hostile
// but legal: they pass the normalised schemas, and every generated snapshot goes through
// `parseSnapshot` before a test uses it (tech.md, rule 4).

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** A word of 1 to 120 letters. */
const word = fc
  .array(fc.constantFrom(...Array.from(LETTERS)), { minLength: 1, maxLength: 120 })
  .map((cs) => cs.join(""));
const shortWord = fc
  .array(fc.constantFrom(...Array.from(LETTERS)), { minLength: 1, maxLength: 9 })
  .map((cs) => cs.join(""));

/** Names with letters that fold, letters that do not, an emoji and a lone surrogate. */
const oddName = fc
  .array(
    fc.constantFrom(
      "\u03b1",
      "\u0434",
      "\u00a9",
      "\u{1f600}",
      "\ud800",
      "\u00e9",
      "\u2019",
      "x",
      " ",
    ),
    {
      minLength: 1,
      maxLength: 12,
    },
  )
  .map((cs) => cs.join(""));

/** Plain prose: short words, some digits, some full stops, 1 to 60 words. */
export const prose = fc
  .array(
    fc.oneof(
      { weight: 8, arbitrary: shortWord },
      { weight: 1, arbitrary: fc.constantFrom("12", "1,066", "3.5", "2024", "40") },
      { weight: 1, arbitrary: shortWord.map((w) => `${w}.`) },
    ),
    { minLength: 1, maxLength: 60 },
  )
  .map((ws) => ws.join(" "));

export const text: fc.Arbitrary<string> = fc.oneof(
  { weight: 6, arbitrary: prose },
  { weight: 1, arbitrary: word },
  { weight: 1, arbitrary: oddName },
  { weight: 1, arbitrary: fc.constant("") },
  { weight: 1, arbitrary: fc.string({ unit: "binary", maxLength: 20 }) },
);

const number: fc.Arbitrary<number> = fc
  .oneof(
    { weight: 4, arbitrary: fc.double({ min: -50, max: 120, noNaN: true }) },
    { weight: 2, arbitrary: fc.integer({ min: -2000, max: 2000 }) },
    { weight: 1, arbitrary: fc.double({ min: -1e308, max: 1e308, noNaN: true }) },
  )
  .map((n) => (Object.is(n, -0) ? 0 : n));

const nullable = <T>(a: fc.Arbitrary<T>): fc.Arbitrary<T | null> => fc.option(a, { nil: null });

export const time: fc.Arbitrary<Date> = fc.date({
  min: new Date(Date.UTC(1970, 0, 1)),
  max: new Date(Date.UTC(2100, 11, 31)),
  noInvalidDate: true,
});
const iso = time.map((d) => d.toISOString());
const day = time.map((d) => d.toISOString().slice(0, 10));
const dayOrText = fc.oneof({ weight: 5, arbitrary: day }, { weight: 1, arbitrary: text });

const articleRef = fc.record({ title: text, extract: nullable(text), url: nullable(text) });
const year = fc.oneof(
  { weight: 5, arbitrary: fc.integer({ min: -3000, max: 2100 }) },
  { weight: 1, arbitrary: fc.integer({ min: -1_000_000, max: 1_000_000 }) },
);
const dayEntry = fc.record({ year, text });

const feed = fc.record({
  date: dayOrText,
  news: nullable(
    fc.array(fc.record({ text, articles: fc.array(articleRef, { maxLength: 3 }) }), {
      maxLength: 10,
    }),
  ),
  mostRead: nullable(
    fc.array(fc.record({ rank: number, title: text, views: number, extract: nullable(text) }), {
      maxLength: 50,
    }),
  ),
  featuredArticle: nullable(articleRef),
});

const onThisDay = fc.record({
  month: fc.oneof(fc.integer({ min: 1, max: 12 }), number),
  day: fc.oneof(fc.integer({ min: 1, max: 31 }), number),
  events: fc.array(dayEntry, { maxLength: 50 }),
  births: fc.array(dayEntry, { maxLength: 50 }),
  deaths: fc.array(dayEntry, { maxLength: 50 }),
});

const forecast = fc.record({
  date: dayOrText,
  weatherCode: nullable(fc.oneof(fc.integer({ min: 0, max: 99 }), number)),
  maxC: nullable(number),
  minC: nullable(number),
  precipitationPct: nullable(number),
});
const cityWeather = (cityId: (typeof CITIES)[number]["id"]) =>
  fc.record({
    cityId: fc.constant(cityId),
    observedAt: iso,
    temperatureC: nullable(number),
    weatherCode: nullable(fc.oneof(fc.integer({ min: 0, max: 99 }), number)),
    windKmh: nullable(number),
    daily: fc.array(forecast, { maxLength: 7 }),
  });
const weather = fc.oneof(
  {
    weight: 3,
    arbitrary: fc.tuple(...CITIES.map((c) => cityWeather(c.id))).map((cities) => ({ cities })),
  },
  {
    weight: 1,
    arbitrary: fc
      .array(fc.constantFrom(...CITIES.map((c) => c.id)).chain(cityWeather), { maxLength: 30 })
      .map((cities) => ({ cities })),
  },
);

const CODES = [...SERIES_SYMBOLS, ...OTHER_CODES, "CZK", "DKK"];
const rates = fc.record({
  base: fc.constant("USD" as const),
  date: dayOrText,
  rates: fc.array(
    fc.record({
      code: fc.oneof(fc.constantFrom(...CODES), shortWord),
      rate: fc.oneof(fc.double({ min: 0.0001, max: 5000, noNaN: true }), number),
    }),
    { maxLength: 30 },
  ),
  series: fc.array(
    fc.record({
      code: fc.oneof(fc.constantFrom(...CODES), shortWord),
      points: fc.array(
        fc.record({
          date: dayOrText,
          rate: fc.oneof(fc.double({ min: 0.0001, max: 5000, noNaN: true }), number),
        }),
        {
          maxLength: 35,
        },
      ),
    }),
    { maxLength: 8 },
  ),
});

const hnStory = fc.record({
  id: fc.integer({ min: 1, max: 1_000_000 }),
  title: text,
  by: nullable(text),
  score: nullable(fc.oneof(fc.integer({ min: 0, max: 2000 }), number)),
  comments: nullable(fc.oneof(fc.integer({ min: 0, max: 2000 }), number)),
  time: iso,
  url: nullable(text),
});
const hackerNews = fc.record({
  top: fc.array(hnStory, { maxLength: 50 }),
  show: fc.array(hnStory, { maxLength: 50 }),
  ask: fc.array(hnStory, { maxLength: 50 }),
});

const quakes = fc.record({
  generatedAt: iso,
  quakes: fc.array(
    fc.record({
      id: shortWord,
      magnitude: nullable(fc.oneof(fc.double({ min: 4.5, max: 9.5, noNaN: true }), number)),
      place: nullable(text),
      time: iso,
      depthKm: nullable(fc.oneof(fc.double({ min: 0, max: 700, noNaN: true }), number)),
      latitude: number,
      longitude: number,
    }),
    { maxLength: 50 },
  ),
});

const launches = fc.record({
  launches: fc.array(
    fc.record({
      id: shortWord,
      rocket: nullable(text),
      mission: text,
      net: fc.oneof(iso, text),
      status: nullable(text),
    }),
    { maxLength: 50 },
  ),
});

function entry<T>(value: fc.Arbitrary<T>) {
  return fc.record({ fetchedAt: iso, value });
}

/** A snapshot of hostile values. Every one passes `parseSnapshot`, and the parsed value is what is returned. */
export const snapshotArb: fc.Arbitrary<Snapshot> = fc
  .record({
    version: fc.constant(1 as const),
    sources: fc.record({
      "wikimedia-feed": entry(feed),
      "wikimedia-onthisday": entry(onThisDay),
      "open-meteo": entry(weather),
      frankfurter: entry(rates),
      "hacker-news": entry(hackerNews),
      usgs: entry(quakes),
      "launch-library": entry(launches),
    }),
  })
  .map((candidate) => {
    const parsed = parseSnapshot(candidate);
    if (!parsed.ok)
      throw new Error(`generated snapshot does not parse: ${parsed.issuePaths.join(", ")}`);
    return parsed.snapshot;
  });

/** A service status with counters from 0 to 1e9 and a compile time (or none) for some registry pages. */
export const statusArb: fc.Arbitrary<ServiceStatus> = fc.record({
  aiEditor: fc.boolean(),
  modelCalls: fc.record({
    used: fc.integer({ min: 0, max: 1e9 }),
    cap: fc.integer({ min: 0, max: 1e9 }),
  }),
  drafts: fc.record({
    accepted: fc.integer({ min: 0, max: 1e9 }),
    rejected: fc.integer({ min: 0, max: 1e9 }),
  }),
  pages: fc.array(
    fc.record({
      number: fc.oneof(
        fc.constantFrom(...REGISTRY.map((d) => d.number)),
        fc.integer({ min: 100, max: 899 }),
      ),
      compiledAt: nullable(fc.oneof(time, fc.constant(new Date(Number.NaN)))),
      editor: fc.constantFrom("rules" as const, "ai" as const, "static" as const),
    }),
    { maxLength: 40 },
  ),
});

/** The text of the four page files: the canonical markup of valid content. */
export const pageFilesArb: fc.Arbitrary<PageFiles> = fc
  .tuple(validContent, validContent, validContent, validContent)
  .map(([a, b, c, d]) => ({
    666: serialiseContent(a),
    800: serialiseContent(b),
    801: serialiseContent(c),
    899: serialiseContent(d),
  }));
