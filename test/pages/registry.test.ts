import { describe, expect, it } from "vitest";
import { isRepertoireCodePoint } from "../../src/grid/repertoire.js";
import { REGISTRY, findPage } from "../../src/pages/registry.js";

// The expected table is written out here by hand from design.md, "Registry". It is not derived from
// the registry, so a typo in either place shows up.

type Row = readonly [
  number,
  string,
  string,
  string,
  string,
  readonly [string, number],
  readonly [string, number],
  readonly [string, number],
  readonly [string, number],
];

const NEWS_STORIES: Row[] = [1, 2, 3, 4, 5, 6, 7, 8].map((n): Row => [
  110 + n,
  `News story ${String(n)}`,
  "WORLD NEWS",
  "wikimedia-feed",
  "ai",
  ["Index", 100],
  ["News", 110],
  ["Popular", 120],
  ["Weather", 200],
]);

const EXPECTED: readonly Row[] = [
  [
    100,
    "Index",
    "INDEX",
    "static",
    "rules",
    ["News", 110],
    ["Weather", 200],
    ["Rates", 300],
    ["Help", 800],
  ],
  [
    110,
    "World news",
    "WORLD NEWS",
    "wikimedia-feed",
    "ai",
    ["Index", 100],
    ["Story", 111],
    ["Popular", 120],
    ["Weather", 200],
  ],
  ...NEWS_STORIES,
  [
    120,
    "Most read on Wikipedia",
    "MOST READ ON WIKIPEDIA",
    "wikimedia-feed",
    "rules",
    ["Index", 100],
    ["News", 110],
    ["Article", 700],
    ["Weather", 200],
  ],
  [
    200,
    "World weather now",
    "WORLD WEATHER NOW",
    "open-meteo",
    "rules",
    ["Index", 100],
    ["Outlook", 201],
    ["News", 110],
    ["Rates", 300],
  ],
  [
    201,
    "Five-day outlook",
    "FIVE-DAY OUTLOOK",
    "open-meteo",
    "rules",
    ["Index", 100],
    ["Now", 200],
    ["News", 110],
    ["Rates", 300],
  ],
  [
    300,
    "Exchange rates",
    "EXCHANGE RATES",
    "frankfurter",
    "rules",
    ["Index", 100],
    ["Trend", 301],
    ["Weather", 200],
    ["Tech", 400],
  ],
  [
    301,
    "Exchange rate trend",
    "30-DAY RATE TREND",
    "frankfurter",
    "rules",
    ["Index", 100],
    ["Rates", 300],
    ["Weather", 200],
    ["Tech", 400],
  ],
  [
    400,
    "Developer news",
    "DEVELOPER NEWS: TOP",
    "hacker-news",
    "rules",
    ["Index", 100],
    ["Show", 401],
    ["Ask", 402],
    ["This day", 500],
  ],
  [
    401,
    "Developer news: Show",
    "DEVELOPER NEWS: SHOW",
    "hacker-news",
    "rules",
    ["Index", 100],
    ["Top", 400],
    ["Ask", 402],
    ["This day", 500],
  ],
  [
    402,
    "Developer news: Ask",
    "DEVELOPER NEWS: ASK",
    "hacker-news",
    "rules",
    ["Index", 100],
    ["Top", 400],
    ["Show", 401],
    ["This day", 500],
  ],
  [
    500,
    "On this day",
    "ON THIS DAY",
    "wikimedia-onthisday",
    "ai",
    ["Index", 100],
    ["Births", 501],
    ["Quiz", 550],
    ["Quakes", 600],
  ],
  [
    501,
    "Births and deaths",
    "ON THIS DAY: BIRTHS AND DEATHS",
    "wikimedia-onthisday",
    "ai",
    ["Index", 100],
    ["Events", 500],
    ["Quiz", 550],
    ["Quakes", 600],
  ],
  [
    550,
    "Quiz of the day",
    "QUIZ OF THE DAY",
    "wikimedia-onthisday",
    "rules",
    ["Index", 100],
    ["Events", 500],
    ["Births", 501],
    ["Quakes", 600],
  ],
  [
    600,
    "Earthquakes",
    "EARTHQUAKES M4.5+, LAST 24 HOURS",
    "usgs",
    "rules",
    ["Index", 100],
    ["Moon", 601],
    ["Launches", 610],
    ["Article", 700],
  ],
  [
    601,
    "The moon tonight",
    "THE MOON TONIGHT",
    "computed",
    "rules",
    ["Index", 100],
    ["Quakes", 600],
    ["Launches", 610],
    ["Article", 700],
  ],
  [
    610,
    "Rocket launches",
    "UPCOMING ROCKET LAUNCHES",
    "launch-library",
    "rules",
    ["Index", 100],
    ["Quakes", 600],
    ["Moon", 601],
    ["Article", 700],
  ],
  [
    666,
    "Back from the dead",
    "RESURRECTION",
    "static",
    "static",
    ["Index", 100],
    ["News", 110],
    ["Moon", 601],
    ["Help", 800],
  ],
  [
    700,
    "Featured article",
    "FEATURED ARTICLE",
    "wikimedia-feed",
    "ai",
    ["Index", 100],
    ["News", 110],
    ["Popular", 120],
    ["Help", 800],
  ],
  [
    800,
    "How to use Page 100",
    "HOW TO USE PAGE 100",
    "static",
    "static",
    ["Index", 100],
    ["About", 801],
    ["Status", 802],
    ["Test", 899],
  ],
  [
    801,
    "About and sources",
    "ABOUT, SOURCES AND LICENCES",
    "static",
    "static",
    ["Index", 100],
    ["Help", 800],
    ["Status", 802],
    ["Test", 899],
  ],
  [
    802,
    "Service status",
    "SERVICE STATUS",
    "computed",
    "rules",
    ["Index", 100],
    ["Help", 800],
    ["About", 801],
    ["Test", 899],
  ],
  [
    899,
    "Engineering test page",
    "ENGINEERING TEST PAGE",
    "static",
    "static",
    ["Index", 100],
    ["Help", 800],
    ["About", 801],
    ["Status", 802],
  ],
];

const NUMBERS = [
  100, 110, 111, 112, 113, 114, 115, 116, 117, 118, 120, 200, 201, 300, 301, 400, 401, 402, 500,
  501, 550, 600, 601, 610, 666, 700, 800, 801, 802, 899,
];

function isRepertoireText(text: string): boolean {
  return Array.from(text).every((ch) => isRepertoireCodePoint(ch.codePointAt(0) ?? Number.NaN));
}

describe("REGISTRY (requirement 2)", () => {
  it("holds exactly the 30 numbers in ascending order (2.1)", () => {
    expect(REGISTRY.map((d) => d.number)).toEqual(NUMBERS);
    expect(NUMBERS).toHaveLength(30);
  });

  it("matches the design table row by row (2.2)", () => {
    expect(REGISTRY).toHaveLength(EXPECTED.length);
    EXPECTED.forEach(([number, title, banner, source, editor, ...links], i) => {
      expect(REGISTRY[i]).toEqual({
        number,
        title,
        banner,
        source,
        editor,
        links: links.map(([label, target]) => ({ label, target })),
      });
    });
  });

  it("is frozen at every level (2.1)", () => {
    expect(Object.isFrozen(REGISTRY)).toBe(true);
    for (const d of REGISTRY) {
      expect(Object.isFrozen(d), `page ${String(d.number)}`).toBe(true);
      expect(Object.isFrozen(d.links), `links of ${String(d.number)}`).toBe(true);
      for (const l of d.links) expect(Object.isFrozen(l)).toBe(true);
    }
  });

  it("has banners of 1 to 35 repertoire characters in upper case, titles of 1 to 32 (2.3)", () => {
    for (const d of REGISTRY) {
      expect(d.banner.length, `banner ${String(d.number)}`).toBeGreaterThanOrEqual(1);
      expect(d.banner.length, `banner ${String(d.number)}`).toBeLessThanOrEqual(35);
      expect(d.banner).toBe(d.banner.toUpperCase());
      expect(isRepertoireText(d.banner)).toBe(true);
      expect(d.title.length, `title ${String(d.number)}`).toBeGreaterThanOrEqual(1);
      expect(d.title.length, `title ${String(d.number)}`).toBeLessThanOrEqual(32);
      expect(isRepertoireText(d.title)).toBe(true);
    }
  });

  it("has four links per page, with labels of 1 to 8 trimmed characters and valid targets (2.4)", () => {
    for (const d of REGISTRY) {
      expect(d.links).toHaveLength(4);
      for (const l of d.links) {
        expect(l.label.length).toBeGreaterThanOrEqual(1);
        expect(l.label.length, `${String(d.number)} ${l.label}`).toBeLessThanOrEqual(8);
        expect(l.label).toBe(l.label.trim());
        expect(isRepertoireText(l.label)).toBe(true);
        expect(NUMBERS).toContain(l.target);
        expect(l.target).not.toBe(d.number);
      }
    }
  });

  it("has editor static exactly for 666, 800, 801 and 899 (2.5)", () => {
    expect(REGISTRY.filter((d) => d.editor === "static").map((d) => d.number)).toEqual([
      666, 800, 801, 899,
    ]);
  });

  it("has source static for 100, 666, 800, 801, 899 and computed for 601 and 802 (2.5)", () => {
    expect(REGISTRY.filter((d) => d.source === "static").map((d) => d.number)).toEqual([
      100, 666, 800, 801, 899,
    ]);
    expect(REGISTRY.filter((d) => d.source === "computed").map((d) => d.number)).toEqual([
      601, 802,
    ]);
  });
});

describe("findPage (requirement 2.6)", () => {
  it("returns the entry for an in-service number", () => {
    expect(findPage(100)?.title).toBe("Index");
    expect(findPage(899)?.banner).toBe("ENGINEERING TEST PAGE");
  });

  it("returns undefined for numbers that are not in service or not integers", () => {
    expect(findPage(99)).toBeUndefined();
    expect(findPage(100.5)).toBeUndefined();
    expect(findPage(Number.NaN)).toBeUndefined();
    expect(findPage(119)).toBeUndefined();
    expect(findPage(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
