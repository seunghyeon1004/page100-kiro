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

  it("keeps 40 events, 40 births and 40 deaths of 74, 233 and 115, spread over each list (owner answer 4, amended)", () => {
    const result = parseWikimediaOnThisDay(recorded("wikimedia-onthisday", BASE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { events, births, deaths } = result.value;
    // Selected events that fall outside the spread are kept too, so events may exceed 40.
    expect(events.length).toBeGreaterThanOrEqual(40);
    expect([births.length, deaths.length]).toEqual([40, 40]);
    expect(events[0]).toEqual({
      year: 2024,
      text: "A vehicle-ramming attack in Zhuhai, China, kills 38 people and injures 48.",
    });
    expect(births[0]).toEqual({ year: 2005, text: "Ben Gannon-Doak, Scottish footballer" });
    expect(deaths[0]?.year).toBe(2024);
  });

  it("keeps the recorded order and both ends: each kept list is a subsequence of the wire list from its first to its last entry", () => {
    const body = recorded("wikimedia-onthisday", BASE) as Record<
      string,
      { year: number; text: string }[]
    >;
    const result = parseWikimediaOnThisDay(body);
    if (!result.ok) throw new Error("fixture did not parse");
    for (const key of ["events", "births", "deaths"] as const) {
      const wire = (body[key] ?? []).map(({ year, text }) => ({ year, text }));
      const kept = result.value[key];
      let at = -1;
      for (const entry of kept) {
        at = wire.findIndex((w, i) => i > at && w.year === entry.year && w.text === entry.text);
        expect(at, `${key}: ${entry.text}`).toBeGreaterThanOrEqual(0);
      }
      expect(kept[0]).toEqual(wire[0]);
      expect(kept.at(-1)).toEqual(wire.at(-1));
    }
  });

  it("keeps only year and text on each item, and no linked article", () => {
    const result = parseWikimediaOnThisDay(recorded("wikimedia-onthisday", BASE));
    if (!result.ok) throw new Error("fixture did not parse");
    for (const list of [result.value.events, result.value.births, result.value.deaths]) {
      for (const entry of list) expect(Object.keys(entry).sort()).toEqual(["text", "year"]);
    }
  });

  it("keeps an entry the spread skips when the selected list holds the same year and text", () => {
    const entry = (i: number) => ({ year: 1000 + i, text: `Event ${String(i)}`, pages: [] });
    const events = Array.from({ length: 50 }, (_, i) => entry(i));
    const kept = parseWikimediaOnThisDay({
      events,
      births: [],
      deaths: [],
      // Of 50 entries the spread keeps positions 0, 1, 3, ...: position 2 is skipped.
      selected: [entry(2), { year: 1004, text: "Other text", pages: [] }],
    });
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.value.events).toHaveLength(41);
    expect(kept.value.events[2]).toEqual({ year: 1002, text: "Event 2" });
    expect(kept.value.events.at(-1)).toEqual({ year: 1049, text: "Event 49" });
  });

  it("keeps exactly 40 of 41 entries when selected is absent or empty", () => {
    const events = Array.from({ length: 41 }, (_, i) => ({ year: i, text: `E${String(i)}` }));
    for (const selected of [undefined, []]) {
      const result = parseWikimediaOnThisDay({ events, births: [], deaths: [], selected });
      expect(result.ok && result.value.events.length).toBe(40);
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
        events: [{ year: -44, text: "An event with no linked article." }],
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
    expect(result.value.events.length).toBeGreaterThanOrEqual(40);
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
