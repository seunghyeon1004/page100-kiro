import { describe, expect, it } from "vitest";
import { createHttpClient } from "../../src/sources/http.js";
import {
  OnThisDay,
  OnThisDayLists,
  fetchWikimediaOnThisDay,
  parseWikimediaOnThisDay,
} from "../../src/sources/wikimedia-onthisday.js";
import { fakeDelay, textResponse } from "./fake-http.js";
import {
  recorded,
  recordedBases,
  recordedFetch,
  recordedMeta,
  syntheticFixtures,
} from "./fixtures.js";

const BASE = "2026-11-11-onthisday";
const URL = "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/11/11";
const NOW = new Date(recordedMeta("wikimedia-onthisday", BASE).fetchedAt);

describe("parseWikimediaOnThisDay on recorded fixtures (requirements 12.1, 18.1)", () => {
  it.each(recordedBases("wikimedia-onthisday"))(
    "parses %s and the value passes the normalised schema",
    (base) => {
      const result = parseWikimediaOnThisDay(recorded("wikimedia-onthisday", base));
      expect(result.ok).toBe(true);
      if (result.ok) expect(OnThisDayLists.safeParse(result.value).success).toBe(true);
    },
  );

  it("reads the list sizes and first entries of 2026-11-11-onthisday", () => {
    const result = parseWikimediaOnThisDay(recorded("wikimedia-onthisday", BASE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { events, births, deaths } = result.value;
    expect([events.length, births.length, deaths.length]).toEqual([74, 233, 115]);
    expect(events[0]).toMatchObject({
      year: 2024,
      text: "A vehicle-ramming attack in Zhuhai, China, kills 38 people and injures 48.",
    });
    expect(events[0]?.articles).toHaveLength(2);
    expect(events[0]?.articles[0]?.title).toBe("2024 Zhuhai car attack");
    expect(births[0]).toMatchObject({ year: 2005, text: "Ben Gannon-Doak, Scottish footballer" });
    expect(births[0]?.articles[0]?.title).toBe("Ben Gannon-Doak");
    expect(deaths[0]?.year).toBe(2024);
  });

  it("gives every entry article an extract and a URL", () => {
    const result = parseWikimediaOnThisDay(recorded("wikimedia-onthisday", BASE));
    if (!result.ok) throw new Error("fixture did not parse");
    for (const list of [result.value.events, result.value.births, result.value.deaths]) {
      for (const entry of list) {
        for (const article of entry.articles) {
          expect(typeof article.extract).toBe("string");
          expect(article.url?.startsWith("https://en.wikipedia.org/wiki/")).toBe(true);
        }
      }
    }
  });
});

describe("parseWikimediaOnThisDay on synthetic fixtures and bad shapes", () => {
  const synthetic = syntheticFixtures("wikimedia-onthisday");

  it("has a comment on every synthetic fixture (requirement 16.4)", () => {
    for (const fixture of synthetic)
      expect(fixture.comment.length, fixture.name).toBeGreaterThan(0);
  });

  it("accepts empty lists (empty-lists.json)", () => {
    const body = synthetic.find((f) => f.name === "empty-lists.json")?.body;
    expect(parseWikimediaOnThisDay(body)).toEqual({
      ok: true,
      value: { events: [], births: [], deaths: [] },
    });
  });

  it("accepts an entry with no pages and a negative year (entry-without-pages.json)", () => {
    const body = synthetic.find((f) => f.name === "entry-without-pages.json")?.body;
    expect(parseWikimediaOnThisDay(body)).toEqual({
      ok: true,
      value: {
        events: [{ year: -44, text: "An event with no linked article.", articles: [] }],
        births: [],
        deaths: [],
      },
    });
  });

  it("fails with issue paths for a missing list or a wrong type, never echoing the body", () => {
    expect(parseWikimediaOnThisDay({ events: [], births: [] })).toEqual({
      ok: false,
      issuePaths: ["deaths"],
    });
    const bad = parseWikimediaOnThisDay({
      events: [{ year: "2024", text: "SECRET", pages: [] }],
      births: [],
      deaths: [],
    });
    expect(bad).toEqual({ ok: false, issuePaths: ["events.0.year"] });
    expect(JSON.stringify(bad)).not.toContain("SECRET");
    expect(parseWikimediaOnThisDay(null)).toEqual({ ok: false, issuePaths: ["(root)"] });
  });
});

describe("fetchWikimediaOnThisDay", () => {
  const delay = fakeDelay().delay;

  it("makes one request for the UTC month and day and adds them to the value", async () => {
    const { fetch, requested } = recordedFetch("wikimedia-onthisday");
    const result = await fetchWikimediaOnThisDay(createHttpClient({ fetch, delay }), NOW);
    expect(requested).toEqual([URL]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fetchedAt).toBe(NOW.toISOString());
    expect(OnThisDay.safeParse(result.value).success).toBe(true);
    expect(result.value.month).toBe(11);
    expect(result.value.day).toBe(11);
    expect(result.value.events).toHaveLength(74);
  });

  it("fails with the HTTP failure and the URL", async () => {
    const { fetch } = recordedFetch("wikimedia-onthisday", {
      [URL]: () => Promise.resolve(textResponse(404, "gone")),
    });
    const result = await fetchWikimediaOnThisDay(createHttpClient({ fetch, delay }), NOW);
    expect(result).toEqual({
      ok: false,
      source: "wikimedia-onthisday",
      url: URL,
      failure: { kind: "status", status: 404 },
    });
  });

  it("fails with a schema failure for a body of the wrong shape", async () => {
    const { fetch } = recordedFetch("wikimedia-onthisday", {
      [URL]: () => Promise.resolve(textResponse(200, '{"events": 3}')),
    });
    const result = await fetchWikimediaOnThisDay(createHttpClient({ fetch, delay }), NOW);
    expect(result).toEqual({
      ok: false,
      source: "wikimedia-onthisday",
      url: URL,
      failure: { kind: "schema", issuePaths: ["events", "births", "deaths"] },
    });
  });
});
