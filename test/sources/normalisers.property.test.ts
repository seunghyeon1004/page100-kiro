import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Rates, parseFrankfurter } from "../../src/sources/frankfurter.js";
import { HackerNews, parseHackerNews } from "../../src/sources/hacker-news.js";
import { Launches, parseLaunchLibrary } from "../../src/sources/launch-library.js";
import { Weather, parseOpenMeteo } from "../../src/sources/open-meteo.js";
import type { ParseOutcome } from "../../src/sources/outcome.js";
import { Quakes, parseUsgs } from "../../src/sources/usgs.js";
import { FeaturedDay, parseWikimediaFeed } from "../../src/sources/wikimedia-feed.js";
import { OnThisDayLists, parseWikimediaOnThisDay } from "../../src/sources/wikimedia-onthisday.js";
import { recorded, recordedBases } from "./fixtures.js";
import { applyMutations, findBadValue, mutations } from "./source-arbitraries.js";

// Property 7 (design.md): JSON variations of each recorded fixture never make a parser throw, and
// every ok value passes its normalised schema and holds no undefined, NaN, Infinity or -0.

interface Case {
  readonly name: string;
  /** The recorded JSON the variations start from. */
  readonly base: unknown;
  readonly parse: (body: unknown) => ParseOutcome<unknown>;
  readonly schema: { safeParse(value: unknown): { success: boolean } };
}

function oneFile(
  source: "open-meteo" | "usgs" | "launch-library" | "wikimedia-onthisday",
  parse: (body: unknown) => ParseOutcome<unknown>,
  schema: Case["schema"],
): Case[] {
  return recordedBases(source).map((base) => ({
    name: `${source}/${base}`,
    base: recorded(source, base),
    parse,
    schema,
  }));
}

function itemsOf(items: unknown): Map<number, unknown> {
  const map = new Map<number, unknown>();
  if (typeof items === "object" && items !== null && !Array.isArray(items)) {
    for (const [id, body] of Object.entries(items)) map.set(Number(id), body);
  }
  return map;
}

function hackerNewsCase(): Case {
  const items: Record<string, unknown> = {};
  for (const base of recordedBases("hacker-news")) {
    const match = /^\d{4}-\d{2}-\d{2}-item-(\d+)$/.exec(base);
    if (match?.[1] !== undefined) items[match[1]] = recorded("hacker-news", base);
  }
  const day = "2026-11-11";
  return {
    name: "hacker-news/lists-and-items",
    base: {
      top: recorded("hacker-news", `${day}-topstories`),
      show: recorded("hacker-news", `${day}-showstories`),
      ask: recorded("hacker-news", `${day}-askstories`),
      items,
    },
    parse: (body) => {
      const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
      return parseHackerNews({ top: b.top, show: b.show, ask: b.ask, items: itemsOf(b.items) });
    },
    schema: HackerNews,
  };
}

function frankfurterCase(): Case {
  const day = "2026-11-11";
  return {
    name: "frankfurter/latest-and-series",
    base: {
      latest: recorded("frankfurter", `${day}-latest`),
      series: recorded("frankfurter", `${day}-series`),
    },
    parse: (body) => {
      const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
      return parseFrankfurter({ latest: b.latest, series: b.series });
    },
    schema: Rates,
  };
}

const CASES: Case[] = [
  ...recordedBases("wikimedia-feed").map((base) => ({
    name: `wikimedia-feed/${base}`,
    base: recorded("wikimedia-feed", base),
    parse: parseWikimediaFeed,
    schema: FeaturedDay,
  })),
  ...oneFile("wikimedia-onthisday", parseWikimediaOnThisDay, OnThisDayLists),
  ...oneFile("open-meteo", parseOpenMeteo, Weather),
  frankfurterCase(),
  hackerNewsCase(),
  ...oneFile("usgs", parseUsgs, Quakes),
  ...oneFile("launch-library", parseLaunchLibrary, Launches),
];

describe("normalisers on fixture variations (requirements 12.1, 12.2, 12.4, 18.1)", () => {
  it("covers all seven sources", () => {
    const sources = new Set(CASES.map((c) => c.name.split("/")[0]));
    expect([...sources].sort()).toEqual(
      [
        "frankfurter",
        "hacker-news",
        "launch-library",
        "open-meteo",
        "usgs",
        "wikimedia-feed",
        "wikimedia-onthisday",
      ].sort(),
    );
  });

  it.each(CASES.map((c) => [c.name, c] as const))("parses the unchanged %s", (_name, c) => {
    expect(c.parse(structuredClone(c.base)).ok).toBe(true);
  });

  it.each(CASES.map((c) => [c.name, c] as const))(
    "fails without throwing when %s is replaced by null",
    (_name, c) => {
      expect(c.parse(null).ok).toBe(false);
    },
  );

  it("Property 7: every recorded fixture with 1 to 3 changed nodes never throws, and an ok value is clean and passes its schema", () => {
    for (const c of CASES) {
      fc.assert(
        fc.property(mutations, (list) => {
          const body = applyMutations(c.base, list);
          const result = c.parse(body);
          if (result.ok) {
            expect(findBadValue(result.value), c.name).toBeNull();
            expect(c.schema.safeParse(result.value).success, c.name).toBe(true);
          } else {
            expect(result.issuePaths.length, c.name).toBeGreaterThan(0);
          }
        }),
      );
    }
  });
});
